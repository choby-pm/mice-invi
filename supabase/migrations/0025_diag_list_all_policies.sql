-- 진단용: program 테이블에 걸린 "모든" 정책을 이름·명령·permissive 여부까지 전부 봅니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function diag_list_program_policies()
returns table (policyname text, cmd text, permissive text, roles text, qual text, with_check text)
language sql
security definer
set search_path = public
stable
as $$
  select polname::text, polcmd::text, case when polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end,
    (select array_agg(rolname) from pg_roles where oid = any(polroles))::text,
    pg_get_expr(polqual, polrelid)::text,
    pg_get_expr(polwithcheck, polrelid)::text
  from pg_policy
  where polrelid = 'program'::regclass;
$$;
