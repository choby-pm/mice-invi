-- R5 정정: program/program_attendance 정책을 확실하게 다시 겁니다.
-- 0020을 여러 번 재실행하는 과정에서(파일이 중간에 지워졌다 다시 만들어지는 일이 있었음)
-- Postgres의 create policy는 같은 이름으로 두 번 실행하면 에러가 나며 멈추는 명령이라,
-- 지금 DB에 걸려 있는 정책이 의도와 다를 수 있습니다 — drop 후 다시 만들어 확실히 맞춥니다.
-- 실제로 "대리인 자체 일정 등록"이 RLS에 막히는 버그를 테스트로 확인했습니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

drop policy if exists program_select on program;
create policy program_select on program for select
  using (
    coalesce(current_tenant_role(tenant_id), '') <> '' or is_program_visible_to_proxy(id)
  );

drop policy if exists program_insert on program;
create policy program_insert on program for insert
  with check (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or (
      registered_by_type = 'PROXY' and program_type = 'SELF_SCHEDULED'
      and organizer_delegation_id is not null and is_active_proxy(organizer_delegation_id)
    )
  );

drop policy if exists program_update on program;
create policy program_update on program for update
  using (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or (registered_by_type = 'PROXY' and organizer_delegation_id is not null and is_active_proxy(organizer_delegation_id))
  );

drop policy if exists program_delete on program;
create policy program_delete on program for delete
  using (coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER'));

drop policy if exists program_attendance_select on program_attendance;
create policy program_attendance_select on program_attendance for select
  using (
    coalesce(current_tenant_role(tenant_id), '') <> ''
    or exists (select 1 from participant pt where pt.id = program_attendance.participant_id and is_active_proxy(pt.delegation_id))
  );

drop policy if exists program_attendance_insert on program_attendance;
create policy program_attendance_insert on program_attendance for insert
  with check (coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER'));

drop policy if exists program_attendance_update on program_attendance;
create policy program_attendance_update on program_attendance for update
  using (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or exists (select 1 from participant pt where pt.id = program_attendance.participant_id and is_active_proxy(pt.delegation_id))
  );

drop policy if exists program_attendance_delete on program_attendance;
create policy program_attendance_delete on program_attendance for delete
  using (coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER'));
