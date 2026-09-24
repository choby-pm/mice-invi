-- R3 버그 수정: service_item_vendor_select/update, delegation_vendor_select 정책이
-- event_vendor 테이블을 RLS USING절 안에서 직접 서브쿼리로 참조하고 있었습니다.
-- 이 서브쿼리는 호출자(업체 사용자) 권한으로 실행되는데, event_vendor에는 PCO(테넌트 멤버)만
-- 조회 가능한 정책만 있어서 업체 사용자에게는 항상 빈 결과 -> EXISTS가 항상 거짓이 되어
-- 업체가 배정된 항목을 하나도 보지 못하는 문제가 있었습니다.
-- SECURITY DEFINER 함수로 감싸서(테이블 소유자 권한으로 실행, RLS 우회) 해결합니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function is_event_vendor_of_mine(target_event_vendor_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from event_vendor ev
    where ev.id = target_event_vendor_id and is_vendor_member(ev.vendor_id)
  );
$$;

create or replace function is_vendor_of_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from event_vendor ev
    where ev.event_id = target_event_id and is_vendor_member(ev.vendor_id)
  );
$$;

drop policy if exists service_item_vendor_select on service_item;
create policy service_item_vendor_select on service_item for select
  using (
    event_vendor_id is not null and is_event_vendor_of_mine(event_vendor_id)
  );

drop policy if exists service_item_vendor_update on service_item;
create policy service_item_vendor_update on service_item for update
  using (
    event_vendor_id is not null and is_event_vendor_of_mine(event_vendor_id)
  );

drop policy if exists delegation_vendor_select on delegation;
create policy delegation_vendor_select on delegation for select
  using (
    is_vendor_of_event(event_id)
  );

-- 업체가 담당 서비스 항목 목록에서 대표단.행사명을 함께 볼 수 있어야 함 (0010에서 대리인에게는
-- 이미 적용했던 것과 같은 종류의 누락 — event 테이블에도 업체 접근을 빠짐없이 걸어야 함).
drop policy if exists event_select on event;
create policy event_select on event
  for select using (
    current_tenant_role(tenant_id) is not null or is_event_proxy(id) or is_vendor_of_event(id)
  );
