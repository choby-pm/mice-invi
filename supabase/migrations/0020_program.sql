-- R5 시작: 하위 행사(Program) 관리 1차 (01 §P02-C, §S12~S13).
-- 이번 1차는 PCO가 만드는 공식 하위 행사(생성 → 참석자 지정 → 가안→확정 → 취소)와
-- 대리인의 참석 회신까지만 다룹니다. 대표단 자체 일정 등록(BR-02C-9~15, 차량 자동 판정
-- 포함)과 확정 시 수송 자동 생성(BR-02C-8)·변경 이슈 연동(IR-13~16)은 다음 조각입니다.
--
-- 핵심 규칙(BR-02C-3): 공개 범위 밖의 사용자에게는 하위 행사가 "존재한다는 사실 자체가"
-- 안 보여야 합니다 — 권한·테넌트 격리 위험 영역과 같은 무게로 다루고, 테스트를 먼저
-- 작성했습니다(tests/program-visibility.test.ts).
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists program (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  event_id uuid not null references event(id) on delete cascade,
  parent_program_id uuid references program(id) on delete cascade,
  name text not null,
  program_type text not null check (program_type in (
    'PLENARY', 'BANQUET', 'BILATERAL', 'DELEGATION_HOSTED', 'COMPANION', 'PROTOCOL', 'SELF_SCHEDULED'
  )),
  organizer_type text not null check (organizer_type in ('HOST', 'DELEGATION', 'PCO')),
  organizer_delegation_id uuid references delegation(id),
  registered_by_type text not null default 'PCO' check (registered_by_type in ('PCO', 'PROXY')),
  transfer_needed boolean,
  late_registration boolean not null default false,
  pco_adjust_note text,
  start_at timestamptz,
  end_at timestamptz,
  venue text,
  venue_address text,
  visibility text not null default 'STAKEHOLDER' check (visibility in ('PUBLIC', 'STAKEHOLDER', 'PRIVATE')),
  audience_mode text not null default 'SPECIFIC_PARTICIPANTS' check (audience_mode in (
    'ALL_DELEGATIONS', 'SPECIFIC_DELEGATIONS', 'SPECIFIC_PARTICIPANTS'
  )),
  external_headcount int,
  dress_code text,
  status text not null default 'TENTATIVE' check (status in ('TENTATIVE', 'CONFIRMED', 'DONE', 'CANCELLED')),
  internal_note text,
  created_at timestamptz not null default now()
);
alter table program enable row level security;

create table if not exists program_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  program_id uuid not null references program(id) on delete cascade,
  participant_id uuid not null references participant(id) on delete cascade,
  role text not null default 'ATTENDEE' check (role in ('HOST', 'SPEAKER', 'ATTENDEE', 'STAFF_SUPPORT', 'SPECIAL_EVENT')),
  role_note text,
  status text not null default 'INVITED' check (status in ('INVITED', 'CONFIRMED', 'DECLINED')),
  created_at timestamptz not null default now(),
  unique (program_id, participant_id)
);
alter table program_attendance enable row level security;

-- BR-02C-3: 공개 범위 판정을 한 곳에서. 대리인이 program/program_attendance 양쪽의
-- 서로 다른 정책에서 참조해야 해서 SECURITY DEFINER로 감싸 0012류 함정을 피합니다.
create or replace function is_program_visible_to_proxy(target_program_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case p.visibility
    when 'PRIVATE' then false
    when 'PUBLIC' then exists (
      select 1 from delegation d where d.event_id = p.event_id and is_active_proxy(d.id)
    )
    when 'STAKEHOLDER' then exists (
      select 1 from program_attendance pa
      join participant pt on pt.id = pa.participant_id
      where pa.program_id = p.id and is_active_proxy(pt.delegation_id)
    )
    else false
  end
  from program p where p.id = target_program_id;
$$;

create policy program_select on program for select
  using (
    coalesce(current_tenant_role(tenant_id), '') <> '' or is_program_visible_to_proxy(id)
  );

-- 일반 PCO 등록(가안)과 대리인 자체 일정 등록(곧바로 확정, BR-02C-9)만 허용 — 대리인이
-- 다른 유형을 자기 대표단 명의로 만드는 건 막습니다.
create policy program_insert on program for insert
  with check (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or (
      registered_by_type = 'PROXY' and program_type = 'SELF_SCHEDULED'
      and organizer_delegation_id is not null and is_active_proxy(organizer_delegation_id)
    )
  );

create policy program_update on program for update
  using (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or (registered_by_type = 'PROXY' and organizer_delegation_id is not null and is_active_proxy(organizer_delegation_id))
  );

create policy program_delete on program for delete
  using (coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER'));

-- program_attendance: PCO는 전부, 대리인은 자기 대표단 참가자 행만(매트릭스 "RU 자기 대표단").
create policy program_attendance_select on program_attendance for select
  using (
    coalesce(current_tenant_role(tenant_id), '') <> ''
    or exists (select 1 from participant pt where pt.id = program_attendance.participant_id and is_active_proxy(pt.delegation_id))
  );

create policy program_attendance_insert on program_attendance for insert
  with check (coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER'));

create policy program_attendance_update on program_attendance for update
  using (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or exists (select 1 from participant pt where pt.id = program_attendance.participant_id and is_active_proxy(pt.delegation_id))
  );

create policy program_attendance_delete on program_attendance for delete
  using (coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER'));

-- 가안→확정, 확정 후 수정/취소를 여기서 한 함수로 처리(상태 직접 수정 금지 원칙, 03 §2.1).
-- 이번 1차는 수송 자동 생성·변경 이슈 연동은 안 하고 상태 전이만 다룹니다(다음 조각에서 확장).
create or replace function confirm_program(p_program_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from program where id = p_program_id;
  if v_tenant_id is null then raise exception 'program not found'; end if;
  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') then
    raise exception 'not authorized';
  end if;
  update program set status = 'CONFIRMED' where id = p_program_id and status = 'TENTATIVE';
end;
$$;

create or replace function cancel_program(p_program_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from program where id = p_program_id;
  if v_tenant_id is null then raise exception 'program not found'; end if;
  if coalesce(current_tenant_role(v_tenant_id), '') not in ('PCO_ADMIN', 'PCO_MANAGER') then
    raise exception 'not authorized';
  end if;
  update program set status = 'CANCELLED' where id = p_program_id and status in ('TENTATIVE', 'CONFIRMED');
end;
$$;
