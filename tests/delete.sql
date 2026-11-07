begin;
select set_config('nd_test.owner',gen_random_uuid()::text,true);
select set_config('nd_test.master',gen_random_uuid()::text,true);
select set_config('nd_test.editor',gen_random_uuid()::text,true);
select set_config('nd_test.card',gen_random_uuid()::text,true);
select set_config('nd_test.second',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) values
 (current_setting('nd_test.owner')::uuid,'delete-owner@example.invalid',now()),
 (current_setting('nd_test.master')::uuid,'delete-master@example.invalid',now()),
 (current_setting('nd_test.editor')::uuid,'delete-editor@example.invalid',now());
insert into nd_private.masters values(current_setting('nd_test.master')::uuid);
insert into public.characters(id,owner_id,data) values
 (current_setting('nd_test.card')::uuid,current_setting('nd_test.owner')::uuid,'{}'),
 (current_setting('nd_test.second')::uuid,current_setting('nd_test.owner')::uuid,'{}');
insert into public.character_access values(current_setting('nd_test.card')::uuid,'delete-editor@example.invalid','editor');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.editor'),'email','delete-editor@example.invalid')::text,true);
do $$ declare n integer;begin
 delete from public.characters where id=current_setting('nd_test.card')::uuid;
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL editor deletion';end if;
 delete from public.characters where id=current_setting('nd_test.second')::uuid;
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL outsider deletion';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.owner'),'email','delete-owner@example.invalid')::text,true);
do $$ declare removed uuid;begin
 delete from public.characters where id=current_setting('nd_test.card')::uuid and revision=99 returning id into removed;
 if removed is not null then raise exception 'FAIL stale deletion';end if;
 delete from public.characters where id=current_setting('nd_test.card')::uuid and revision=0 returning id into removed;
 if removed is null then raise exception 'FAIL owner deletion returning';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.master'),'email','delete-master@example.invalid')::text,true);
do $$ declare removed uuid;begin
 delete from public.characters where id=current_setting('nd_test.second')::uuid and revision=0 returning id into removed;
 if removed is null then raise exception 'FAIL master deletion returning';end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.character_access where character_id=current_setting('nd_test.card')::uuid) then raise exception 'FAIL access cascade';end if;
 if has_table_privilege('anon','public.characters','DELETE') then raise exception 'FAIL anonymous deletion';end if;
end $$;
select 'PASS: owner/master delete with returning, editor/outsider/anon denied, stale deletion blocked, access cascade' as result;
rollback;
