-- R3: 숙박(LODGING) 상세 요청/확정 필드 (01 §"lodging_request / room_assignment").
-- lodging_request: 대리인이 입력하는 희망 사항 (체크인·체크아웃 희망일, 객실 구성 메모).
-- room_assignment: 호텔이 입력하는 확정된 객실 — 객실 단위로 참가자 여러 명을 묶는다(BR-07-1),
-- 한 대표단이 여러 객실을 쓸 수 있어 service_item 1개에 room_assignment 여러 행.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists lodging_request (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null unique references service_item(id) on delete cascade,
  check_in_preferred_date date,
  check_out_preferred_date date,
  room_grouping_note text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table lodging_request enable row level security;

create table if not exists room_assignment (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null references service_item(id) on delete cascade,
  hotel_name text not null,
  room_type text,
  participant_ids uuid[] not null default '{}',
  check_in_at timestamptz,
  check_out_at timestamptz,
  confirmation_no text,
  room_no text,
  note text,
  created_at timestamptz not null default now()
);
alter table room_assignment enable row level security;

-- flight_request/flight_segment(0013)와 같은 이유로 안전합니다 — service_item 서브쿼리는
-- service_item 자신의 이미 올바른 정책(0012)에 얹혀갑니다.
create policy lodging_request_select on lodging_request for select
  using (exists (select 1 from service_item si where si.id = lodging_request.service_item_id));
create policy lodging_request_write on lodging_request for all
  using (
    exists (
      select 1 from service_item si where si.id = lodging_request.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(si.delegation_id))
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = lodging_request.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(si.delegation_id))
    )
  );

create policy room_assignment_select on room_assignment for select
  using (exists (select 1 from service_item si where si.id = room_assignment.service_item_id));
create policy room_assignment_write on room_assignment for all
  using (
    exists (
      select 1 from service_item si where si.id = room_assignment.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = room_assignment.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  );

-- 객실에 누구를 묶을지 고르려면 업체가 그 대표단 참가자 이름 정도는 봐야 합니다(01 §2.5
-- 권한 매트릭스 "참가자 기본 정보: 업체 R(범위, 업무 필드)" — 여권 등 🔒 항목은 별도 테이블이라
-- 이 정책과 무관하게 계속 차단됩니다). event_vendor를 직접 참조하지 않고 0012와 같은 방식으로
-- SECURITY DEFINER 함수를 통해서만 확인합니다.
create or replace function is_vendor_of_delegation(target_delegation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from service_item si
    where si.delegation_id = target_delegation_id and is_event_vendor_of_mine(si.event_vendor_id)
  );
$$;

create policy participant_vendor_select on participant for select
  using (is_vendor_of_delegation(delegation_id));
