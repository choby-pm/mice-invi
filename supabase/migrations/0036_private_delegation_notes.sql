-- 내부 메모는 대표단 기본정보와 분리하여 대리인·업체의 직접 API 조회에서도 숨깁니다.
create table delegation_internal (
  delegation_id uuid primary key references delegation(id) on delete cascade,
  note text
);
alter table delegation_internal enable row level security;
create policy delegation_internal_pco on delegation_internal for all
  using (exists(select 1 from delegation d where d.id=delegation_id and coalesce(current_tenant_role(d.tenant_id),'') in ('PCO_ADMIN','PCO_MANAGER')))
  with check (exists(select 1 from delegation d where d.id=delegation_id and coalesce(current_tenant_role(d.tenant_id),'') in ('PCO_ADMIN','PCO_MANAGER')));
insert into delegation_internal(delegation_id,note) select id,internal_note from delegation where internal_note is not null;
update delegation set internal_note=null where internal_note is not null;
create table program_internal (
  program_id uuid primary key references program(id) on delete cascade,
  note text
);
alter table program_internal enable row level security;
create policy program_internal_pco on program_internal for all
  using (exists(select 1 from program p where p.id=program_id and coalesce(current_tenant_role(p.tenant_id),'') in ('PCO_ADMIN','PCO_MANAGER')))
  with check (exists(select 1 from program p where p.id=program_id and coalesce(current_tenant_role(p.tenant_id),'') in ('PCO_ADMIN','PCO_MANAGER')));
insert into program_internal(program_id,note) select id,internal_note from program where internal_note is not null;
update program set internal_note=null where internal_note is not null;

-- 이전 클라이언트가 보낸 메모도 비공개 저장소로 옮깁니다. 기존 컬럼은 호환용으로 비워 둡니다.
create function isolate_internal_note()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.internal_note is null then return new;end if;
  if auth.role() <> 'service_role' and coalesce(current_tenant_role(new.tenant_id),'') not in ('PCO_ADMIN','PCO_MANAGER') then raise exception 'private note is PCO only';end if;
  if TG_TABLE_NAME='delegation' then
    insert into delegation_internal(delegation_id,note) values(new.id,new.internal_note) on conflict(delegation_id) do update set note=excluded.note;
    update delegation set internal_note=null where id=new.id;
  else
    insert into program_internal(program_id,note) values(new.id,new.internal_note) on conflict(program_id) do update set note=excluded.note;
    update program set internal_note=null where id=new.id;
  end if;
  return new;
end;$$;
create trigger delegation_note_isolation after insert or update of internal_note on delegation for each row execute function isolate_internal_note();
create trigger program_note_isolation after insert or update of internal_note on program for each row execute function isolate_internal_note();
