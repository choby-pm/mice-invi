-- 입력값의 참가자·대표단·동의서 소속을 검증하고 동의/철회를 한 번에 저장합니다.
create or replace function submit_participant_consent(p_participant_id uuid, p_delegation_id uuid, p_policy_version int, p_item_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_delegation delegation; v_policy consent_policy;
begin
  select d.* into v_delegation from delegation d join participant p on p.delegation_id = d.id
    where p.id = p_participant_id and d.id = p_delegation_id;
  if v_delegation.id is null or not is_active_proxy(v_delegation.id) then raise exception 'not authorized'; end if;
  select * into v_policy from consent_policy where event_id = v_delegation.event_id and is_current for share;
  if v_policy.id is null or v_policy.version <> p_policy_version then raise exception 'consent policy changed'; end if;
  if exists(select 1 from unnest(p_item_ids) x where not exists(select 1 from consent_item ci where ci.id = x and ci.policy_id = v_policy.id)) then raise exception 'invalid consent item'; end if;
  insert into consent_record(tenant_id,delegation_id,item_id,participant_id,proxy_user_id,agreed,policy_version,status,withdrawn_at)
    select v_delegation.tenant_id, v_delegation.id, ci.id, p_participant_id, auth.uid(),
      ci.id = any(coalesce(p_item_ids,'{}')), v_policy.version,
      case when ci.id = any(coalesce(p_item_ids,'{}')) then 'VALID' else 'WITHDRAWN' end,
      case when ci.id = any(coalesce(p_item_ids,'{}')) then null else now() end
    from consent_item ci where ci.policy_id = v_policy.id
    on conflict(item_id,participant_id) do update set agreed=excluded.agreed,policy_version=excluded.policy_version,
      status=excluded.status,withdrawn_at=excluded.withdrawn_at,proxy_user_id=excluded.proxy_user_id,agreed_at=now();
end;
$$;
-- 위 함수만 동의 기록을 쓸 수 있습니다.
drop policy if exists consent_record_insert on consent_record;
drop policy if exists consent_record_update on consent_record;
