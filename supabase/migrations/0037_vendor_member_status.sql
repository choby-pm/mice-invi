alter table vendor_member add column if not exists status text not null default 'ACTIVE' check(status in ('ACTIVE','REMOVED'));
create or replace function is_vendor_member(target_vendor_id uuid)
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from vendor_member where vendor_id=target_vendor_id and user_id=auth.uid() and status='ACTIVE');
$$;
