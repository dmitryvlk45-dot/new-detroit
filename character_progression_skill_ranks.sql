create or replace function nd_private.purchase_progression(p_character_id uuid,p_kind text,p_target_id text,p_operation_id uuid,p_revision integer,p_expected_cost integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.characters; c jsonb; campaign uuid; prior public.character_progression; price integer; idx integer; old_value integer; new_value integer; before_value jsonb; after_value jsonb; item jsonb; req jsonb; requirement jsonb; ids text[]; v integer; entry jsonb; owned jsonb; learned integer; perk_names jsonb; offset_value integer; catalog_name text;
begin
 if auth.uid() is null or not(nd_private.is_master() or nd_private.can_access(p_character_id,true)) then raise exception 'Нет права редактировать персонажа'; end if;
 select * into r from public.characters where id=p_character_id for update;
 if not found then raise exception 'Персонаж не найден'; end if;
 if p_operation_id is null then raise exception 'Не указан номер операции'; end if;
 select * into prior from public.character_progression where operation_id=p_operation_id;
 if found then
  if prior.character_id<>p_character_id or prior.kind<>p_kind or prior.target_id<>p_target_id then raise exception 'Номер операции уже использован'; end if;
  return jsonb_build_object('character',to_jsonb(r),'state',nd_private.progression_state(p_character_id),'replayed',true);
 end if;
 if r.revision<>p_revision then raise exception 'Карточка изменена в другом окне. Закрой магазин и обнови карточку.'; end if;
 c:=r.data;
 if jsonb_typeof(c->'experience') is distinct from 'number' or (c->>'experience')!~'^\d+$' then raise exception 'Некорректный баланс опыта'; end if;
 select campaign_id into campaign from public.campaign_characters where character_id=p_character_id;
 if p_kind in ('attribute','skill') then
  if p_kind='attribute' and (select count(*) from public.character_progression where character_id=p_character_id and campaign_id is not distinct from campaign and kind=p_kind)>=2 then raise exception 'Лимит повышений за кампанию исчерпан'; end if;
  ids:=case when p_kind='attribute' then array['body','reflexes','neuroplasticity','charisma'] else array['brawling','fortitude','athletics','shooting','stealth','piloting','hacking','engineering','deduction','communication','intimidation','intuition'] end;
  idx:=array_position(ids,p_target_id)-1;
  if idx is null then raise exception 'Неизвестное улучшение'; end if;
  old_value:=(c #>> array[case when p_kind='attribute' then 'attributes' else 'skills' end,idx::text])::integer;
  if old_value is null or old_value<0 then raise exception 'Некорректное базовое значение'; end if;
  if p_kind='skill' then
   if old_value>=3 then raise exception 'Максимальный ранг навыка: +3'; end if;
   if old_value=2 and (select count(distinct target) from (
    select ids[ordinality::integer] as target from jsonb_array_elements(c->'skills') with ordinality where value='3'::jsonb
    union select h.target_id from public.character_progression h where h.character_id=p_character_id and h.campaign_id is not distinct from campaign and h.kind='skill' and h.after_value='3'::jsonb
   ) ranks where target<>p_target_id)>=2 then raise exception 'Лимит двух навыков ранга +3 исчерпан'; end if;
  end if;
  price:=case when p_kind='attribute' then 8 when old_value=0 then 2 when old_value=1 then 3 else 5 end;
  new_value:=old_value+1;before_value:=to_jsonb(old_value);after_value:=to_jsonb(new_value);
  c:=jsonb_set(c,array[case when p_kind='attribute' then 'attributes' else 'skills' end,idx::text],after_value);
  -- Paid ranks do not change the character-creation skill budget.
  offset_value:=coalesce((c->>'developmentSkillOffset')::integer,0)+case when p_kind='skill' then 1 when p_target_id='neuroplasticity' then -1 else 0 end;
  c:=jsonb_set(c,'{developmentSkillOffset}',to_jsonb(offset_value));
 elsif p_kind='perk' then
  select o.data,o.name into item,catalog_name from public.catalog_overrides o
   where o.category='perks' and o.data->>'catalogId'=p_target_id for share;
  if item is null or item->>'classId'<>'perk' or coalesce((item->>'archived')::boolean,false) then raise exception 'Перк недоступен в справочнике'; end if;
  if item #>> '{economy,currency}' is distinct from 'xp' or jsonb_typeof(item #> '{economy,price}') is distinct from 'number' or (item #>> '{economy,price}')!~'^\d+$' then raise exception 'Мастер должен указать стоимость перка'; end if;
  price:=(item #>> '{economy,price}')::integer;
  req:=coalesce(item->'requirements','[]');
  if jsonb_typeof(req)<>'array' or coalesce(item->>'requirementsText','')<>'' or coalesce(item #>> '{availability,restrictions}','')<>'' then raise exception 'Мастер должен формализовать текстовые требования перка'; end if;
  for requirement in select value from jsonb_array_elements(req) loop
   ids:=case when requirement->>'kind'='attribute' then array['body','reflexes','neuroplasticity','charisma'] when requirement->>'kind'='skill' then array['brawling','fortitude','athletics','shooting','stealth','piloting','hacking','engineering','deduction','communication','intimidation','intuition'] else array[]::text[] end;
   idx:=array_position(ids,requirement->>'targetId')-1;
   if idx is null or (requirement->>'minimum') is null or (requirement->>'minimum')!~'^\d+$' then raise exception 'Неподдерживаемое требование перка'; end if;
   v:=(c #>> array[case when requirement->>'kind'='attribute' then 'attributes' else 'skills' end,idx::text])::integer;
   if v is null or v<(requirement->>'minimum')::integer then raise exception 'Базовые значения не соответствуют требованиям перка'; end if;
  end loop;
  if c->>'equipmentVersion' is distinct from '2' or jsonb_typeof(c->'equipmentItems') is distinct from 'array' then raise exception 'Сначала сохрани карточку в актуальном формате снаряжения'; end if;
  owned:=c->'equipmentItems';learned:=0;
  for entry in select value from jsonb_array_elements(owned) loop
   if entry #>> '{snapshot,classId}'='perk' or exists(select 1 from public.catalog_overrides o where o.category='perks' and o.data->>'catalogId'=entry->>'catalogId') then
    if entry->>'location'='learned' and coalesce((entry->>'equipped')::boolean,true) and (entry->>'quantity')::integer>0 then learned:=learned+1; end if;
    if not coalesce((item->>'repeatable')::boolean,false) and entry->>'catalogId'=p_target_id and (entry #>> '{metadata,learned}'='true' or entry->>'location'='learned' or entry #>> '{legacySlot,category}'='perks') then raise exception 'Перк уже изучен'; end if;
   end if;
  end loop;
  if learned>=5 then raise exception 'Все 5 слотов перков заняты'; end if;
  if not coalesce((item->>'repeatable')::boolean,false) and exists(select 1 from public.character_progression where character_id=p_character_id and kind='perk' and target_id=p_target_id) then raise exception 'Перк уже приобретён'; end if;
  before_value:='false';after_value:='true';
  owned:=owned||jsonb_build_array(jsonb_build_object('instanceId','development:'||p_operation_id,'catalogId',p_target_id,'quantity',1,'location','learned','equipped',true,'metadata',jsonb_build_object('learned',true,'xpPaid',price,'acquisition','progression','operationId',p_operation_id),'snapshot',item||jsonb_build_object('name',catalog_name)));
  c:=jsonb_set(c,'{equipmentItems}',owned);
  select coalesce(jsonb_agg(name),'[]') into perk_names from (select coalesce(e #>> '{snapshot,legacy,name}',e #>> '{snapshot,name}') name from jsonb_array_elements(owned) e where e->>'location'='learned' and coalesce((e->>'equipped')::boolean,true) and (e->>'quantity')::integer>0 and (e #>> '{snapshot,classId}'='perk' or exists(select 1 from public.catalog_overrides o where o.category='perks' and o.data->>'catalogId'=e->>'catalogId'))) q;
  while jsonb_array_length(perk_names)<5 loop perk_names:=perk_names||jsonb_build_array(''); end loop;
  c:=jsonb_set(c,'{perks}',perk_names);
 else raise exception 'Неизвестный тип покупки'; end if;
 if price is distinct from p_expected_cost then raise exception 'Стоимость изменилась. Открой магазин заново и проверь покупку.'; end if;
 if (c->>'experience')::bigint<price then raise exception 'Недостаточно ОО'; end if;
 c:=jsonb_set(c,'{experience}',to_jsonb((c->>'experience')::bigint-price));
 insert into public.character_progression(operation_id,character_id,campaign_id,kind,target_id,before_value,after_value,cost,catalog_id,actor_id)
 values(p_operation_id,p_character_id,campaign,p_kind,p_target_id,before_value,after_value,price,case when p_kind='perk' then p_target_id end,auth.uid());
 update public.characters set data=c,revision=revision+1,updated_at=now() where id=p_character_id returning * into r;
 return jsonb_build_object('character',to_jsonb(r),'state',nd_private.progression_state(p_character_id),'replayed',false);
end $$;

