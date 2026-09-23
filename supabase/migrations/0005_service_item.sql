-- 서비스 항목: 항공·숙박·수송·공항 의전·식음이 공유하는 공통 틀 (01 §"service_item").
-- 지금은 대표단 단위로 최소 필드만 둡니다 — 참가자별 세부 항목(항공 구간, 객실 배정 등)은
-- 다음 단계에서 늘립니다. 상태는 03 §2.1 원칙대로 화면에서 직접 바꾸지 않고, 항상 서버
-- 액션(행동 API)으로만 바뀝니다 — 이번 화면은 "요청 항목 만들기"까지만 다룹니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists service_item (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  delegation_id uuid not null references delegation(id) on delete cascade,
  service_type text not null check (service_type in ('FLIGHT', 'LODGING', 'TRANSFER', 'AIRPORT', 'DIETARY')),
  event_vendor_id uuid references event_vendor(id),
  support_type text check (support_type in ('SUPPORTED', 'SELF_BOOKED', 'PREPAID_REIMBURSE', 'SELF_PAID_ARRANGED', 'NOT_PROVIDED')),
  status text not null default 'DRAFT' check (
    status in ('DRAFT', 'REQUESTED', 'IN_PROGRESS', 'CONFIRMED', 'NOTIFIED', 'CHANGING', 'CANCEL_REQ', 'CANCELLED', 'NOT_APPLICABLE')
  ),
  scheduled_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

alter table service_item enable row level security;

-- PCO는 테넌트 범위 CRUD, 대리인은 자기 대표단 것만 CRU(삭제는 PCO만 — 매트릭스 2.5)
create policy service_item_select on service_item for select
  using (current_tenant_role(tenant_id) is not null or is_active_proxy(delegation_id));
create policy service_item_insert on service_item for insert
  with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(delegation_id));
create policy service_item_update on service_item for update
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(delegation_id));
create policy service_item_delete on service_item for delete
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
