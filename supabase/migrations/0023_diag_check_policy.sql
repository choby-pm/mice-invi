-- 진단용: 지금 DB에 실제로 적용된 program 테이블 INSERT 정책의 원문을 확인합니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function diag_show_program_insert_policy()
returns table (policyname text, cmd text, with_check text)
language sql
security definer
set search_path = public
stable
as $$
  select polname::text, 'insert'::text,
    pg_get_expr(polwithcheck, polrelid)::text
  from pg_policy
  where polrelid = 'program'::regclass and polname = 'program_insert';
$$;
