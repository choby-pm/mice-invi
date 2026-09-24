-- R3 마무리: 공항 의전(AIRPORT)·식음(DIETARY) 상세 필드 (01 §P09~P10).
-- 이 두 서비스는 문서 자체에 항공/숙박/수송만큼의 정식 필드 표가 없고 서술로만 남아있어서,
-- 의도적으로 항공/수송처럼 방향별 자동 생성·분리까지는 하지 않았습니다(CLAUDE.md에 이미
-- "필드 스펙이 얕아서 급하지 않음"으로 적어뒀던 판단 그대로) — PCO가 필요할 때 "항목 추가"로
-- 만들고 직접 범위를 지정하는 지금 구조를 그대로 씁니다.
-- 공항 의전은 P09에 따라 "의전 범위"를 대리인이 아니라 PCO가 지정합니다 — 그래서
-- airport_request는 flight_request/lodging_request와 달리 대리인 쓰기 권한이 없습니다.
-- 식음은 P10대로 참가자 개인별 식이 코드라서 room_assignment처럼 참가자 단위 행을 둡니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists airport_request (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null unique references service_item(id) on delete cascade,
  scope text[] not null default '{}', -- GREETING, FAST_TRACK, LOUNGE, BAGGAGE
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table airport_request enable row level security;

create table if not exists airport_assignment (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null references service_item(id) on delete cascade,
  attendant_name text,
  meeting_point text,
  meeting_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
alter table airport_assignment enable row level security;

create table if not exists dietary_requirement (
  id uuid primary key default gen_random_uuid(),
  service_item_id uuid not null references service_item(id) on delete cascade,
  participant_id uuid not null references participant(id) on delete cascade,
  dietary_code text not null default 'NONE' check (dietary_code in ('NONE', 'HALAL', 'VEGETARIAN', 'VEGAN', 'KOSHER', 'ALLERGY', 'OTHER')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_item_id, participant_id)
);
alter table dietary_requirement enable row level security;

-- 조회는 전부 service_item 자신의 이미 올바른 정책(0012)에 얹힙니다.
create policy airport_request_select on airport_request for select
  using (exists (select 1 from service_item si where si.id = airport_request.service_item_id));
create policy airport_request_write on airport_request for all
  using (
    exists (
      select 1 from service_item si where si.id = airport_request.service_item_id
        and coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = airport_request.service_item_id
        and coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER')
    )
  );

create policy airport_assignment_select on airport_assignment for select
  using (exists (select 1 from service_item si where si.id = airport_assignment.service_item_id));
create policy airport_assignment_write on airport_assignment for all
  using (
    exists (
      select 1 from service_item si where si.id = airport_assignment.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = airport_assignment.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_event_vendor_of_mine(si.event_vendor_id))
    )
  );

create policy dietary_requirement_select on dietary_requirement for select
  using (exists (select 1 from service_item si where si.id = dietary_requirement.service_item_id));
create policy dietary_requirement_write on dietary_requirement for all
  using (
    exists (
      select 1 from service_item si where si.id = dietary_requirement.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(si.delegation_id))
    )
  )
  with check (
    exists (
      select 1 from service_item si where si.id = dietary_requirement.service_item_id
        and (coalesce(current_tenant_role(si.tenant_id), '') in ('PCO_ADMIN', 'PCO_MANAGER') or is_active_proxy(si.delegation_id))
    )
  );
