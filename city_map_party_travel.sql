-- Members may move their campaign party only to an existing accessible location.
-- Coordinates, campaign ownership, locks and revisions are checked server-side.
create function nd_private.map_travel(target_campaign uuid,destination_id uuid,expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare party public.map_campaign_state%rowtype; destination public.map_locations%rowtype; result jsonb;
begin
 if auth.uid() is null then raise exception 'Нужно войти в аккаунт' using errcode='42501'; end if;
 if not public.is_master() and not exists(
  select 1 from public.campaign_characters cc where cc.campaign_id=target_campaign
  and nd_private.can_access(cc.character_id,true)
 ) then raise exception 'Нет права перемещать группу этой кампании' using errcode='42501'; end if;
 select * into party from public.map_campaign_state where id=target_campaign for update;
 if not found or party.position is null then raise exception 'Мастер ещё не задал положение группы'; end if;
 if expected_revision is null or party.revision<>expected_revision then
  raise exception 'Положение группы изменилось. Обнови карту и построй маршрут заново.' using errcode='40001';
 end if;
 select * into destination from public.map_locations where id=destination_id for share;
 if not found or destination.visibility='hidden' or destination.locked
 or (destination.campaign_id is not null and destination.campaign_id<>target_campaign)
 then raise exception 'Локация недоступна для перемещения' using errcode='42501'; end if;
 update public.map_campaign_state set position=destination.position,revision=revision+1
 where id=target_campaign returning to_jsonb(map_campaign_state.*) into result;
 return result;
end $$;
revoke all on function nd_private.map_travel(uuid,uuid,integer) from public,anon;
grant execute on function nd_private.map_travel(uuid,uuid,integer) to authenticated;
create function public.map_move_party(target_campaign uuid,destination_id uuid,expected_revision integer)
returns jsonb language sql security invoker set search_path='' as $$
 select nd_private.map_travel(target_campaign,destination_id,expected_revision)
$$;
revoke all on function public.map_move_party(uuid,uuid,integer) from public,anon;
grant execute on function public.map_move_party(uuid,uuid,integer) to authenticated;
