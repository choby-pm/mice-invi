alter table event_vendor add column settled_at timestamptz;
alter table event_vendor add column settlement_note text;
create or replace function is_event_vendor_of_mine(target_event_vendor_id uuid)
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from event_vendor ev where ev.id=target_event_vendor_id and ev.settled_at is null and is_vendor_member(ev.vendor_id));
$$;
create or replace function is_vendor_of_event(target_event_id uuid)
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from event_vendor ev where ev.event_id=target_event_id and ev.settled_at is null and is_vendor_member(ev.vendor_id));
$$;
create or replace function can_access_vendor_adjustment(target_item_id uuid)
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from adjustment_item ai join change_issue ci on ci.id=ai.issue_id
    join event_vendor ev on ev.event_id=ci.event_id and ev.vendor_id=ai.assignee_vendor_id
    where ai.id=target_item_id and ev.settled_at is null and is_vendor_member(ev.vendor_id));
$$;
create or replace function is_vendor_assigned_in_issue(target_issue_id uuid)
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from adjustment_item ai where ai.issue_id=target_issue_id and can_access_vendor_adjustment(ai.id));
$$;
drop policy if exists change_issue_select on change_issue;
create policy change_issue_select on change_issue for select using
  (coalesce(current_tenant_role(tenant_id),'') <> '' or is_vendor_assigned_in_issue(id));
drop policy if exists adjustment_item_select on adjustment_item;
create policy adjustment_item_select on adjustment_item for select using
  (exists(select 1 from change_issue ci where ci.id=issue_id and coalesce(current_tenant_role(ci.tenant_id),'') <> '') or can_access_vendor_adjustment(id));

alter function acknowledge_adjustment_item(uuid) rename to acknowledge_adjustment_item_internal;
revoke execute on function acknowledge_adjustment_item_internal(uuid) from public,anon,authenticated;
alter function complete_adjustment_item(uuid,text,boolean) rename to complete_adjustment_item_internal;
revoke execute on function complete_adjustment_item_internal(uuid,text,boolean) from public,anon,authenticated;
create or replace function assert_adjustment_access(p_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from adjustment_item ai join change_issue ci on ci.id=ai.issue_id where ai.id=p_item_id
    and coalesce(current_tenant_role(ci.tenant_id),'') in ('PCO_ADMIN','PCO_MANAGER')) and not can_access_vendor_adjustment(p_item_id) then
    raise exception 'not authorized';
  end if;
end; $$;
create function acknowledge_adjustment_item(p_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$ begin
  perform assert_adjustment_access(p_item_id); perform acknowledge_adjustment_item_internal(p_item_id);
end; $$;
create function complete_adjustment_item(p_item_id uuid,p_resolution_note text,p_value_changed boolean)
returns void language plpgsql security definer set search_path=public as $$ begin
  perform assert_adjustment_access(p_item_id); perform complete_adjustment_item_internal(p_item_id,p_resolution_note,p_value_changed);
end; $$;

create function set_vendor_settlement(p_event_vendor_id uuid,p_settled boolean,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare v_ev event_vendor;
begin
  select * into v_ev from event_vendor where id=p_event_vendor_id for update;
  if v_ev.id is null or coalesce(current_tenant_role(v_ev.tenant_id),'') not in ('PCO_ADMIN','PCO_MANAGER') then raise exception 'not authorized';end if;
  if nullif(trim(p_note),'') is null or length(p_note)>2000 then raise exception 'reason required';end if;
  if p_settled and (exists(select 1 from service_item where event_vendor_id=v_ev.id and status not in ('CONFIRMED','NOTIFIED','CANCELLED','NOT_APPLICABLE'))
    or exists(select 1 from adjustment_item ai join change_issue ci on ci.id=ai.issue_id where ci.event_id=v_ev.event_id and ai.assignee_vendor_id=v_ev.vendor_id and ai.status not in ('DONE','NOT_APPLICABLE','VOID'))) then
    raise exception 'unfinished services or adjustments';end if;
  update event_vendor set settled_at=case when p_settled then now() else null end,settlement_note=p_note where id=v_ev.id;
  insert into audit_log(tenant_id,actor_user_id,action,entity_type,entity_id,detail)
    values(v_ev.tenant_id,auth.uid(),case when p_settled then 'vendor.settled' else 'vendor.reopened' end,'event_vendor',v_ev.id,jsonb_build_object('note',p_note));
end; $$;
