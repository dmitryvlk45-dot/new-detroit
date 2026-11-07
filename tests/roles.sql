begin;
select set_config('nd_test.owner',gen_random_uuid()::text,true);
select set_config('nd_test.master',gen_random_uuid()::text,true);
select set_config('nd_test.other',gen_random_uuid()::text,true);
select set_config('nd_test.card',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) values
 (current_setting('nd_test.owner')::uuid,'portal-owner@example.invalid',now()),
 (current_setting('nd_test.master')::uuid,'portal-master@example.invalid',now()),
 (current_setting('nd_test.other')::uuid,'portal-other@example.invalid',now());
insert into nd_private.masters values(current_setting('nd_test.master')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.owner'),'email','portal-owner@example.invalid')::text,true);
insert into public.characters(id,owner_id,data) values(current_setting('nd_test.card')::uuid,current_setting('nd_test.owner')::uuid,'{}') returning id;
do $$ begin
 if public.is_master() then raise exception 'FAIL player master'; end if;
 begin
  insert into nd_private.masters values(current_setting('nd_test.owner')::uuid);
  raise exception 'FAIL self promotion';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.character_access values(current_setting('nd_test.card')::uuid,'portal-other@example.invalid','editor');
  raise exception 'FAIL player grant';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.other'),'email','portal-other@example.invalid')::text,true);
do $$ begin if exists(select 1 from public.characters where id=current_setting('nd_test.card')::uuid) then raise exception 'FAIL outsider read'; end if; end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.master'),'email','portal-master@example.invalid')::text,true);
do $$ declare n integer; begin
 if not public.is_master() then raise exception 'FAIL master role'; end if;
 update public.characters set data='{"master":true}',revision=1 where id=current_setting('nd_test.card')::uuid;
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL master edit';end if;
end $$;
insert into public.character_access values(current_setting('nd_test.card')::uuid,'portal-other@example.invalid','editor');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.other'),'email','portal-other@example.invalid')::text,true);
do $$ declare n integer; begin
 update public.characters set data='{"player":true}',revision=2 where id=current_setting('nd_test.card')::uuid;
 get diagnostics n=row_count;if n<>1 then raise exception 'FAIL granted edit';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.master'),'email','portal-master@example.invalid')::text,true);
update public.character_access set role='viewer' where character_id=current_setting('nd_test.card')::uuid;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.other'),'email','portal-other@example.invalid')::text,true);
do $$ declare n integer; begin
 update public.characters set data='{}',revision=3 where id=current_setting('nd_test.card')::uuid;
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL viewer write';end if;
end $$;
reset role;
select 'PASS: player isolation, owner creation returning, master edit/grant, editor write, viewer denial, no role escalation' as result;
rollback;
