-- 여권 원문을 변경함에 복사하지 않고, 담당 항공 업체에 재확인할 일이 생겼음을 알립니다.
create or replace function notify_booking_identity_update()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare v_delegation_id uuid; v_item record; v_key text;
begin
  if TG_TABLE_NAME='participant_sensitive' then
    if new.purge_status <> 'ACTIVE' then return new;end if;
    if TG_OP='UPDATE' and old.passport_no is not distinct from new.passport_no
      and old.passport_country is not distinct from new.passport_country and old.passport_expiry is not distinct from new.passport_expiry then return new;end if;
    select p.delegation_id,encode(ek.key_material,'hex') into v_delegation_id,v_key
      from participant p join delegation d on d.id=p.delegation_id left join event_encryption_key ek on ek.event_id=d.event_id where p.id=new.participant_id;
    -- 같은 원문도 재암호화하면 암호문이 달라지므로, 불필요한 재확인 요청을 막습니다.
    if TG_OP='UPDATE' and v_key is not null and
      array[pgp_sym_decrypt(old.passport_no,v_key),pgp_sym_decrypt(old.passport_country,v_key),pgp_sym_decrypt(old.passport_expiry,v_key)] is not distinct from
      array[pgp_sym_decrypt(new.passport_no,v_key),pgp_sym_decrypt(new.passport_country,v_key),pgp_sym_decrypt(new.passport_expiry,v_key)] then return new;end if;
  else
    if old.first_name is not distinct from new.first_name and old.last_name is not distinct from new.last_name
      and old.nationality is not distinct from new.nationality and old.birth_date is not distinct from new.birth_date and old.gender is not distinct from new.gender then return new;end if;
    v_delegation_id := new.delegation_id;
  end if;
  for v_item in select si.id from service_item si where si.delegation_id=v_delegation_id and si.service_type='FLIGHT'
    and si.status in ('REQUESTED','IN_PROGRESS','CONFIRMED','NOTIFIED','CHANGING','CANCEL_REQ') loop
    update service_item set status='CHANGING' where id=v_item.id and status in ('CONFIRMED','NOTIFIED');
    insert into service_update(service_item_id,kind,after_text) values(v_item.id,'REQUEST','참가자의 발권 기본정보 또는 여권 정보가 갱신되었습니다. 발권용 정보 열람에서 최신 내용을 확인하고 예약 반영 여부를 점검해 주세요.');
  end loop;
  return new;
end;$$;
create trigger passport_booking_updates after insert or update of passport_no,passport_country,passport_expiry on participant_sensitive for each row execute function notify_booking_identity_update();
create trigger participant_booking_updates after update of first_name,last_name,nationality,birth_date,gender on participant for each row execute function notify_booking_identity_update();
