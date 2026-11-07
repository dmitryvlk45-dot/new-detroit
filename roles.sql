-- Add portal roles to the existing installation; never changes character data.
begin;
create table nd_private.masters (user_id uuid primary key references auth.users(id) on delete cascade);
alter table nd_private.masters enable row level security;
revoke all on nd_private.masters from public,anon,authenticated;
create function nd_private.is_master() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from nd_private.masters where user_id=(select auth.uid()));
$$;
revoke all on function nd_private.is_master() from public;
grant execute on function nd_private.is_master() to authenticated;
create function public.is_master() returns boolean language sql stable security invoker set search_path='' as $$ select nd_private.is_master(); $$;
revoke all on function public.is_master() from public;
grant execute on function public.is_master() to authenticated;
alter policy characters_read on public.characters using(owner_id=(select auth.uid()) or (select nd_private.is_master()) or nd_private.can_access(id,false));
alter policy characters_edit on public.characters using((select nd_private.is_master()) or nd_private.can_access(id,true)) with check((select nd_private.is_master()) or nd_private.can_access(id,true));
alter policy access_read on public.character_access using((select nd_private.is_master()) or nd_private.is_owner(character_id) or email=lower((select auth.jwt()->>'email')));
alter policy access_create on public.character_access with check((select nd_private.is_master()));
alter policy access_edit on public.character_access using((select nd_private.is_master())) with check((select nd_private.is_master()));
alter policy access_remove on public.character_access using((select nd_private.is_master()));
-- An atomic global cap protects the intentionally public registration endpoint.
create table nd_private.signup_windows (hour timestamptz primary key, attempts integer not null);
alter table nd_private.signup_windows enable row level security;
revoke all on nd_private.signup_windows from public,anon,authenticated;
create function nd_private.claim_signup_slot() returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from nd_private.signup_windows where hour < now()-interval '2 hours';
 insert into nd_private.signup_windows values(date_trunc('hour',now()),1)
 on conflict(hour) do update set attempts=nd_private.signup_windows.attempts+1 returning attempts into n;
 return n<=30;
end $$;
revoke all on function nd_private.claim_signup_slot() from public;
grant usage on schema nd_private to service_role;
grant execute on function nd_private.claim_signup_slot() to service_role;
create function public.claim_signup_slot() returns boolean language sql security invoker set search_path='' as $$ select nd_private.claim_signup_slot(); $$;
revoke all on function public.claim_signup_slot() from public,anon,authenticated;
grant execute on function public.claim_signup_slot() to service_role;
commit;
