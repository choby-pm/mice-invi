-- 🔒 민감정보(여권·건강 등). 03 §1.7 원칙 3가지를 구조로 강제합니다:
--   1) 항목 단위 암호화, 행사별 키 — 키를 지우면 백업에 남은 암호문도 복구 불가
--   2) 열람마다 기록 — 그래서 이 테이블은 직접 SELECT하는 RLS 정책을 아예 두지 않고,
--      반드시 read_participant_sensitive() 함수로만 읽게 합니다 (기록 없이는 읽을 방법 자체가 없음)
--   3) 파기 후 잔존 없음 — purge_event_sensitive_data()가 값도 지우고 암호 키도 폐기
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create extension if not exists pgcrypto;

-- 행사별 암호 키 (03 §1.7). 클라이언트가 직접 읽을 수 없도록 RLS를 켜두기만 하고
-- 아무 정책도 만들지 않습니다 — SECURITY DEFINER 함수만 이 표를 만질 수 있습니다.
create table if not exists event_encryption_key (
  event_id uuid primary key references event(id) on delete cascade,
  key_material bytea not null default gen_random_bytes(32),
  created_at timestamptz not null default now()
);
alter table event_encryption_key enable row level security;

create table if not exists participant_sensitive (
  participant_id uuid primary key references participant(id) on delete cascade,
  passport_no bytea,
  passport_country bytea,
  passport_expiry bytea,
  medical_note bytea,
  allergy bytea,
  mobility_need bytea,
  religion bytea,
  consent_ref uuid,
  purge_status text not null default 'ACTIVE' check (purge_status in ('ACTIVE', 'PURGED')),
  updated_at timestamptz not null default now()
);
alter table participant_sensitive enable row level security;
-- 의도적으로 select/insert/update 정책을 두지 않습니다 — 아래 함수로만 접근.

create table if not exists sensitive_access_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  participant_id uuid not null references participant(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  fields text[] not null,
  accessed_at timestamptz not null default now()
);
alter table sensitive_access_log enable row level security;
create policy sensitive_access_log_select on sensitive_access_log for select
  using (current_tenant_role(tenant_id) in ('PCO_ADMIN', 'PCO_MANAGER'));
-- insert 정책 없음 — 함수(security definer)만 기록.

