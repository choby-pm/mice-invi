-- R3: 업체 포털 기반. vendor_member(업체 소속 직원 로그인), service_item에 업체 접근
-- 권한 추가, 그리고 "요청 데이터/확정 데이터 분리"라는 제품 핵심 가치를 지키기 위해
-- 요청(note)과는 별도인 확정 필드(confirmation_note, confirmed_at)를 둡니다.
-- 적용 방법: Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run.

create table if not exists vendor_member (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendor(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'STAFF' check (role in ('ADMIN', 'STAFF')),
  created_at timestamptz not null default now(),
  unique (vendor_id, user_id)
);
alter table vendor_member enable row level security;

create or replace function is_vendor_member(target_vendor_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from vendor_member where vendor_id = target_vendor_id and user_id = auth.uid()
  );
$$;

-- 자기 업체 멤버 목록은 볼 수 있음. 추가는 PCO가 event_vendor 배정 흐름에서 처리(관리자 키).
create policy vendor_member_select on vendor_member for select
  using (is_vendor_member(vendor_id));

-- 요청 데이터(note)와 확정 데이터는 분리해서 저장합니다 — 이 제품의 핵심 가치.
alter table service_item add column if not exists confirmation_note text;
alter table service_item add column if not exists confirmed_at timestamptz;

-- 업체는 자기 event_vendor로 배정된 서비스 항목만 보고 착수·확정할 수 있음.
create policy service_item_vendor_select on service_item for select
  using (
    event_vendor_id is not null and exists (
      select 1 from event_vendor ev where ev.id = service_item.event_vendor_id and is_vendor_member(ev.vendor_id)
    )
  );
create policy service_item_vendor_update on service_item for update
  using (
    event_vendor_id is not null and exists (
      select 1 from event_vendor ev where ev.id = service_item.event_vendor_id and is_vendor_member(ev.vendor_id)
    )
  );

-- 업체가 담당 서비스 항목의 대표단 이름 정도는 볼 수 있어야 목록이 의미가 있음 (업무 필드만).
create policy delegation_vendor_select on delegation for select
  using (
    exists (
      select 1 from event_vendor ev where ev.event_id = delegation.event_id and is_vendor_member(ev.vendor_id)
    )
  );
