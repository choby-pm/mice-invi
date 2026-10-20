-- 항공 업무에 배정된 활성 업체만 발권 필드를 열람합니다. 민감정보 전체 조회 권한은 주지 않습니다.
create function read_flight_booking_identity(p_service_item_id uuid)
returns table (
  participant_id uuid, first_name text, last_name text, birth_date date, gender text, nationality text,
  passport_no text, passport_country text, passport_expiry text, passport_status text
)
language plpgsql security definer set search_path=public,extensions as $$
declare
  v_item service_item; v_person record; v_key text; v_policy consent_policy;
  v_consented boolean; v_available boolean;
begin
  select * into v_item from service_item si where si.id=p_service_item_id and si.service_type='FLIGHT'
    and si.status in ('REQUESTED','IN_PROGRESS','CHANGING','CONFIRMED','NOTIFIED','CANCEL_REQ');
  if v_item.id is null or not is_event_vendor_of_mine(v_item.event_vendor_id) then
    raise exception 'flight service not found';
  end if;
  select * into v_policy from consent_policy cp where cp.event_id=v_item.event_id and cp.is_current and cp.published_at is not null;
  select encode(ek.key_material,'hex') into v_key from event_encryption_key ek where ek.event_id=v_item.event_id;
  for v_person in
    select p.id,p.first_name,p.last_name,p.birth_date,p.gender,p.nationality,
      ps.passport_no,ps.passport_country,ps.passport_expiry,ps.purge_status
    from participant p left join participant_sensitive ps on ps.participant_id=p.id
    where p.delegation_id=v_item.delegation_id and p.status <> 'CANCELLED' order by p.sort_order,p.id
  loop
    v_consented := v_policy.id is not null and exists(select 1 from consent_item ci where ci.policy_id=v_policy.id and ci.category='UNIQUE_ID')
      and not exists(select 1 from consent_item ci where ci.policy_id=v_policy.id and ci.category='UNIQUE_ID'
        and not exists(select 1 from consent_record cr where cr.item_id=ci.id and cr.participant_id=v_person.id
          and cr.agreed and cr.status='VALID' and cr.policy_version=v_policy.version));
    v_available := v_consented and v_person.purge_status='ACTIVE' and v_key is not null;
    insert into sensitive_access_log(tenant_id,participant_id,actor_user_id,fields)
      values(v_item.tenant_id,v_person.id,auth.uid(),
        array['first_name','last_name','birth_date','gender','nationality'] ||
        case when v_available then array['passport_no','passport_country','passport_expiry'] else '{}'::text[] end);
    return query select v_person.id,v_person.first_name,v_person.last_name,v_person.birth_date,v_person.gender,v_person.nationality,
      case when v_available and v_person.passport_no is not null then pgp_sym_decrypt(v_person.passport_no,v_key) end,
      case when v_available and v_person.passport_country is not null then pgp_sym_decrypt(v_person.passport_country,v_key) end,
      case when v_available and v_person.passport_expiry is not null then pgp_sym_decrypt(v_person.passport_expiry,v_key) end,
      case when v_person.purge_status='PURGED' then 'PURGED' when not v_consented then 'CONSENT_REQUIRED'
        when not coalesce(v_available,false) or v_person.passport_no is null then 'MISSING' else 'AVAILABLE' end;
  end loop;
end; $$;
revoke execute on function read_flight_booking_identity(uuid) from public,anon;
grant execute on function read_flight_booking_identity(uuid) to authenticated;