create or replace function get_event_key(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key bytea;
begin
  select key_material into v_key from event_encryption_key where event_id = p_event_id;
  if v_key is null then
    insert into event_encryption_key (event_id) values (p_event_id)
    returning key_material into v_key;
  end if;
  return encode(v_key, 'hex');
end;
$$;

create or replace function write_participant_sensitive(
  p_participant_id uuid,
  p_passport_no text default null,
  p_passport_country text default null,
  p_passport_expiry text default null,
  p_medical_note text default null,
  p_allergy text default null,
  p_mobility_need text default null,
  p_religion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delegation_id uuid;
  v_tenant_id uuid;
  v_event_id uuid;
  v_key text;
begin
  select delegation_id, tenant_id into v_delegation_id, v_tenant_id from participant where id = p_participant_id;
  if v_delegation_id is null then
    raise exception 'participant not found';
  end if;
  select event_id into v_event_id from delegation where id = v_delegation_id;

  if current_tenant_role(v_tenant_id) not in ('PCO_ADMIN', 'PCO_MANAGER') and not is_active_proxy(v_delegation_id) then
    raise exception 'not authorized';
  end if;

  v_key := get_event_key(v_event_id);

  insert into participant_sensitive (
    participant_id, passport_no, passport_country, passport_expiry, medical_note, allergy, mobility_need, religion, updated_at
  ) values (
    p_participant_id,
    case when p_passport_no is not null then pgp_sym_encrypt(p_passport_no, v_key) end,
    case when p_passport_country is not null then pgp_sym_encrypt(p_passport_country, v_key) end,
    case when p_passport_expiry is not null then pgp_sym_encrypt(p_passport_expiry, v_key) end,
    case when p_medical_note is not null then pgp_sym_encrypt(p_medical_note, v_key) end,
    case when p_allergy is not null then pgp_sym_encrypt(p_allergy, v_key) end,
    case when p_mobility_need is not null then pgp_sym_encrypt(p_mobility_need, v_key) end,
    case when p_religion is not null then pgp_sym_encrypt(p_religion, v_key) end,
    now()
  )
  on conflict (participant_id) do update set
    passport_no = coalesce(excluded.passport_no, participant_sensitive.passport_no),
    passport_country = coalesce(excluded.passport_country, participant_sensitive.passport_country),
    passport_expiry = coalesce(excluded.passport_expiry, participant_sensitive.passport_expiry),
    medical_note = coalesce(excluded.medical_note, participant_sensitive.medical_note),
    allergy = coalesce(excluded.allergy, participant_sensitive.allergy),
    mobility_need = coalesce(excluded.mobility_need, participant_sensitive.mobility_need),
    religion = coalesce(excluded.religion, participant_sensitive.religion),
    updated_at = now();
end;
$$;

create or replace function read_participant_sensitive(p_participant_id uuid)
returns table (
  passport_no text,
  passport_country text,
  passport_expiry text,
  medical_note text,
  allergy text,
  mobility_need text,
  religion text,
  purge_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delegation_id uuid;
  v_tenant_id uuid;
  v_event_id uuid;
  v_key text;
  v_row participant_sensitive%rowtype;
begin
  select delegation_id, tenant_id into v_delegation_id, v_tenant_id from participant where id = p_participant_id;
  if v_delegation_id is null then
    raise exception 'participant not found';
  end if;
  select event_id into v_event_id from delegation where id = v_delegation_id;

  if current_tenant_role(v_tenant_id) not in ('PCO_ADMIN', 'PCO_MANAGER') and not is_active_proxy(v_delegation_id) then
    raise exception 'not authorized';
  end if;

  select * into v_row from participant_sensitive where participant_id = p_participant_id;
  if v_row.participant_id is null or v_row.purge_status = 'PURGED' then
    return;
  end if;

  v_key := get_event_key(v_event_id);

  insert into sensitive_access_log (tenant_id, participant_id, actor_user_id, fields)
  values (v_tenant_id, p_participant_id, auth.uid(),
    array['passport_no', 'passport_country', 'passport_expiry', 'medical_note', 'allergy', 'mobility_need', 'religion']);

  return query select
    case when v_row.passport_no is not null then pgp_sym_decrypt(v_row.passport_no, v_key) end,
    case when v_row.passport_country is not null then pgp_sym_decrypt(v_row.passport_country, v_key) end,
    case when v_row.passport_expiry is not null then pgp_sym_decrypt(v_row.passport_expiry, v_key) end,
    case when v_row.medical_note is not null then pgp_sym_decrypt(v_row.medical_note, v_key) end,
    case when v_row.allergy is not null then pgp_sym_decrypt(v_row.allergy, v_key) end,
    case when v_row.mobility_need is not null then pgp_sym_decrypt(v_row.mobility_need, v_key) end,
    case when v_row.religion is not null then pgp_sym_decrypt(v_row.religion, v_key) end,
    v_row.purge_status;
end;
$$;

-- 행사 파기: 값도 지우고 암호 키도 폐기(백업에 남은 암호문도 복구 불가하게).
create or replace function purge_event_sensitive_data(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from event where id = p_event_id;
  if current_tenant_role(v_tenant_id) != 'PCO_ADMIN' then
    raise exception 'not authorized';
  end if;

  update participant_sensitive ps
  set purge_status = 'PURGED', passport_no = null, passport_country = null, passport_expiry = null,
      medical_note = null, allergy = null, mobility_need = null, religion = null
  from participant p join delegation d on d.id = p.delegation_id
  where ps.participant_id = p.id and d.event_id = p_event_id;

  delete from event_encryption_key where event_id = p_event_id;
end;
$$;
