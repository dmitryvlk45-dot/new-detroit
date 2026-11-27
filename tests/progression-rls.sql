-- All fixtures and simulated catalog edits roll back. No real character is changed.
begin;
select set_config('progression_test.player',(select u.id::text from auth.users u where not exists(select 1 from nd_private.masters m where m.user_id=u.id) order by u.id limit 1),true);
select set_config('progression_test.other',(select u.id::text from auth.users u where not exists(select 1 from nd_private.masters m where m.user_id=u.id) order by u.id offset 1 limit 1),true);
insert into public.characters(id,owner_id,data,revision) values
 ('80000000-0000-4000-8000-000000000001',current_setting('progression_test.player')::uuid,'{"attributes":[2,1,1,0],"skills":[2,2,2,1,0,0,0,0,0,0,0,0],"experience":50,"equipmentVersion":2,"equipmentItems":[],"perks":["","","","",""]}',0),
 ('80000000-0000-4000-8000-000000000002',current_setting('progression_test.other')::uuid,'{"attributes":[2,1,1,0],"skills":[2,2,2,1,0,0,0,0,0,0,0,0],"experience":50,"equipmentVersion":2,"equipmentItems":[],"perks":["","","","",""]}',0);
insert into public.catalog_overrides(category,name,data) values ('perks','progression-qa','{"name":"progression-qa","catalogId":"qa:progression","classId":"perk","economy":{"currency":"xp","price":4},"requirements":[{"kind":"skill","targetId":"brawling","minimum":3}],"effects":[],"equipment":{"activation":"passive"}}');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('progression_test.player'),true);
do $$declare result jsonb; baseline jsonb; failed boolean; cid uuid:='80000000-0000-4000-8000-000000000001';begin
 -- Insufficient funds rolls back both stats and ledger.
 update public.characters set revision=revision+1,data=jsonb_set(data,'{experience}','7') where id=cid;
 failed:=false;begin perform public.purchase_progression(cid,'attribute','body',gen_random_uuid(),(select revision from public.characters where id=cid),8);exception when raise_exception then failed:=true;end;
 if not failed or exists(select 1 from public.character_progression where character_id=cid) then raise exception 'Insufficient funds/rollback failed';end if;
 update public.characters set revision=revision+1,data=jsonb_set(data,'{experience}','50') where id=cid;
 result:=public.purchase_progression(cid,'attribute','body','81000000-0000-4000-8000-000000000001',(select revision from public.characters where id=cid),8);
 if result #>> '{character,data,experience}'<>'42' or result #>> '{character,data,attributes,0}'<>'3' then raise exception 'Attribute purchase failed';end if;
 result:=public.purchase_progression(cid,'attribute','body','81000000-0000-4000-8000-000000000001',(select revision from public.characters where id=cid),8);
 if result->>'replayed'<>'true' or result #>> '{character,data,experience}'<>'42' then raise exception 'Idempotency failed';end if;
 failed:=false;begin perform public.purchase_progression(cid,'attribute','reflexes',gen_random_uuid(),0,8);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Stale concurrent revision allowed';end if;
 result:=public.purchase_progression(cid,'attribute','body',gen_random_uuid(),(select revision from public.characters where id=cid),8);
 if result #>> '{character,data,attributes,0}'<>'4' then raise exception 'Same attribute twice disallowed';end if;
 update public.characters set revision=revision+1,data=jsonb_set(data,'{attributes,0}','0') where id=cid;
 failed:=false;begin perform public.purchase_progression(cid,'attribute','reflexes',gen_random_uuid(),(select revision from public.characters where id=cid),8);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Manual edit reset limit';end if;
 failed:=false;begin perform public.purchase_progression(cid,'skill','shooting',gen_random_uuid(),(select revision from public.characters where id=cid),5);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Skill base 1 allowed';end if;
 result:=public.purchase_progression(cid,'skill','brawling',gen_random_uuid(),(select revision from public.characters where id=cid),5);
 if result #>> '{character,data,skills,0}'<>'3' or result #>> '{character,data,experience}'<>'29' then raise exception 'Skill purchase failed';end if;
 update public.characters set revision=revision+1,data=jsonb_set(data,'{skills,0}','2') where id=cid;
 failed:=false;begin perform public.purchase_progression(cid,'skill','brawling',gen_random_uuid(),(select revision from public.characters where id=cid),5);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Duplicate skill allowed';end if;
 result:=public.purchase_progression(cid,'skill','fortitude',gen_random_uuid(),(select revision from public.characters where id=cid),5);
 failed:=false;begin perform public.purchase_progression(cid,'skill','athletics',gen_random_uuid(),(select revision from public.characters where id=cid),5);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Third skill allowed';end if;
 failed:=false;begin perform public.purchase_progression(cid,'perk','qa:progression',gen_random_uuid(),(select revision from public.characters where id=cid),4);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Unmet perk requirement allowed';end if;
 update public.characters set revision=revision+1,data=jsonb_set(data,'{skills,0}','3') where id=cid;
 failed:=false;begin perform public.purchase_progression(cid,'perk','qa:progression',gen_random_uuid(),(select revision from public.characters where id=cid),3);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Client price trusted';end if;
 result:=public.purchase_progression(cid,'perk','qa:progression',gen_random_uuid(),(select revision from public.characters where id=cid),4);
 if result #>> '{character,data,experience}'<>'20' or result #>> '{character,data,perks,0}'<>'progression-qa' or result #>> '{character,data,equipmentItems,0,metadata,learned}'<>'true' then raise exception 'Learned perk integration failed';end if;
 failed:=false;begin perform public.purchase_progression(cid,'perk','qa:progression',gen_random_uuid(),(select revision from public.characters where id=cid),4);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Duplicate perk allowed';end if;
 failed:=false;begin perform public.purchase_progression('80000000-0000-4000-8000-000000000002','attribute','body',gen_random_uuid(),0,8);exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Foreign character purchase allowed';end if;
 failed:=false;begin perform public.restore_progression(cid,'attribute','body',1,2,8,gen_random_uuid());exception when raise_exception then failed:=true;end;
 if not failed then raise exception 'Player restored history';end if;
 begin insert into public.character_progression(operation_id,character_id,kind,target_id,before_value,after_value,cost,actor_id) values(gen_random_uuid(),cid,'attribute','body','0','1',0,auth.uid());raise exception 'Player inserted ledger';exception when insufficient_privilege then null;end;
 if (select count(*) from public.character_progression where character_id=cid)<>5 then raise exception 'Ledger count differs';end if;
end$$;
reset role;
select 'PASS: atomic debit, rollback, idempotency, stale revision, limits, catalog price, requirements, duplicate perks, RLS, Master-only restore' as result;
rollback;
