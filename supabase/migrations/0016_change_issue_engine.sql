-- R4: 변경 이슈·영향 엔진 1차 (01 §P11, §S05~S06, 03 §1.5).
-- 이 제품의 기술적 핵심이라 문서가 그리는 전체 그림(설정 가능한 영향 규칙 테이블, 큐 워커,
-- SLA 재알림·에스컬레이션)은 큽니다. 이번 1차는 "엔진이 실제로 동작한다"를 증명하는
-- 세로 한 줄만 구현합니다: 항공 재확정(이미 확정된 항공편이 다시 바뀜) → 수송·숙박·공항
-- 의전 중 이미 처리중 이상인 것에 조정 항목 자동 생성 → 업체/PCO가 확인·완료 → 이슈 자동 종결.
-- 영향 규칙(IR-01~16)은 아직 설정 가능한 테이블이 아니라 이 함수 안에 하드코딩되어 있습니다 —
-- 행사별 on/off나 새 규칙 추가가 필요해지면 그때 impact_rule 테이블로 분리합니다.
-- 재알림·에스컬레이션(BR-11-4)은 알림 시스템 자체가 없어서 이번에는 안 만듭니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists change_issue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  delegation_id uuid not null references delegation(id) on delete cascade,
  issue_no text not null,
  source text not null check (source in ('PROXY', 'VENDOR', 'PCO', 'HOST', 'SYSTEM')),
  source_user_id uuid references auth.users(id),
  origin_service_id uuid references service_item(id) on delete set null,
  summary text not null,
  before jsonb,
  after jsonb,
  supersedes_id uuid references change_issue(id),
  superseded_by_id uuid references change_issue(id),
  max_urgency text not null default 'NORMAL' check (max_urgency in ('URGENT', 'CAUTION', 'NORMAL')),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'CLOSED', 'SUPERSEDED', 'FORCE_CLOSED')),
  closed_at timestamptz,
  force_close_reason text,
  created_at timestamptz not null default now(),
  unique (event_id, issue_no)
);
alter table change_issue enable row level security;

