-- 진단용: program_insert의 WITH CHECK 식을 호출자(대리인) 컨텍스트에서 직접 평가합니다.
-- 이 함수는 SECURITY DEFINER가 아니라 INVOKER로 둬서(기본값), 호출자 권한 그대로 평가합니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function diag_eval_program_insert_check(
  p_tenant_id uuid,
  p_registered_by_type text,
  p_program_type text,
  p_organizer_delegation_id uuid
)
returns table (
  tenant_role text,
  tenant_role_ok boolean,
  is_proxy boolean,
  full_check boolean
)
language sql
stable
as $$
  select
    current_tenant_role(p_tenant_id),
    coalesce(current_tenant_role(p_tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER'),
    is_active_proxy(p_organizer_delegation_id),
    (
      coalesce(current_tenant_role(p_tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
      or (
        p_registered_by_type = 'PROXY' and p_program_type = 'SELF_SCHEDULED'
        and p_organizer_delegation_id is not null and is_active_proxy(p_organizer_delegation_id)
      )
    );
$$;
