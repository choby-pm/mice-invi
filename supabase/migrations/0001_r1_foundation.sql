-- R1 기반: 테넌트(PCO) · 멤버 · 행사 · 감사 로그 + 행 단위 보안(RLS)
-- 03 §1.4(org, event, audit 모듈), §1.6(테넌트 격리) 대응.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

-- 1. 테넌트 (PCO 조직)
create table if not exists tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 2. 테넌트 멤버 (사용자 ↔ 테넌트 ↔ 역할). 역할 코드는 03 §1.6 표를 따릅니다.
create table if not exists tenant_member (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('PCO_ADMIN', 'PCO_MANAGER', 'PCO_FIELD')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- 3. 행사 (최소 필드만 — 04 로드맵상 R2에서 필드가 늘어납니다)
create table if not exists event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  status text not null default 'PREPARING' check (status in ('PREPARING', 'ACTIVE', 'CLOSED')),
  created_at timestamptz not null default now()
);

-- 4. 감사 로그 (추가만 가능 — 03 §1.7). R1에서는 서버 코드가 관리자 키로만 기록합니다.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- 현재 로그인한 사용자가 특정 테넌트에서 가진 역할을 반환 (없으면 null).
-- RLS 정책과 애플리케이션 코드 양쪽에서 재사용합니다.
create or replace function current_tenant_role(target_tenant_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from tenant_member
  where tenant_id = target_tenant_id and user_id = auth.uid()
  limit 1;
$$;

alter table tenant enable row level security;
alter table tenant_member enable row level security;
alter table event enable row level security;
alter table audit_log enable row level security;

-- tenant: 내가 속한 테넌트만 조회
create policy tenant_select_own on tenant
  for select using (current_tenant_role(id) is not null);

-- tenant_member: 내가 속한 테넌트의 멤버 목록만 조회, 관리자만 추가/수정/삭제
create policy tenant_member_select on tenant_member
  for select using (current_tenant_role(tenant_id) is not null);
create policy tenant_member_write on tenant_member
  for insert with check (current_tenant_role(tenant_id) = 'PCO_ADMIN');
create policy tenant_member_update on tenant_member
  for update using (current_tenant_role(tenant_id) = 'PCO_ADMIN');
create policy tenant_member_delete on tenant_member
  for delete using (current_tenant_role(tenant_id) = 'PCO_ADMIN');

-- event: 테넌트 멤버는 조회, 관리자·담당자만 생성/수정, 관리자만 삭제 (D-UI-05는 상태 조건까지 포함 — 서비스 코드에서 추가 검사)
create policy event_select on event
  for select using (current_tenant_role(tenant_id) is not null);
create policy event_insert on event
  for insert with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy event_update on event
  for update using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy event_delete on event
  for delete using (current_tenant_role(tenant_id) = 'PCO_ADMIN');

-- audit_log: 테넌트 멤버는 조회만 가능. 쓰기는 정책을 두지 않아 기본 거부 —
-- 서버 코드가 관리자 키(RLS 우회)로만 기록합니다 (03 §1.7 "추가만 가능").
create policy audit_log_select on audit_log
  for select using (current_tenant_role(tenant_id) is not null);
