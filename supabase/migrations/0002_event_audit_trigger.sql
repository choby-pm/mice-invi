-- 행사(event) 변경을 감사 로그에 자동 기록 (03 §1.4 audit 모듈).
-- 트리거로 하는 이유: 매 서비스 코드마다 기록을 깜빡할 위험을 없애기 위해서입니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function log_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_action text;
begin
  if TG_OP = 'DELETE' then
    v_tenant_id := old.tenant_id;
    v_action := 'event.deleted';
  elsif TG_OP = 'INSERT' then
    v_tenant_id := new.tenant_id;
    v_action := 'event.created';
  else
    v_tenant_id := new.tenant_id;
    v_action := 'event.updated';
  end if;

  insert into audit_log (tenant_id, actor_user_id, action, entity_type, entity_id, detail)
  values (
    v_tenant_id,
    auth.uid(),
    v_action,
    'event',
    coalesce(new.id, old.id),
    case
      when TG_OP = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      when TG_OP = 'INSERT' then to_jsonb(new)
      else to_jsonb(old)
    end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists event_audit_log on event;
create trigger event_audit_log
  after insert or update or delete on event
  for each row execute function log_event_change();
