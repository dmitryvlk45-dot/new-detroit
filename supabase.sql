-- Run once in a NEW Supabase project (SQL Editor), as the project administrator.
-- Access is enforced in Postgres, independently of the website.
begin;
create table public.characters (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data) = 'object' and octet_length(data::text) < 1000000),
 revision integer not null default 0 check(revision >= 0),
 updated_at timestamptz not null default now()
);
create index characters_owner on public.characters(owner_id);
create table public.character_access (
 character_id uuid not null references public.characters(id) on delete cascade,
 email text not null check(email = lower(trim(email)) and length(email) between 3 and 320),
 role text not null check(role in ('editor','viewer')),
 primary key(character_id,email)
);
create index character_access_email on public.character_access(email);
alter table public.characters enable row level security;
alter table public.character_access enable row level security;

-- Put privileged policy helpers in a schema that is NOT exposed by the REST API.
create schema if not exists nd_private;
revoke all on schema nd_private from public;
grant usage on schema nd_private to authenticated;
create function nd_private.is_owner(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.characters c where c.id=cid and c.owner_id=(select auth.uid()));
$$;
create function nd_private.can_access(cid uuid, edit boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select nd_private.is_owner(cid) or exists(
  select 1 from public.character_access a
  join auth.users u on u.id=(select auth.uid())
  where a.character_id=cid and a.email=lower(u.email)
    and u.email_confirmed_at is not null and (not edit or a.role='editor')
 );
$$;
revoke all on function nd_private.is_owner(uuid) from public;
revoke all on function nd_private.can_access(uuid,boolean) from public;
grant execute on function nd_private.is_owner(uuid) to authenticated;
grant execute on function nd_private.can_access(uuid,boolean) to authenticated;

create policy characters_read on public.characters for select to authenticated
 using(nd_private.can_access(id,false));
create policy characters_create on public.characters for insert to authenticated
 with check(owner_id=(select auth.uid()));
create policy characters_edit on public.characters for update to authenticated
 using(nd_private.can_access(id,true)) with check(nd_private.can_access(id,true));
create policy access_read on public.character_access for select to authenticated
 using(nd_private.is_owner(character_id) or email=lower((select auth.jwt()->>'email')));
create policy access_create on public.character_access for insert to authenticated
 with check(nd_private.is_owner(character_id));
create policy access_edit on public.character_access for update to authenticated
 using(nd_private.is_owner(character_id)) with check(nd_private.is_owner(character_id));
create policy access_remove on public.character_access for delete to authenticated
 using(nd_private.is_owner(character_id));

create function nd_private.protect_character() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
  raise exception 'Changing card identity or owner is not allowed';
 end if;
 if new.revision <> old.revision+1 then
  raise exception 'Revision conflict';
 end if;
 new.updated_at=now();
 return new;
end;
$$;
create trigger protect_character before update on public.characters
 for each row execute function nd_private.protect_character();
revoke all on public.characters,public.character_access from anon,authenticated;
grant select,insert on public.characters to authenticated;
grant update(data,revision) on public.characters to authenticated;
grant select,insert,update,delete on public.character_access to authenticated;
commit;
