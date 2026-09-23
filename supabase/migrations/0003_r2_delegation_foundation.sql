-- R2 기반: 의전 등급 · 지원 정책 · 대표단 · 참가자(민감정보 제외) · 대리인 연결
-- 01 §"delegation/participant/support_policy/protocol_level", 03 §1.4 delegation 모듈 대응.
-- 🔒 민감정보(participant_sensitive)는 별도 마이그레이션에서 테스트와 함께 다룹니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

-- 1. 의전 등급 (행사별 정의, P02-B)
create table if not exists protocol_level (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  defaults jsonb not null default '{}'::jsonb, -- 객실 타입·차종·공항 의전 범위·좌석 등급 등
  created_at timestamptz not null default now()
);

-- 2. 지원 정책 (서비스×참가자유형 조합, P02-A)
create table if not exists support_policy (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  service_type text not null check (service_type in ('FLIGHT', 'LODGING', 'TRANSFER', 'AIRPORT', 'DIETARY')),
  participant_type text not null check (participant_type in ('VIP', 'COMPANION', 'STAFF', 'ALL')),
  protocol_level_ids uuid[] not null default '{}',
  support_type text not null check (support_type in ('SUPPORTED', 'SELF_BOOKED', 'PREPAID_REIMBURSE', 'SELF_PAID_ARRANGED', 'NOT_PROVIDED')),
  max_count int,
  overflow_support_type text check (overflow_support_type in ('SUPPORTED', 'SELF_BOOKED', 'PREPAID_REIMBURSE', 'SELF_PAID_ARRANGED', 'NOT_PROVIDED')),
  guide_text jsonb not null default '{}'::jsonb, -- {"ko": "...", "en": "..."}
  applies_to text check (applies_to in ('AIRPORT', 'PROGRAM', 'SELF_SCHEDULE')),
  created_at timestamptz not null default now()
);

-- 3. 대표단
create table if not exists delegation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  name text not null,
  country text not null,
  organization text not null,
  protocol_level_id uuid references protocol_level(id),
  invite_code text not null default encode(gen_random_bytes(9), 'base64'),
  owner_user_id uuid references auth.users(id),
  preferred_language text not null default 'ko' check (preferred_language in ('ko', 'en')),
  rsvp text check (rsvp in ('ATTENDING', 'DECLINED', 'UNDECIDED')),
  invite_status text not null default 'READY' check (
    invite_status in ('READY', 'SENT', 'BOUNCED', 'OPENED', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'DECLINED', 'WITHDRAWN')
  ),
  submitted_at timestamptz,
  completeness numeric(5,2) not null default 0,
  internal_note text,
  created_at timestamptz not null default now()
);
create unique index if not exists delegation_invite_code_key on delegation(invite_code);

-- 4. 참가자 (🔒 여권·건강 등은 다음 마이그레이션의 participant_sensitive로)
create table if not exists participant (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  delegation_id uuid not null references delegation(id) on delete cascade,
  participant_type text not null check (participant_type in ('VIP', 'COMPANION', 'STAFF')),
  staff_role text,
  relation_to_vip text,
  last_name text not null,
  first_name text not null,
  honorific text,
  display_name text,
  title text,
  gender text,
  nationality text not null,
  birth_date date,
  email text,
  mobile text,
  protocol_level_id uuid references protocol_level(id),
  status text not null default 'REGISTERED' check (status in ('REGISTERED', 'CONFIRMED', 'CANCELLED', 'ARRIVED', 'DEPARTED')),
  sort_order int not null default 0,
  protocol_preference text,
  created_at timestamptz not null default now()
);

-- 5. 대리인 ↔ 대표단 (다대다, BR-03-2)
create table if not exists delegation_proxy (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  delegation_id uuid not null references delegation(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'REMOVED')),
  created_at timestamptz not null default now(),
  unique (delegation_id, user_id)
);

-- 대리인 본인이 배정된 대표단인지 확인 (RLS용, security definer로 재귀 없이 자기 행은 스스로 확인 가능)
create or replace function is_active_proxy(target_delegation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from delegation_proxy
    where delegation_id = target_delegation_id
      and user_id = auth.uid()
      and status = 'ACTIVE'
  );
$$;

alter table protocol_level enable row level security;
alter table support_policy enable row level security;
alter table delegation enable row level security;
alter table participant enable row level security;
alter table delegation_proxy enable row level security;

