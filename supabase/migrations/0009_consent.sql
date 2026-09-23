-- 동의서 (01 §"consent_policy/consent_item/consent_record", P05, S11).
-- PCO가 행사별 동의서 버전을 만들고 항목(필수/선택/민감정보/고유식별정보/국외이전/재사용보관)을
-- 정의합니다. 실제 체크는 대리인 포털에서 하므로 그 화면은 포털 로그인이 붙는 다음 단계에서.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists consent_policy (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  version int not null,
  notice_body jsonb not null default '{}'::jsonb, -- {"ko": "...", "en": "..."}
  published_at timestamptz,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, version)
);

create table if not exists consent_item (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  policy_id uuid not null references consent_policy(id) on delete cascade,
  category text not null check (category in ('REQUIRED', 'OPTIONAL', 'SENSITIVE', 'UNIQUE_ID', 'OVERSEAS_TRANSFER', 'REUSE_STORAGE')),
  text jsonb not null default '{}'::jsonb,
  required boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists consent_record (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  delegation_id uuid not null references delegation(id) on delete cascade,
  item_id uuid not null references consent_item(id) on delete cascade,
  participant_id uuid not null references participant(id) on delete cascade,
  proxy_user_id uuid references auth.users(id),
  agreed boolean not null,
  policy_version int not null,
  status text not null default 'VALID' check (status in ('VALID', 'NEEDS_REAGREEMENT', 'WITHDRAWN')),
  ip_address text,
  agreed_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (item_id, participant_id)
);

-- 대리인이 이 행사의 어느 대표단이든 배정돼 있으면 동의서 내용을 볼 수 있어야 함
-- (행사 단위로 게시되는 공용 문서라서 delegation 단위가 아니라 event 단위로 확인).
create or replace function is_event_proxy(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from delegation_proxy dp
    join delegation d on d.id = dp.delegation_id
    where d.event_id = target_event_id and dp.user_id = auth.uid() and dp.status = 'ACTIVE'
  );
$$;

alter table consent_policy enable row level security;
alter table consent_item enable row level security;
alter table consent_record enable row level security;

create policy consent_policy_select on consent_policy for select
  using (current_tenant_role(tenant_id) is not null or is_event_proxy(event_id));
create policy consent_policy_write on consent_policy for insert
  with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy consent_policy_update on consent_policy for update
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));

create policy consent_item_select on consent_item for select
  using (current_tenant_role(tenant_id) is not null or is_event_proxy(event_id));
create policy consent_item_write on consent_item for insert
  with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy consent_item_update on consent_item for update
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy consent_item_delete on consent_item for delete
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));

-- 동의 기록: PCO는 조회만, 생성은 대리인만 (01 §2.5 매트릭스 "동의 기록 | R | R | ... | C(범위)")
create policy consent_record_select on consent_record for select
  using (current_tenant_role(tenant_id) is not null or is_active_proxy(delegation_id));
create policy consent_record_insert on consent_record for insert
  with check (is_active_proxy(delegation_id));
create policy consent_record_update on consent_record for update
  using (is_active_proxy(delegation_id));
