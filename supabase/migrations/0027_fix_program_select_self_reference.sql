-- R5 정정(진짜 원인): program_select 정책이 is_program_visible_to_proxy() 함수를 통해
-- program 테이블 "자기 자신"을 id로 다시 조회하고 있었습니다. INSERT ... RETURNING 안에서는
-- 이런 자기 참조 재조회가 방금 삽입한 행을 못 찾을 수 있어서(같은 문장 안 스냅샷 문제),
-- 대리인이 자체 일정을 등록한 직후 RETURNING이 실패하며 "new row violates row-level
-- security policy"로 나타났습니다 — 진단 함수 여러 개로 재현해서 확인했습니다.
-- 해결: 함수로 감싸지 않고, 정책 안에서 그 행 자신의 컬럼(visibility 등)을 직접 씁니다 —
-- program 테이블을 다시 조회하지 않고, event_vendor/program_attendance 같은 "다른" 테이블만
-- 서브쿼리로 참조하므로 이 문제가 생기지 않습니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

drop policy if exists program_select on program;
create policy program_select on program for select
  using (
    coalesce(current_tenant_role(tenant_id), '') <> ''
    or (
      visibility = 'PUBLIC'
      and exists (select 1 from delegation d where d.event_id = program.event_id and is_active_proxy(d.id))
    )
    or (
      visibility = 'STAKEHOLDER'
      and (
        (organizer_delegation_id is not null and is_active_proxy(organizer_delegation_id))
        or exists (
          select 1 from program_attendance pa
          join participant pt on pt.id = pa.participant_id
          where pa.program_id = program.id and is_active_proxy(pt.delegation_id)
        )
      )
    )
  );

-- 더 이상 안 씁니다 — program_select가 자기 참조 없이 직접 판정하도록 바뀌었습니다.
drop function if exists is_program_visible_to_proxy(uuid);

-- 진단용으로 잠깐 만들었던 함수들 정리(스키마 내부 정보를 아무나 rpc로 볼 수 있던 것도 같이 제거).
drop function if exists diag_show_program_insert_policy();
drop function if exists diag_eval_program_insert_check(uuid, text, text, uuid);
drop function if exists diag_list_program_policies();
drop function if exists diag_show_function_def(text);
