begin;
grant delete on public.characters to authenticated;
create policy characters_delete on public.characters for delete to authenticated
 using(owner_id=(select auth.uid()) or (select nd_private.is_master()));
commit;
