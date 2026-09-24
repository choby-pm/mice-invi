-- R5: 대표단 자체 일정 등록 (01 §BR-02C-9~15, PX-11). 차량 지원 여부 판정은 아직
-- "지원 정책 관리" 화면이 없어서(스키마만 있고 UI 없음) 의뢰인 결정대로 이번엔 "일단 항상
-- 지원"으로 단순화합니다 — 나중에 지원 정책 화면이 생기면 여기 함수 안의 판정 로직만
-- 바꾸면 됩니다. 일정 충돌 경고(BR-02C-7)는 이번 범위에서 뺐습니다(다음 조각 후보).
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

alter table transfer_request drop constraint if exists transfer_request_direction_check;
alter table transfer_request add constraint transfer_request_direction_check
  check (direction in ('INBOUND', 'OUTBOUND', 'PROGRAM'));
alter table transfer_request add column if not exists source_program_id uuid references program(id) on delete set null;

-- 자체 일정에서 차량이 필요하면 수송 요청을 자동 생성/갱신합니다(BR-02C-9~11).
-- 항공 확정 때와 같은 패턴(0015 generate_transfer_request)이지만, 방향(입국/귀국) 대신
-- "이 자체 일정"을 키로 삼습니다 — 한 대표단이 자체 일정을 여러 개 만들 수 있어서요.
create or replace function generate_self_scheduled_transfer(
  p_program_id uuid,
  p_participant_ids uuid[]
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
  v_venue text;
  v_start_at timestamptz;
  v_transfer_item_id uuid;
  v_transfer_event_vendor_id uuid;
begin
  select tenant_id, event_id, organizer_delegation_id, venue, start_at
    into v_tenant_id, v_event_id, v_delegation_id, v_venue, v_start_at
  from program where id = p_program_id and program_type = 'SELF_SCHEDULED';

  if v_delegation_id is null then
    raise exception 'self-scheduled program not found';
  end if;

  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER')
     and not is_active_proxy(v_delegation_id) then
    raise exception 'not authorized';
  end if;

  select si.id into v_transfer_item_id
  from service_item si
  join transfer_request tr on tr.service_item_id = si.id
  where tr.source_program_id = p_program_id
  limit 1;

  if v_transfer_item_id is null then
    select ev.id into v_transfer_event_vendor_id
    from event_vendor ev where ev.event_id = v_event_id and 'TRANSFER' = any(ev.service_types)
    limit 1;

    insert into service_item (tenant_id, event_id, delegation_id, service_type, event_vendor_id, status, scheduled_at, note)
    values (v_tenant_id, v_event_id, v_delegation_id, 'TRANSFER', v_transfer_event_vendor_id, 'REQUESTED', v_start_at, '자체 일정 이동 · ' || coalesce(v_venue, '장소 미정'))
    returning id into v_transfer_item_id;
  else
    update service_item set scheduled_at = v_start_at, note = '자체 일정 이동 · ' || coalesce(v_venue, '장소 미정')
    where id = v_transfer_item_id;
  end if;

  insert into transfer_request (service_item_id, direction, from_text, to_text, scheduled_at, participant_ids, source_program_id, updated_at)
  values (v_transfer_item_id, 'PROGRAM', '숙소', coalesce(v_venue, '자체 일정 장소'), v_start_at, p_participant_ids, p_program_id, now())
  on conflict (service_item_id) do update set
    from_text = excluded.from_text, to_text = excluded.to_text, scheduled_at = excluded.scheduled_at,
    participant_ids = excluded.participant_ids, updated_at = now();

  return v_transfer_item_id;
end;
$$;

-- PCO 조정 요청 (BR-02C-14) — PCO는 자체 일정을 직접 수정할 수 없고, 사유만 남겨 대리인에게
-- 전달합니다. pco_adjust_note 한 필드만 바꾸는 전용 함수로 둬서 다른 필드는 못 건드리게 합니다.
create or replace function send_program_adjust_note(p_program_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_program_type text;
begin
  select tenant_id, program_type into v_tenant_id, v_program_type from program where id = p_program_id;
  if v_tenant_id is null then raise exception 'program not found'; end if;
  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') then
    raise exception 'not authorized';
  end if;
  if v_program_type <> 'SELF_SCHEDULED' then
    raise exception 'adjust note is only for self-scheduled programs';
  end if;
  update program set pco_adjust_note = p_note where id = p_program_id;
end;
$$;
