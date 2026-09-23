-- 행사 참여 업체: 분야(서비스 유형)별로 어떤 업체가 담당하는지.
-- 01 §"vendor/event_vendor". vendor는 플랫폼 전체가 공유하는 디렉터리(여러 PCO가 같은
-- 업체를 쓸 수 있음), event_vendor가 "이 행사에서 이 업체가 이 분야를 맡는다"를 연결합니다.
-- 업체 계정 로그인(vendor_member)은 아직 없습니다 — PCO가 이름만으로 등록해 둡니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists vendor (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists event_vendor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  vendor_id uuid not null references vendor(id) on delete cascade,
  service_types text[] not null default '{}',
  delegation_scope text not null default 'ALL' check (delegation_scope in ('ALL', 'SCOPED')),
  created_at timestamptz not null default now()
);

alter table vendor enable row level security;
alter table event_vendor enable row level security;

-- vendor: 업체 디렉터리는 플랫폼 공용이라 로그인한 사람이면 누구나 보고 새로 등록할 수 있음
create policy vendor_select on vendor for select using (auth.uid() is not null);
create policy vendor_insert on vendor for insert with check (auth.uid() is not null);

-- event_vendor: 이벤트 배정은 그 테넌트 소속만
create policy event_vendor_select on event_vendor for select
  using (current_tenant_role(tenant_id) is not null);
create policy event_vendor_insert on event_vendor for insert
  with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy event_vendor_update on event_vendor for update
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy event_vendor_delete on event_vendor for delete
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
