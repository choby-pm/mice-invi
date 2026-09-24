-- R4: 조정 항목 담당 업체 재배정 (02 §3.5 PCO-E03 "담당 변경"). PCO 전용 — 새 담당 업체가
-- 그 서비스 유형을 실제로 맡고 있는 업체인지 함수 안에서 검증합니다(엉뚱한 업체에 배정 방지).
-- 재배정하면 처리 상태를 조치 필요로 되돌립니다 — 새 담당자는 확인부터 다시 해야 하므로.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function reassign_adjustment_item(p_item_id uuid, p_new_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_event_id uuid;
  v_service_type text;
  v_status text;
  v_valid_vendor boolean;
begin
  select ci.tenant_id, si.event_id, si.service_type, ai.status
    into v_tenant_id, v_event_id, v_service_type, v_status
  from adjustment_item ai
  join change_issue ci on ci.id = ai.issue_id
  left join service_item si on si.id = ai.service_item_id
  where ai.id = p_item_id;

  if v_tenant_id is null then
    raise exception 'adjustment item not found';
  end if;
  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') then
    raise exception 'not authorized';
  end if;
  if v_status not in ('ACTION_REQUIRED', 'IN_PROGRESS') then
    raise exception 'cannot reassign item in status %', v_status;
  end if;

  select exists (
    select 1 from event_vendor ev
    where ev.event_id = v_event_id and ev.vendor_id = p_new_vendor_id and v_service_type = any(ev.service_types)
  ) into v_valid_vendor;
  if not v_valid_vendor then
    raise exception 'vendor is not assigned to this service type for this event';
  end if;

  update adjustment_item set assignee_vendor_id = p_new_vendor_id, status = 'ACTION_REQUIRED' where id = p_item_id;
end;
$$;
