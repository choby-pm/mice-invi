create or replace function guard_service_detail_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item service_item; v_data jsonb := to_jsonb(new); v_ids uuid[];
begin
  select * into v_item from service_item where id = new.service_item_id;
  if v_item.id is null or v_item.service_type <> TG_ARGV[0] then raise exception 'invalid service detail type'; end if;
  if TG_OP = 'UPDATE' and new.service_item_id is distinct from old.service_item_id then raise exception 'detail scope is immutable'; end if;
  if v_data ? 'participant_ids' then
    select array_agg(value::uuid) into v_ids from jsonb_array_elements_text(v_data->'participant_ids');
  elsif v_data ? 'participant_id' then v_ids := array[(v_data->>'participant_id')::uuid];
  end if;
  if exists(select 1 from unnest(v_ids) x where not exists(select 1 from participant p where p.id = x and p.delegation_id = v_item.delegation_id)) then
    raise exception 'participant outside delegation';
  end if;
  if auth.uid() is not null and auth.role() <> 'service_role' and v_item.status in ('CANCEL_REQ','CANCELLED','NOT_APPLICABLE') then
    raise exception 'service is cancelled or excluded';
  end if;
  return new;
end;
$$;
create trigger flight_request_scope before insert or update on flight_request for each row execute function guard_service_detail_scope('FLIGHT');
create trigger flight_segment_scope before insert or update on flight_segment for each row execute function guard_service_detail_scope('FLIGHT');
create trigger lodging_request_scope before insert or update on lodging_request for each row execute function guard_service_detail_scope('LODGING');
create trigger room_assignment_scope before insert or update on room_assignment for each row execute function guard_service_detail_scope('LODGING');
create trigger transfer_request_scope before insert or update on transfer_request for each row execute function guard_service_detail_scope('TRANSFER');
create trigger vehicle_dispatch_scope before insert or update on vehicle_dispatch for each row execute function guard_service_detail_scope('TRANSFER');
create trigger airport_request_scope before insert or update on airport_request for each row execute function guard_service_detail_scope('AIRPORT');
create trigger airport_assignment_scope before insert or update on airport_assignment for each row execute function guard_service_detail_scope('AIRPORT');
create trigger dietary_requirement_scope before insert or update on dietary_requirement for each row execute function guard_service_detail_scope('DIETARY');
