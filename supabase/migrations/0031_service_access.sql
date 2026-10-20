-- 업체는 자신에게 서비스가 배정된 대표단만 조회합니다.
create or replace function is_vendor_of_delegation(target_delegation_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from service_item si where si.delegation_id = target_delegation_id
    and is_event_vendor_of_mine(si.event_vendor_id));
$$;
drop policy if exists delegation_vendor_select on delegation;
create policy delegation_vendor_select on delegation for select using (is_vendor_of_delegation(id));
drop policy if exists participant_vendor_select on participant;
create policy participant_vendor_select on participant for select using (is_vendor_of_delegation(delegation_id));
drop policy if exists service_item_insert on service_item;
create policy service_item_insert on service_item for insert with check
  (coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN','PCO_MANAGER'));

-- 역할별로 같은 행에서 수정할 수 있는 필드를 제한합니다. RLS는 행 범위를 담당합니다.
create or replace function guard_service_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pco boolean; v_vendor boolean; v_proxy boolean;
begin
  if auth.role() = 'service_role' or auth.uid() is null then return new; end if;
  v_pco := coalesce(current_tenant_role(new.tenant_id), '') in ('PCO_ADMIN','PCO_MANAGER');
  select exists(select 1 from delegation d where d.id = new.delegation_id
    and d.event_id = new.event_id and d.tenant_id = new.tenant_id) into v_proxy;
  if not v_proxy then raise exception 'invalid service scope'; end if;
  if TG_OP = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id or new.event_id is distinct from old.event_id
      or new.delegation_id is distinct from old.delegation_id or new.service_type is distinct from old.service_type then
      raise exception 'service scope is immutable';
    end if;
    -- 항공 확정 RPC가 자기 항공에 연결된 수송 요청만 갱신하는 경로입니다.
    if old.service_type = 'TRANSFER' and
      (to_jsonb(new) - array['note','scheduled_at']) = (to_jsonb(old) - array['note','scheduled_at'])
      and exists(select 1 from service_item f where f.delegation_id = old.delegation_id
        and f.service_type = 'FLIGHT' and is_event_vendor_of_mine(f.event_vendor_id)) then return new; end if;
    if not v_pco then
      v_vendor := is_event_vendor_of_mine(old.event_vendor_id);
      v_proxy := is_active_proxy(old.delegation_id);
      if new.event_vendor_id is distinct from old.event_vendor_id or new.support_type is distinct from old.support_type then
        raise exception 'only PCO can assign services';
      end if;
      if v_vendor then
        if new.note is distinct from old.note or new.scheduled_at is distinct from old.scheduled_at then
          raise exception 'vendor cannot change customer requests';
        end if;
      elsif v_proxy then
        if new.confirmation_note is distinct from old.confirmation_note or new.confirmed_at is distinct from old.confirmed_at then
          raise exception 'proxy cannot confirm services';
        end if;
        if new.status is distinct from old.status and not (
          (new.status = 'REQUESTED' and old.status in ('DRAFT','REQUESTED','IN_PROGRESS'))
          or (new.status = 'CHANGING' and old.status in ('CONFIRMED','NOTIFIED','CHANGING'))
          or (new.status = 'CANCEL_REQ' and old.status not in ('CANCELLED','NOT_APPLICABLE'))
        ) then raise exception 'invalid proxy transition'; end if;
      else raise exception 'not authorized'; end if;
    end if;
    if new.status is distinct from old.status and (v_pco or is_event_vendor_of_mine(old.event_vendor_id)) then
      if not ((new.status = 'IN_PROGRESS' and old.status in ('REQUESTED','CHANGING'))
        or (new.status = 'CONFIRMED' and old.status in ('REQUESTED','IN_PROGRESS','CHANGING','CONFIRMED','NOTIFIED'))
        or (new.status = 'CANCELLED' and old.status = 'CANCEL_REQ')
        or (v_pco and new.status in ('DRAFT','REQUESTED','CHANGING','CANCEL_REQ','NOT_APPLICABLE'))) then
        raise exception 'invalid service transition';
      end if;
    end if;
  end if;
  if new.event_vendor_id is not null and not exists(select 1 from event_vendor ev
    where ev.id = new.event_vendor_id and ev.event_id = new.event_id and ev.tenant_id = new.tenant_id
      and new.service_type = any(ev.service_types)) then raise exception 'invalid vendor assignment'; end if;
  return new;
end;
$$;
create trigger service_write_guard before insert or update on service_item for each row execute function guard_service_write();

-- 키는 민감정보 접근 함수 안에서만 사용하며 외부 RPC로 반환하지 않습니다.
revoke execute on function get_event_key(uuid) from public, anon, authenticated;
