-- R3: 수송(TRANSFER) 자동 생성 + 배차 확정 (01 §P08, §"transfer_request / vehicle_dispatch").
-- 수송은 대리인이 요청하지 않습니다 — 항공 확정 데이터로부터 시스템이 자동 생성합니다.
-- 그래서 대표단 생성 시 자동으로 만들던 기본 5종 중 TRANSFER는 빼고(입국/귀국 각각 별도
-- service_item으로 생기는 게 맞아서 — 방향마다 상태가 독립적이어야 함), 항공 구간이
-- 확정될 때 generate_transfer_request()가 필요한 만큼 만듭니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function create_default_service_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into service_item (tenant_id, event_id, delegation_id, service_type, status)
  select new.tenant_id, new.event_id, new.id, t, 'DRAFT'
  from unnest(array['FLIGHT', 'LODGING', 'AIRPORT', 'DIETARY']) as t;
  return new;
end;
$$;

create table if not exists transfer_request (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null unique references service_item(id) on delete cascade,
  direction text not null check (direction in ('INBOUND', 'OUTBOUND')),
  from_text text not null,
  to_text text not null,
  scheduled_at timestamptz,
  participant_ids uuid[] not null default '{}',
  luggage_note text,
  source_flight_segment_id uuid references flight_segment(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table transfer_request enable row level security;

create table if not exists vehicle_dispatch (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null references service_item(id) on delete cascade,
  from_text text,
  to_text text,
  depart_at timestamptz,
  vehicle_class text,
  plate_no text,
  driver_name text,
  driver_phone text,
  participant_ids uuid[] not null default '{}',
  luggage_note text,
  created_at timestamptz not null default now()
);
alter table vehicle_dispatch enable row level security;

-- 조회는 service_item 자신의 이미 올바른 정책(0012)에 얹혀갑니다.
create policy transfer_request_select on transfer_request for select
  using (exists (select 1 from service_item si where si.id = transfer_request.service_item_id));
-- 수송 요청은 시스템(아래 함수)이 만들고, PCO만 손으로 조정합니다 — 대리인은 요청하지 않는다는
-- P08 규칙 그대로라 flight_request/lodging_request와 다르게 is_active_proxy를 넣지 않습니다.
create policy transfer_request_write on transfer_request for all
  using (
    exists (
      select 1 from service_item si where si.id = transfer_request.service_item_id
        and coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = transfer_request.service_item_id
        and coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    )
  );

create policy vehicle_dispatch_select on vehicle_dispatch for select
  using (exists (select 1 from service_item si where si.id = vehicle_dispatch.service_item_id));
create policy vehicle_dispatch_write on vehicle_dispatch for all
  using (
    exists (
      select 1 from service_item si where si.id = vehicle_dispatch.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = vehicle_dispatch.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  );

-- 항공 구간이 확정되면 항공 업체(호출자)가 이 함수를 불러 수송 요청을 만들거나 갱신합니다.
-- 같은 방향(입국/귀국)에 이미 생성된 항목이 있으면 새로 만들지 않고 내용만 갱신합니다
-- (IR-02: 입국 최종 도착 일시·공항 변경 → 수송 재배차, 자동). service_item 생성은 보통
-- PCO/대리인만 할 수 있지만, 이건 "시스템 자동 생성"이라 SECURITY DEFINER로 예외를 둡니다 —
-- 호출자가 그 항공 항목의 정당한 담당자(PCO 또는 그 항공 건 담당 업체)인지는 함수 안에서 직접
-- 검사합니다(admin 클라이언트를 쓰지 않는 이유 — 03 §1.6, 사용자 요청 경로에서 RLS 전면 우회 금지).
create or replace function generate_transfer_request(
  p_flight_service_item_id uuid,
  p_direction text,
  p_from_text text,
  p_to_text text,
  p_scheduled_at timestamptz,
  p_source_flight_segment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_event_id uuid;
  v_delegation_id uuid;
  v_flight_event_vendor_id uuid;
  v_transfer_item_id uuid;
  v_transfer_event_vendor_id uuid;
begin
  select tenant_id, event_id, delegation_id, event_vendor_id
    into v_tenant_id, v_event_id, v_delegation_id, v_flight_event_vendor_id
  from service_item where id = p_flight_service_item_id and service_type = 'FLIGHT';

  if v_tenant_id is null then
    raise exception 'flight service item not found';
  end if;

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER')
     and not is_event_vendor_of_mine(v_flight_event_vendor_id) then
    raise exception 'not authorized';
  end if;

  select si.id into v_transfer_item_id
  from service_item si
  join transfer_request tr on tr.service_item_id = si.id
  where si.delegation_id = v_delegation_id and si.service_type = 'TRANSFER' and tr.direction = p_direction
  limit 1;

  if v_transfer_item_id is null then
    select ev.id into v_transfer_event_vendor_id
    from event_vendor ev
    where ev.event_id = v_event_id and 'TRANSFER' = any(ev.service_types)
    limit 1;

    insert into service_item (tenant_id, event_id, delegation_id, service_type, event_vendor_id, status, scheduled_at, note)
    values (v_tenant_id, v_event_id, v_delegation_id, 'TRANSFER', v_transfer_event_vendor_id, 'REQUESTED', p_scheduled_at, p_from_text || ' → ' || p_to_text)
    returning id into v_transfer_item_id;
  else
    update service_item set scheduled_at = p_scheduled_at, note = p_from_text || ' → ' || p_to_text
    where id = v_transfer_item_id;
  end if;

  insert into transfer_request (
    service_item_id, direction, from_text, to_text, scheduled_at, participant_ids, source_flight_segment_id, updated_at
  ) values (
    v_transfer_item_id, p_direction, p_from_text, p_to_text, p_scheduled_at,
    (select coalesce(array_agg(id), '{}') from participant where delegation_id = v_delegation_id and status <> 'CANCELLED'),
    p_source_flight_segment_id, now()
  )
  on conflict (service_item_id) do update set
    direction = excluded.direction,
    from_text = excluded.from_text,
    to_text = excluded.to_text,
    scheduled_at = excluded.scheduled_at,
    participant_ids = excluded.participant_ids,
    source_flight_segment_id = excluded.source_flight_segment_id,
    updated_at = now();

  return v_transfer_item_id;
end;
$$;
