-- 0028에서 대표단 자체 일정 등록(PX-11)을 추가하면서, program 테이블의 INSERT 정책은
-- 이미 대리인의 SELF_SCHEDULED 등록을 허용하도록 되어 있었지만(0020) program_attendance
-- INSERT 정책은 PCO 전용으로 남아 있었습니다 — CLAUDE.md 주의점 (3): 새 역할에게 테이블
-- 접근을 허용할 땐 관련 테이블 전부에 정책을 빠짐없이 걸 것. E2E 검증 중 발견.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

drop policy if exists program_attendance_insert on program_attendance;
create policy program_attendance_insert on program_attendance for insert
  with check (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or exists (
      select 1 from participant pt
      join program p on p.id = program_attendance.program_id
      where pt.id = program_attendance.participant_id
        and is_active_proxy(pt.delegation_id)
        and p.program_type = 'SELF_SCHEDULED'
        and p.organizer_delegation_id = pt.delegation_id
    )
  );