create table if not exists adjustment_item (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references change_issue(id) on delete cascade,
  parent_id uuid references adjustment_item(id) on delete cascade,
  depth int not null default 1,
  impact_rule_code text,
  kind text not null default 'AUTO' check (kind in ('AUTO', 'PCO_DECISION', 'PCO_CORRECTION', 'MANUAL')),
  service_item_id uuid references service_item(id) on delete set null,
  assignee_vendor_id uuid references vendor(id),
  assignee_user_id uuid references auth.users(id),
  instruction text not null,
  urgency text not null default 'NORMAL' check (urgency in ('URGENT', 'CAUTION', 'NORMAL')),
  due_at timestamptz,
  status text not null default 'ACTION_REQUIRED' check (status in ('WAITING', 'ACTION_REQUIRED', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE', 'VOID')),
  decision text,
  resolution_note text,
  value_changed boolean,
  close_reason text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  reminder_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table adjustment_item enable row level security;

-- 업체가 이 이슈 안의 자기 배정 항목이 있는지는 adjustment_item을 직접 들여다봐야 판단되는데,
-- change_issue 정책 안에서 adjustment_item을 직접 서브쿼리로 참조하면 0012에서 겪었던 것과
-- 같은 함정(서로 다른 테이블의 RLS가 얽힘)에 빠집니다 — SECURITY DEFINER로 감쌉니다.
create or replace function is_vendor_assigned_in_issue(target_issue_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from adjustment_item ai
    where ai.issue_id = target_issue_id and ai.assignee_vendor_id is not null and is_vendor_member(ai.assignee_vendor_id)
  );
$$;

create policy change_issue_select on change_issue for select
  using (
    coalesce(current_tenant_role(tenant_id), '') <> '' or is_active_proxy(delegation_id) or is_vendor_assigned_in_issue(id)
  );

-- adjustment_item은 PCO/대리인은 change_issue를 통해(이미 위에서 안전하게 정리된 정책에 얹힘),
-- 업체는 자기 배정 항목만 직접 봅니다 — "RU (배정 항목)" 권한 매트릭스 그대로.
create policy adjustment_item_select on adjustment_item for select
  using (
    exists (
      select 1 from change_issue ci where ci.id = adjustment_item.issue_id
        and (coalesce(current_tenant_role(ci.tenant_id), '') <> '' or is_active_proxy(ci.delegation_id))
    )
    or (assignee_vendor_id is not null and is_vendor_member(assignee_vendor_id))
  );

-- 이 아래 함수들이 실제 쓰기를 전부 담당합니다(participant_sensitive와 같은 패턴 — 직접
-- INSERT/UPDATE 정책은 안 두고, 함수 안에서 호출자 권한을 검사한 뒤 SECURITY DEFINER로
-- 실행). 완료 처리는 업체가 할 수도 있는데 업체는 change_issue를 직접 못 고치므로(종결
-- 자동판정), 이슈 자동 종결까지 함수 하나가 같이 처리해야 합니다.

create or replace function evaluate_flight_change_impact(
  p_flight_service_item_id uuid,
  p_old_inbound_arr_at timestamptz,
  p_old_inbound_arr_airport text,
  p_new_inbound_arr_at timestamptz,
  p_new_inbound_arr_airport text,
  p_old_outbound_dep_at timestamptz,
  p_old_outbound_dep_airport text,
  p_new_outbound_dep_at timestamptz,
  p_new_outbound_dep_airport text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_event_id uuid;
  v_delegation_id uuid;
  v_flight_event_vendor_id uuid;
  v_inbound_changed boolean := false;
  v_outbound_changed boolean := false;
  v_actor uuid := auth.uid();
  v_source text;
  v_issue_id uuid;
  v_issue_no text;
  v_existing_issue_id uuid;
  v_summary text;
  v_max_urgency text := 'NORMAL';
  v_target_count int;
  v_target record;
  v_urgency text;
  v_instruction text;
  v_rule_code text;
begin
  select tenant_id, event_id, delegation_id, event_vendor_id
    into v_tenant_id, v_event_id, v_delegation_id, v_flight_event_vendor_id
  from service_item where id = p_flight_service_item_id and service_type = 'FLIGHT';

  if v_tenant_id is null then
    raise exception 'flight service item not found';
  end if;

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER')
     and not is_event_vendor_of_mine(v_flight_event_vendor_id) then
    raise exception 'not authorized';
  end if;

  -- 처음 확정(재확정 아님)이면 비교 대상이 없으니 이슈를 만들지 않습니다.
  if p_old_inbound_arr_at is not null and p_new_inbound_arr_at is not null
     and (abs(extract(epoch from (p_new_inbound_arr_at - p_old_inbound_arr_at))) >= 1800
          or coalesce(p_old_inbound_arr_airport, '') <> coalesce(p_new_inbound_arr_airport, '')) then
    v_inbound_changed := true;
  end if;
  if p_old_outbound_dep_at is not null and p_new_outbound_dep_at is not null
     and (abs(extract(epoch from (p_new_outbound_dep_at - p_old_outbound_dep_at))) >= 1800
          or coalesce(p_old_outbound_dep_airport, '') <> coalesce(p_new_outbound_dep_airport, '')) then
    v_outbound_changed := true;
  end if;

  if not v_inbound_changed and not v_outbound_changed then
    return null;
  end if;

  -- 영향받을 서비스가 이미 처리중 이상인 것만 셉니다 — 아니면 이력만 남기고 이슈 없음(P11 2단계).
  select count(*) into v_target_count
  from service_item si
  left join transfer_request tr on tr.service_item_id = si.id
  where si.delegation_id = v_delegation_id
    and si.status in ('IN_PROGRESS', 'CONFIRMED', 'NOTIFIED', 'CHANGING')
    and (
      (v_inbound_changed and ((si.service_type = 'TRANSFER' and tr.direction = 'INBOUND') or si.service_type in ('LODGING', 'AIRPORT')))
      or
      (v_outbound_changed and ((si.service_type = 'TRANSFER' and tr.direction = 'OUTBOUND') or si.service_type in ('LODGING', 'AIRPORT')))
    );

  if v_target_count = 0 then
    return null;
  end if;

  -- 같은 항공 항목에서 나온 진행 중 이슈가 있으면 대체합니다(BR-11-1) — 대상이 있을 때만.
  select id into v_existing_issue_id
  from change_issue
  where origin_service_id = p_flight_service_item_id and status in ('OPEN', 'IN_PROGRESS')
  order by created_at desc limit 1;

  if v_existing_issue_id is not null then
    update adjustment_item set status = 'VOID'
      where issue_id = v_existing_issue_id and status in ('WAITING', 'ACTION_REQUIRED', 'IN_PROGRESS');
    update change_issue set status = 'SUPERSEDED' where id = v_existing_issue_id;
  end if;

  v_source := case when coalesce(current_tenant_role(v_tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') then 'PCO' else 'VENDOR' end;
  v_summary := case
    when v_inbound_changed and v_outbound_changed then '입국·귀국 항공편 변경'
    when v_inbound_changed then '입국 도착 변경: ' || coalesce(p_old_inbound_arr_airport, '?') || ' → ' || coalesce(p_new_inbound_arr_airport, '?')
    else '귀국 출발 변경: ' || coalesce(p_old_outbound_dep_airport, '?') || ' → ' || coalesce(p_new_outbound_dep_airport, '?')
  end;

  select 'CHG-' || lpad((count(*) + 1)::text, 4, '0') into v_issue_no from change_issue where event_id = v_event_id;

  insert into change_issue (
    tenant_id, event_id, delegation_id, issue_no, source, source_user_id, origin_service_id,
    summary, before, after, supersedes_id, status
  ) values (
    v_tenant_id, v_event_id, v_delegation_id, v_issue_no, v_source, v_actor, p_flight_service_item_id,
    v_summary,
    jsonb_build_object('inbound_arr_at', p_old_inbound_arr_at, 'inbound_arr_airport', p_old_inbound_arr_airport, 'outbound_dep_at', p_old_outbound_dep_at, 'outbound_dep_airport', p_old_outbound_dep_airport),
    jsonb_build_object('inbound_arr_at', p_new_inbound_arr_at, 'inbound_arr_airport', p_new_inbound_arr_airport, 'outbound_dep_at', p_new_outbound_dep_at, 'outbound_dep_airport', p_new_outbound_dep_airport),
    v_existing_issue_id,
    'OPEN'
  ) returning id into v_issue_id;

  if v_existing_issue_id is not null then
    update change_issue set superseded_by_id = v_issue_id where id = v_existing_issue_id;
  end if;

  for v_target in
    select si.id, si.service_type, si.status, si.event_vendor_id, si.scheduled_at, tr.direction as transfer_direction
    from service_item si
    left join transfer_request tr on tr.service_item_id = si.id
    where si.delegation_id = v_delegation_id
      and si.status in ('IN_PROGRESS', 'CONFIRMED', 'NOTIFIED', 'CHANGING')
      and (
        (v_inbound_changed and ((si.service_type = 'TRANSFER' and tr.direction = 'INBOUND') or si.service_type in ('LODGING', 'AIRPORT')))
        or
        (v_outbound_changed and ((si.service_type = 'TRANSFER' and tr.direction = 'OUTBOUND') or si.service_type in ('LODGING', 'AIRPORT')))
      )
  loop
    v_urgency := case
      when v_target.scheduled_at is null then 'NORMAL'
      when v_target.scheduled_at <= now() + interval '24 hours' then 'URGENT'
      when v_target.scheduled_at <= now() + interval '72 hours' then 'CAUTION'
      else 'NORMAL'
    end;
    v_rule_code := case v_target.service_type when 'TRANSFER' then 'IR-02' when 'LODGING' then 'IR-04' when 'AIRPORT' then 'IR-03' end;
    v_instruction := case v_target.service_type
      when 'TRANSFER' then case when v_target.transfer_direction = 'INBOUND' then '입국 수송 재배차 필요' else '귀국 수송 재배차 필요' end
      when 'LODGING' then case when v_inbound_changed and v_outbound_changed then '체크인/체크아웃 시각 조정 필요'
                                 when v_inbound_changed then '체크인 시각 조정 필요' else '체크아웃 시각 조정 필요' end
      when 'AIRPORT' then case when v_inbound_changed and v_outbound_changed then '입국/출국 의전 재배정 필요'
                                 when v_inbound_changed then '입국 의전 재배정 필요' else '출국 의전 재배정 필요' end
      else '재확인 필요'
    end;

    insert into adjustment_item (
      issue_id, depth, impact_rule_code, kind, service_item_id, assignee_vendor_id, instruction, urgency, due_at, status
    ) values (
      v_issue_id, 1, v_rule_code, 'AUTO', v_target.id,
      (select vendor_id from event_vendor where id = v_target.event_vendor_id),
      v_instruction, v_urgency, v_target.scheduled_at, 'ACTION_REQUIRED'
    );

    if v_urgency = 'URGENT' then v_max_urgency := 'URGENT';
    elsif v_urgency = 'CAUTION' and v_max_urgency <> 'URGENT' then v_max_urgency := 'CAUTION';
    end if;
  end loop;

  update change_issue set max_urgency = v_max_urgency where id = v_issue_id;

  return v_issue_id;
end;
$$;

create or replace function acknowledge_adjustment_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignee_vendor_id uuid;
  v_issue_id uuid;
  v_tenant_id uuid;
begin
  select ai.assignee_vendor_id, ai.issue_id, ci.tenant_id
    into v_assignee_vendor_id, v_issue_id, v_tenant_id
  from adjustment_item ai join change_issue ci on ci.id = ai.issue_id
  where ai.id = p_item_id;

  if v_issue_id is null then raise exception 'adjustment item not found'; end if;

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER')
     and not (v_assignee_vendor_id is not null and is_vendor_member(v_assignee_vendor_id)) then
    raise exception 'not authorized';
  end if;

  update adjustment_item set status = 'IN_PROGRESS' where id = p_item_id and status = 'ACTION_REQUIRED';
  update change_issue set status = 'IN_PROGRESS' where id = v_issue_id and status = 'OPEN';
end;
$$;

create or replace function complete_adjustment_item(p_item_id uuid, p_resolution_note text, p_value_changed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignee_vendor_id uuid;
  v_issue_id uuid;
  v_tenant_id uuid;
  v_open_count int;
begin
  select ai.assignee_vendor_id, ai.issue_id, ci.tenant_id
    into v_assignee_vendor_id, v_issue_id, v_tenant_id
  from adjustment_item ai join change_issue ci on ci.id = ai.issue_id
  where ai.id = p_item_id;

  if v_issue_id is null then raise exception 'adjustment item not found'; end if;

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER')
     and not (v_assignee_vendor_id is not null and is_vendor_member(v_assignee_vendor_id)) then
    raise exception 'not authorized';
  end if;

  update adjustment_item
    set status = 'DONE', resolution_note = p_resolution_note, value_changed = p_value_changed,
        resolved_by = auth.uid(), resolved_at = now()
    where id = p_item_id and status in ('ACTION_REQUIRED', 'IN_PROGRESS');

  select count(*) into v_open_count from adjustment_item
    where issue_id = v_issue_id and status not in ('DONE', 'NOT_APPLICABLE', 'VOID');
  if v_open_count = 0 then
    update change_issue set status = 'CLOSED', closed_at = now() where id = v_issue_id and status in ('OPEN', 'IN_PROGRESS');
  end if;
end;
$$;

create or replace function mark_adjustment_not_applicable(p_item_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue_id uuid;
  v_tenant_id uuid;
  v_open_count int;
begin
  select ai.issue_id, ci.tenant_id into v_issue_id, v_tenant_id
  from adjustment_item ai join change_issue ci on ci.id = ai.issue_id
  where ai.id = p_item_id;

  if v_issue_id is null then raise exception 'adjustment item not found'; end if;

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') then
    raise exception 'not authorized';
  end if;

  update adjustment_item
    set status = 'NOT_APPLICABLE', close_reason = p_reason, resolved_by = auth.uid(), resolved_at = now()
    where id = p_item_id and status in ('ACTION_REQUIRED', 'IN_PROGRESS', 'WAITING');

  select count(*) into v_open_count from adjustment_item
    where issue_id = v_issue_id and status not in ('DONE', 'NOT_APPLICABLE', 'VOID');
  if v_open_count = 0 then
    update change_issue set status = 'CLOSED', closed_at = now() where id = v_issue_id and status in ('OPEN', 'IN_PROGRESS');
  end if;
end;
$$;

create or replace function force_close_change_issue(p_issue_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from change_issue where id = p_issue_id;
  if v_tenant_id is null then raise exception 'issue not found'; end if;
  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') then
    raise exception 'not authorized';
  end if;
  update change_issue set status = 'FORCE_CLOSED', force_close_reason = p_reason, closed_at = now() where id = p_issue_id;
end;
$$;
