-- 서비스 변경과 안내를 같은 트랜잭션으로 기록합니다. 예약 상세/민감정보는 복제하지 않습니다.
create table service_update (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null references service_item(id) on delete cascade,
  kind text not null check (kind in ('REQUEST','CONFIRMED','STATUS','ASSIGNED')),
  before_text text,
  after_text text,
  vendor_ack_at timestamptz,
  created_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '24 hours'
);
create index service_update_item_time on service_update(service_item_id, created_at desc);
alter table service_update enable row level security;
create policy service_update_select on service_update for select using
  (exists(select 1 from service_item si where si.id = service_item_id));
create table service_update_receipt (
  update_id uuid not null references service_update(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key(update_id,user_id)
);
alter table service_update_receipt enable row level security;
create policy update_receipt_select on service_update_receipt for select using (user_id = auth.uid());
create policy update_receipt_insert on service_update_receipt for insert with check
  (user_id = auth.uid() and exists(select 1 from service_update u where u.id = update_id));

create or replace function acknowledge_service_update_vendor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update service_update u set vendor_ack_at = coalesce(u.vendor_ack_at, new.acknowledged_at)
    from service_item si where u.id = new.update_id and si.id = u.service_item_id
    and exists(select 1 from event_vendor ev join vendor_member vm on vm.vendor_id = ev.vendor_id
      where ev.id = si.event_vendor_id and vm.user_id = new.user_id);
  return new;
end;
$$;
create trigger update_vendor_receipt after insert on service_update_receipt for each row execute function acknowledge_service_update_vendor();

create or replace function record_service_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.note is distinct from new.note then
    insert into service_update(service_item_id,kind,before_text,after_text)
      values(new.id,'REQUEST',old.note,new.note);
  end if;
  if old.confirmed_at is distinct from new.confirmed_at and new.confirmed_at is not null then
    insert into service_update(service_item_id,kind,before_text,after_text)
      values(new.id,'CONFIRMED',old.confirmation_note,new.confirmation_note);
  elsif old.status is distinct from new.status then
    insert into service_update(service_item_id,kind,before_text,after_text)
      values(new.id,'STATUS',old.status,new.status);
  end if;
  if old.event_vendor_id is distinct from new.event_vendor_id then
    insert into service_update(service_item_id,kind,after_text) values(new.id,'ASSIGNED','담당 업체가 변경되었습니다. 요청과 미처리 업무를 확인해 주세요.');
  end if;
  return new;
end;
$$;
create trigger service_update_log after update on service_item for each row execute function record_service_update();

-- 세부 희망 조건만 바뀌어 요약이 같아도 담당 업체가 놓치지 않게 기록합니다.
create or replace function record_request_detail_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_before text; v_after text;
begin
  if TG_OP = 'UPDATE' then
    v_before := (to_jsonb(old) - array['id','service_item_id','updated_at','created_at'])::text;
  end if;
  v_after := (to_jsonb(new) - array['id','service_item_id','updated_at','created_at'])::text;
  if v_before is distinct from v_after then
    insert into service_update(service_item_id,kind,before_text,after_text)
      values(new.service_item_id,'REQUEST',v_before,v_after);
  end if;
  return new;
end;
$$;
create trigger flight_request_updates after insert or update on flight_request for each row execute function record_request_detail_update();
create trigger lodging_request_updates after insert or update on lodging_request for each row execute function record_request_detail_update();
create trigger airport_request_updates after insert or update on airport_request for each row execute function record_request_detail_update();

-- 불참은 기존 예약을 지우지 않고 업체의 취소 확인 대상으로 넘깁니다.
create or replace function request_declined_cancellations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rsvp = 'DECLINED' and old.rsvp is distinct from new.rsvp then
    update service_item set status = 'CANCEL_REQ' where delegation_id = new.id
      and status not in ('CANCEL_REQ','CANCELLED','NOT_APPLICABLE');
  end if;
  return new;
end;
$$;
create trigger delegation_cancellations after update of rsvp on delegation for each row execute function request_declined_cancellations();