-- protocol_level / support_policy: PCO만 (대리인은 볼 일 없음, 업체 포털은 파생값만 — 고도화)
create policy protocol_level_select on protocol_level for select using (current_tenant_role(tenant_id) is not null);
create policy protocol_level_write on protocol_level for insert with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy protocol_level_update on protocol_level for update using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy protocol_level_delete on protocol_level for delete using (current_tenant_role(tenant_id) = 'PCO_ADMIN');

create policy support_policy_select on support_policy for select using (current_tenant_role(tenant_id) is not null);
create policy support_policy_write on support_policy for insert with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy support_policy_update on support_policy for update using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy support_policy_delete on support_policy for delete using (current_tenant_role(tenant_id) = 'PCO_ADMIN');

-- delegation: PCO는 테넌트 범위, 대리인은 자기 배정 대표단만 (매트릭스 2.5 "RU (범위)")
create policy delegation_select on delegation for select
  using (current_tenant_role(tenant_id) is not null or is_active_proxy(id));
create policy delegation_insert on delegation for insert
  with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy delegation_update on delegation for update
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(id));
create policy delegation_delete on delegation for delete
  using (current_tenant_role(tenant_id) = 'PCO_ADMIN');

-- participant: 대리인은 자기 대표단 참가자에 CRUD (매트릭스 "CRUD (범위)")
create policy participant_select on participant for select
  using (current_tenant_role(tenant_id) is not null or is_active_proxy(delegation_id));
create policy participant_insert on participant for insert
  with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(delegation_id));
create policy participant_update on participant for update
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(delegation_id));
create policy participant_delete on participant for delete
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(delegation_id));

-- delegation_proxy: 배정은 PCO만 (자기 대표단 자체 요청 흐름은 다음 단계에서). 대리인은 자기 행만 조회.
create policy delegation_proxy_select on delegation_proxy for select
  using (current_tenant_role(tenant_id) is not null or user_id = auth.uid());
create policy delegation_proxy_write on delegation_proxy for insert
  with check (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy delegation_proxy_update on delegation_proxy for update
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
create policy delegation_proxy_delete on delegation_proxy for delete
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));

-- 대표단 변경 감사 로그 (event와 같은 패턴)
create or replace function log_delegation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_action text;
begin
  if TG_OP = 'DELETE' then
    v_tenant_id := old.tenant_id; v_action := 'delegation.deleted';
  elsif TG_OP = 'INSERT' then
    v_tenant_id := new.tenant_id; v_action := 'delegation.created';
  else
    v_tenant_id := new.tenant_id; v_action := 'delegation.updated';
  end if;

  begin
    insert into audit_log (tenant_id, actor_user_id, action, entity_type, entity_id, detail)
    values (
      v_tenant_id, auth.uid(), v_action, 'delegation', coalesce(new.id, old.id),
      case when TG_OP = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
           when TG_OP = 'INSERT' then to_jsonb(new) else to_jsonb(old) end
    );
  exception when foreign_key_violation then null;
  end;
  return coalesce(new, old);
end;
$$;

drop trigger if exists delegation_audit_log on delegation;
create trigger delegation_audit_log
  after insert or update or delete on delegation
  for each row execute function log_delegation_change();

-- 버그 수정: 테넌트를 지우면(현재는 테스트 정리 스크립트에서만 씁니다) event/delegation이
-- 같은 트랜잭션에서 연쇄 삭제되는데, 그 순간 audit_log의 tenant_id FK가 이미 지워지고
-- 있는 테넌트를 가리키게 되어 감사 로그 기록이 실패하면서 전체 삭제가 막혔습니다.
-- 감사 로그 실패가 본 작업을 막으면 안 되므로, 이 한 가지 예외만 무시하도록 고칩니다.
create or replace function log_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_action text;
begin
  if TG_OP = 'DELETE' then
    v_tenant_id := old.tenant_id; v_action := 'event.deleted';
  elsif TG_OP = 'INSERT' then
    v_tenant_id := new.tenant_id; v_action := 'event.created';
  else
    v_tenant_id := new.tenant_id; v_action := 'event.updated';
  end if;

  begin
    insert into audit_log (tenant_id, actor_user_id, action, entity_type, entity_id, detail)
    values (
      v_tenant_id, auth.uid(), v_action, 'event', coalesce(new.id, old.id),
      case when TG_OP = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
           when TG_OP = 'INSERT' then to_jsonb(new) else to_jsonb(old) end
    );
  exception when foreign_key_violation then null; -- 테넌트째 지워지는 중이면 기록을 건너뜀
  end;
  return coalesce(new, old);
end;
$$;
