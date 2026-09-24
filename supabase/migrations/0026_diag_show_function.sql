-- 진단용: is_program_visible_to_proxy 함수의 실제 배포된 본문을 확인합니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function diag_show_function_def(p_function_name text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select pg_get_functiondef(oid)
  from pg_proc
  where proname = p_function_name
  limit 1;
$$;
