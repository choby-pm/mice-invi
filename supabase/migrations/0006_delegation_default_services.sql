-- 대표단을 만들면 5개 서비스 유형에 "요청 전" 항목이 자동으로 생깁니다.
-- 피드백: "대표단을 추가하면 자동으로 각 항목에 배정됨". PCO가 매번 5개를
-- 손으로 추가하지 않도록 트리거로 보장합니다("항목 추가"는 여러 개가 필요한
-- 경우를 위해 그대로 남겨둡니다 — 예: 항공 구간이 여러 개인 경우).
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create or replace function create_default_service_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into service_item (tenant_id, event_id, delegation_id, service_type, status)
  select new.tenant_id, new.event_id, new.id, t, 'DRAFT'
  from unnest(array['FLIGHT', 'LODGING', 'TRANSFER', 'AIRPORT', 'DIETARY']) as t;
  return new;
end;
$$;

drop trigger if exists delegation_default_services on delegation;
create trigger delegation_default_services
  after insert on delegation
  for each row execute function create_default_service_items();

-- 이미 있는 대표단에도 소급 적용 (아직 없는 유형만 채움)
insert into service_item (tenant_id, event_id, delegation_id, service_type, status)
select d.tenant_id, d.event_id, d.id, t, 'DRAFT'
from delegation d
cross join unnest(array['FLIGHT', 'LODGING', 'TRANSFER', 'AIRPORT', 'DIETARY']) as t
where not exists (
  select 1 from service_item si where si.delegation_id = d.id and si.service_type = t
);
