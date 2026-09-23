-- 0007에서 테스트로 잡아낸 버그 2건 수정 (04 §2.4 "테스트 먼저" 규칙이 실제로 잡아낸 사례).
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

-- 버그 1: Supabase는 pgcrypto를 public이 아니라 extensions 스키마에 설치합니다.
--         함수의 search_path가 public만 지정돼 있어 pgp_sym_encrypt/decrypt를 못 찾았습니다.
-- 버그 2: "current_tenant_role(...) not in (...) and not is_active_proxy(...)" 권한 검사에서,
--         소속이 없는 사용자는 current_tenant_role이 NULL을 반환하고 "NULL not in (...)"은
--         SQL에서 NULL(거짓도 참도 아님)이 되어 if문이 실행되지 않습니다 — 즉 권한 없는
--         사용자가 걸러지지 않고 통과해버립니다. coalesce로 NULL을 안전하게 막습니다.

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
set search_path = public, extensions
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

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') and not is_active_proxy(v_delegation_id) then
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
set search_path = public, extensions
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

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') and not is_active_proxy(v_delegation_id) then
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
  if coalesce(current_tenant_role(v_tenant_id), '') != 'PCO_ADMIN' then
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
