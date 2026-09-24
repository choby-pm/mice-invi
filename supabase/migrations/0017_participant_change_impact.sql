-- R4: 참가자 추가·삭제 영향 규칙 (IR-08 — "참가자 추가·삭제 → 항공/숙박/수송/식음/공항 의전
-- 인원 반영", BR-05-4). 0016과 같은 패턴: SECURITY DEFINER 함수가 호출자 권한을 직접
-- 검사한 뒤 이미 처리중 이상인 서비스에 조정 항목을 만듭니다. 참가자 삭제는 이번이 처음
-- 생기는 기능이라, 삭제되는 참가자를 참조하던 room_assignment/vehicle_dispatch/
-- transfer_request의 참가자 목록도 같이 정리합니다(끊어진 참조 방지).
-- 이 규칙은 항공편 재확정(0016)과 달리 "재변경 시 대체" 로직을 넣지 않았습니다 — 참가자
-- 추가·삭제는 짧은 시간에 반복되는 값 변경(도착 시각 등)과 달리 매번 별개의 실사건이라,
-- 이슈를 대체하기보다 각각 남기는 편이 감사 추적에 맞다고 판단했습니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function evaluate_participant_change_impact(
  p_delegation_id uuid,
  p_participant_id uuid,
  p_participant_name text,
  p_kind text -- 'ADDED' | 'REMOVED'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_event_id uuid;
  v_actor uuid := auth.uid();
  v_source text;
  v_issue_id uuid;
  v_issue_no text;
  v_summary text;
  v_max_urgency text := 'NORMAL';
  v_target record;
  v_urgency text;
  v_instruction text;
begin
  select tenant_id, event_id into v_tenant_id, v_event_id from delegation where id = p_delegation_id;
  if v_tenant_id is null then
    raise exception 'delegation not found';
  end if;

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER')
     and not is_active_proxy(p_delegation_id) then
    raise exception 'not authorized';
  end if;

  if p_kind = 'REMOVED' then
    update room_assignment set participant_ids = array_remove(participant_ids, p_participant_id)
      where service_item_id in (select id from service_item where delegation_id = p_delegation_id and service_type = 'LODGING');
    update vehicle_dispatch set participant_ids = array_remove(participant_ids, p_participant_id)
      where service_item_id in (select id from service_item where delegation_id = p_delegation_id and service_type = 'TRANSFER');
    update transfer_request set participant_ids = array_remove(participant_ids, p_participant_id)
      where service_item_id in (select id from service_item where delegation_id = p_delegation_id and service_type = 'TRANSFER');
  end if;

  v_source := case when coalesce(current_tenant_role(v_tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') then 'PCO' else 'PROXY' end;
  v_summary := case when p_kind = 'ADDED' then '참가자 추가: ' || p_participant_name else '참가자 삭제: ' || p_participant_name end;

  v_issue_id := null;

  for v_target in
    select id, service_type, status, scheduled_at
    from service_item
    where delegation_id = p_delegation_id
      and service_type in ('FLIGHT', 'LODGING', 'TRANSFER', 'DIETARY', 'AIRPORT')
      and status in ('IN_PROGRESS', 'CONFIRMED', 'NOTIFIED', 'CHANGING')
  loop
    if v_issue_id is null then
      select 'CHG-' || lpad((count(*) + 1)::text, 4, '0') into v_issue_no from change_issue where event_id = v_event_id;
      insert into change_issue (tenant_id, event_id, delegation_id, issue_no, source, source_user_id, summary, status)
      values (v_tenant_id, v_event_id, p_delegation_id, v_issue_no, v_source, v_actor, v_summary, 'OPEN')
      returning id into v_issue_id;
    end if;

    v_urgency := case
      when v_target.scheduled_at is null then 'NORMAL'
      when v_target.scheduled_at <= now() + interval '24 hours' then 'URGENT'
      when v_target.scheduled_at <= now() + interval '72 hours' then 'CAUTION'
      else 'NORMAL'
    end;
    v_instruction := case v_target.service_type
      when 'FLIGHT' then '탑승 인원 변경 반영 필요'
      when 'LODGING' then '객실 인원 구성 재검토 필요'
      when 'TRANSFER' then '탑승 인원 변경 반영 필요'
      when 'DIETARY' then '식수 인원 변경 반영 필요'
      when 'AIRPORT' then '의전 인원 변경 반영 필요'
    end;

    insert into adjustment_item (issue_id, depth, impact_rule_code, kind, service_item_id, assignee_vendor_id, instruction, urgency, due_at, status)
    values (
      v_issue_id, 1, 'IR-08', 'AUTO', v_target.id,
      (select vendor_id from event_vendor where id = (select event_vendor_id from service_item where id = v_target.id)),
      v_instruction, v_urgency, v_target.scheduled_at, 'ACTION_REQUIRED'
    );

    if v_urgency = 'URGENT' then v_max_urgency := 'URGENT';
    elsif v_urgency = 'CAUTION' and v_max_urgency <> 'URGENT' then v_max_urgency := 'CAUTION';
    end if;
  end loop;

  if v_issue_id is not null then
    update change_issue set max_urgency = v_max_urgency where id = v_issue_id;
  end if;

  return v_issue_id;
end;
$$;
