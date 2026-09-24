-- R3: 항공 상세 요청/확정 필드 (01 §"flight_request / flight_segment").
-- "요청 데이터/확정 데이터 분리" 원칙을 스키마 레벨에서 지키기 위해 두 테이블로 나눕니다.
-- flight_request: 대리인(또는 PCO)이 입력하는 희망 사항. service_item과 1:1.
-- flight_segment: 업체가 입력하는 확정된 구간. 경유가 있으면 한 방향에 여러 행(seq 순).
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists flight_request (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null unique references service_item(id) on delete cascade,
  inbound_origin_city text,
  inbound_dest_airport text,
  inbound_preferred_date date,
  outbound_preferred_date date,
  outbound_origin_airport text,
  outbound_dest_city text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table flight_request enable row level security;

create table if not exists flight_segment (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null references service_item(id) on delete cascade,
  direction text not null check (direction in ('INBOUND', 'OUTBOUND')),
  seq int not null default 1,
  flight_no text not null,
  dep_airport text not null,
  arr_airport text not null,
  dep_at timestamptz not null,
  arr_at timestamptz not null,
  cabin_class text,
  pnr text,
  ticket_no text,
  ticket_status text not null default 'BOOKED' check (ticket_status in ('BOOKED', 'TICKETED', 'CANCELLED')),
  change_fee numeric,
  change_fee_currency text,
  is_final_arrival boolean not null default false,
  created_at timestamptz not null default now()
);
alter table flight_segment enable row level security;

-- 두 테이블 다 service_item의 조회 권한을 그대로 물려받습니다(PCO/대리인/업체 이미 올바르게
-- 걸려 있음, 0012에서 SECURITY DEFINER 함수로 정리됨) — 그래서 별도 함수 없이 service_item을
-- 서브쿼리로 참조해도 안전합니다(0012 버그는 event_vendor를 "직접" 참조해서 난 문제였고,
-- 여기는 service_item 자체의 이미 올바른 정책에 얹혀가는 것이라 다릅니다).
create policy flight_request_select on flight_request for select
  using (exists (select 1 from service_item si where si.id = flight_request.service_item_id));
create policy flight_request_write on flight_request for all
  using (
    exists (
      select 1 from service_item si where si.id = flight_request.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(si.delegation_id))
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = flight_request.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(si.delegation_id))
    )
  );

create policy flight_segment_select on flight_segment for select
  using (exists (select 1 from service_item si where si.id = flight_segment.service_item_id));
create policy flight_segment_write on flight_segment for all
  using (
    exists (
      select 1 from service_item si where si.id = flight_segment.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = flight_segment.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  );
