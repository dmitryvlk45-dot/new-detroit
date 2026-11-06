-- Transactional integration test: all fixtures are rolled back.
begin;
select set_config('nd_test.owner',gen_random_uuid()::text,true);
select set_config('nd_test.editor',gen_random_uuid()::text,true);
select set_config('nd_test.viewer',gen_random_uuid()::text,true);
select set_config('nd_test.outsider',gen_random_uuid()::text,true);
select set_config('nd_test.card',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at)
values (current_setting('nd_test.owner')::uuid,'nd-test-owner@example.invalid',now()),
 (current_setting('nd_test.editor')::uuid,'nd-test-editor@example.invalid',now()),
 (current_setting('nd_test.viewer')::uuid,'nd-test-viewer@example.invalid',now()),
 (current_setting('nd_test.outsider')::uuid,'nd-test-outsider@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.owner'),'email','nd-test-owner@example.invalid','role','authenticated')::text,true);
insert into public.characters(id,owner_id,data) values(current_setting('nd_test.card')::uuid,current_setting('nd_test.owner')::uuid,'{"test":true}');
insert into public.character_access(character_id,email,role) values
 (current_setting('nd_test.card')::uuid,'nd-test-editor@example.invalid','editor'),
 (current_setting('nd_test.card')::uuid,'nd-test-viewer@example.invalid','viewer');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.editor'),'email','nd-test-editor@example.invalid','role','authenticated')::text,true);
do $$ declare n integer; begin
 update public.characters set data='{"edited":true}',revision=1 where id=current_setting('nd_test.card')::uuid and revision=0;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'FAIL editor write'; end if;
 update public.characters set data='{"stale":true}',revision=1 where id=current_setting('nd_test.card')::uuid and revision=0;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL stale save'; end if;
 begin
  insert into public.character_access(character_id,email,role) values(current_setting('nd_test.card')::uuid,'nd-test-outsider@example.invalid','editor');
  raise exception 'FAIL editor granted access';
 exception when insufficient_privilege then null; end;
 begin
  update public.characters set owner_id=current_setting('nd_test.editor')::uuid where id=current_setting('nd_test.card')::uuid;
  raise exception 'FAIL owner transfer';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.viewer'),'email','nd-test-viewer@example.invalid','role','authenticated')::text,true);
do $$ declare n integer; begin
 select count(*) into n from public.characters where id=current_setting('nd_test.card')::uuid;
 if n<>1 then raise exception 'FAIL viewer read'; end if;
 update public.characters set data='{}',revision=2 where id=current_setting('nd_test.card')::uuid;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL viewer write'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('nd_test.outsider'),'email','nd-test-outsider@example.invalid','role','authenticated')::text,true);
do $$ declare n integer; begin
 select count(*) into n from public.characters where id=current_setting('nd_test.card')::uuid;
 if n<>0 then raise exception 'FAIL outsider read'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.characters','SELECT') then raise exception 'FAIL anonymous read'; end if;
end $$;
select 'PASS: owner creation, editor update, viewer read-only, outsider denied, owner immutable, grants protected, stale revision rejected, anonymous denied' as result;
rollback;
