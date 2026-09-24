-- R5 정정: STAKEHOLDER(관계자 한정) 공개 범위에 "주관 대표단"이 빠져 있었습니다.
-- BR-02C-15: "관계자는 해당 대표단 대리인, PCO, 주최측, 배차 업체" — 참석자로 등록되었는지와
-- 무관하게 주관 대표단(organizer_delegation_id) 자체는 항상 관계자입니다. 이게 빠져 있어서
-- 대리인이 자체 일정을 막 등록한 직후(아직 참석자를 안 넣은 시점)에는 본인도 그 일정을
-- 못 보는 모순이 생겼고, INSERT 직후 RETURNING이 SELECT 정책을 통과 못 해 "new row violates
-- row-level security policy" 에러로 나타났습니다(테스트로 발견).
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

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
    when 'STAKEHOLDER' then (
      (p.organizer_delegation_id is not null and is_active_proxy(p.organizer_delegation_id))
      or exists (
        select 1 from program_attendance pa
        join participant pt on pt.id = pa.participant_id
        where pa.program_id = p.id and is_active_proxy(pt.delegation_id)
      )
    )
    else false
  end
  from program p where p.id = target_program_id;
$$;
