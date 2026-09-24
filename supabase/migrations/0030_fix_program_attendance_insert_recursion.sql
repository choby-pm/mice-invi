-- 0029에서 추가한 program_attendance_insert 정책이 정책 본문 안에서 program 테이블을
-- 직접 조인해 program_select 정책(→ is_program_visible_to_proxy, SQL 함수라 인라인될 수
-- 있음)을 다시 타면서 "infinite recursion detected in policy for relation
-- program_attendance" (42P17)로 막힘. plpgsql SECURITY DEFINER 함수로 감싸면 플래너가
-- 인라인하지 않아 오너 권한으로 안전하게 우회됨(CLAUDE.md 주의점 (4)와 같은 종류의 함정,
-- 이번엔 SQL 함수 인라이닝이 추가 원인).
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function is_self_scheduled_program_organizer(p_program_id uuid, p_delegation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_organizer_delegation_id uuid;
  v_program_type text;
begin
  select organizer_delegation_id, program_type into v_organizer_delegation_id, v_program_type
  from program where id = p_program_id;
  return v_program_type = 'SELF_SCHEDULED' and v_organizer_delegation_id = p_delegation_id;
end;
$$;

drop policy if exists program_attendance_insert on program_attendance;
create policy program_attendance_insert on program_attendance for insert
  with check (
    coalesce(current_tenant_role(tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    or exists (
      select 1 from participant pt
      where pt.id = program_attendance.participant_id
        and is_active_proxy(pt.delegation_id)
        and is_self_scheduled_program_organizer(program_attendance.program_id, pt.delegation_id)
    )
  );
