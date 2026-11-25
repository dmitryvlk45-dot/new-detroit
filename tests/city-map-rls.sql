-- Transactional authorization checks. All fixture users, campaigns and changes roll back.
begin;
select set_config('map_test.master',(select user_id::text from nd_private.masters limit 1),true);
select set_config('map_test.player_a',(select u.id::text from auth.users u where not exists(select 1 from nd_private.masters m where m.user_id=u.id) order by u.id limit 1),true),set_config('map_test.player_b',(select u.id::text from auth.users u where not exists(select 1 from nd_private.masters m where m.user_id=u.id) order by u.id offset 1 limit 1),true);
insert into public.characters(id,owner_id,data) values ('20000000-0000-4000-8000-000000000001',current_setting('map_test.player_a')::uuid,'{}'),('20000000-0000-4000-8000-000000000002',current_setting('map_test.player_b')::uuid,'{}');
insert into public.campaigns(id,name) values ('30000000-0000-4000-8000-000000000001','map-qa-a'),('30000000-0000-4000-8000-000000000002','map-qa-b');
insert into public.campaign_characters(character_id,campaign_id) values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
insert into public.map_locations(id,name,category,position,visibility,campaign_id) values
('40000000-0000-4000-8000-000000000001','map-qa-public','info','{"x":0.5,"y":0.5}','public',null),
('40000000-0000-4000-8000-000000000002','map-qa-hidden','info','{"x":0.5,"y":0.5}','hidden',null),
('40000000-0000-4000-8000-000000000003','map-qa-a','info','{"x":0.5,"y":0.5}','campaign','30000000-0000-4000-8000-000000000001'),
('40000000-0000-4000-8000-000000000004','map-qa-b','info','{"x":0.5,"y":0.5}','campaign','30000000-0000-4000-8000-000000000002');
insert into public.map_campaign_state(id,position) values ('30000000-0000-4000-8000-000000000001','{"x":0.2,"y":0.3}'),('30000000-0000-4000-8000-000000000002','{"x":0.8,"y":0.7}');
insert into public.map_locations(id,name,category,position,locked) values('40000000-0000-4000-8000-000000000005','travel-qa-locked','info','{"x":0.6,"y":0.6}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('map_test.player_a'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('map_test.player_a'),'role','authenticated')::text,true);
do $$declare n int;begin
 if (select count(*) from public.map_locations where name like 'map-qa-%')<>2 then raise exception 'Player visibility or campaign isolation failed';end if;
 if exists(select 1 from public.map_locations where name in ('map-qa-hidden','map-qa-b')) then raise exception 'Secret location leaked';end if;
 if (select count(*) from public.map_campaign_state where id::text like '30000000-%')<>1 then raise exception 'Party state leaked across campaigns';end if;
 if (select count(*) from public.campaign_characters where character_id::text like '20000000-%')<>1 then raise exception 'Membership isolation failed';end if;
 begin insert into public.map_locations(name,category,position) values('forbidden','info','{"x":0.1,"y":0.1}');raise exception 'Player INSERT succeeded';exception when insufficient_privilege then null;end;
 update public.map_locations set name='forbidden' where name='map-qa-public';get diagnostics n=row_count;if n<>0 then raise exception 'Player UPDATE succeeded';end if;
 delete from public.map_locations where name='map-qa-public';get diagnostics n=row_count;if n<>0 then raise exception 'Player DELETE succeeded';end if;
 update public.map_campaign_state set position='{"x":0.9,"y":0.9}' where id='30000000-0000-4000-8000-000000000001';get diagnostics n=row_count;if n<>0 then raise exception 'Player changed party';end if;
 begin perform public.map_import_geometry('[]');raise exception 'Player geometry RPC succeeded';exception when insufficient_privilege then null;end;
end$$;
-- The dedicated action may move a member's party, but never arbitrary coordinates.
do $$declare moved jsonb;begin
 moved:=public.map_move_party('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1);
 if moved->'position'<>'{"x":0.5,"y":0.5}'::jsonb or (moved->>'revision')::int<>2 then raise exception 'Travel did not save destination/revision';end if;
 begin perform public.map_move_party('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1);raise exception 'Stale travel succeeded';exception when serialization_failure then null;end;
 begin perform public.map_move_party('30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',1);raise exception 'Other campaign travel succeeded';exception when insufficient_privilege then null;end;
 begin perform public.map_move_party('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',2);raise exception 'Hidden destination succeeded';exception when insufficient_privilege then null;end;
 begin perform public.map_move_party('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004',2);raise exception 'Foreign destination succeeded';exception when insufficient_privilege then null;end;
 begin perform public.map_move_party('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000005',2);raise exception 'Locked destination succeeded';exception when insufficient_privilege then null;end;
 if (select revision from public.map_campaign_state where id='30000000-0000-4000-8000-000000000001')<>2 then raise exception 'Rejected travel changed party';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('map_test.player_b'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('map_test.player_b'),'role','authenticated')::text,true);
do $$begin if not exists(select 1 from public.map_locations where name='map-qa-b') or exists(select 1 from public.map_locations where name='map-qa-a') then raise exception 'Campaign B isolation failed';end if;end$$;
select set_config('request.jwt.claim.sub',current_setting('map_test.master'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('map_test.master'),'role','authenticated')::text,true);
do $$declare n int;begin if (select count(*) from public.map_locations where name like 'map-qa-%')<>4 then raise exception 'Master cannot see all map rows';end if;update public.map_campaign_state set position='{"x":0.3,"y":0.4}' where id='30000000-0000-4000-8000-000000000001';get diagnostics n=row_count;if n<>1 then raise exception 'Master party update failed';end if;end$$;
set local role anon;
do $$begin begin perform public.map_move_party('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',2);raise exception 'Anonymous travel succeeded';exception when insufficient_privilege then null;end;end$$;
do $$begin begin perform 1 from public.map_locations;raise exception 'Anonymous read succeeded';exception when insufficient_privilege then null;end;end$$;
rollback;
