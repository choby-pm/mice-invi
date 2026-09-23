-- 버그 수정: 대리인이 배정된 대표단은 볼 수 있는데(is_active_proxy), 그 대표단이
-- 속한 행사(event)는 못 봐서 포털 홈에서 행사 이름이 항상 비어 나왔습니다.
-- E2E 확인 중 발견 — event 테이블 select 정책에 is_event_proxy를 빠뜨렸습니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

drop policy if exists event_select on event;
create policy event_select on event
  for select using (current_tenant_role(tenant_id) is not null or is_event_proxy(id));
