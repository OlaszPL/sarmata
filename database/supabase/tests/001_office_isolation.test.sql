begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'a@a.test'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'b@b.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hr'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'hr');
insert into public.employees (office_id, first_name, last_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Jan', 'Z-A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Ewa', 'Z-B');

select is(
  access.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-1111-4000-8000-000000000001', 'claims', '{}'::jsonb
  )) -> 'claims' ->> 'office_id',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'hook adds office_id from the membership'
);

select is(
  access.custom_access_token_hook(jsonb_build_object(
    'user_id', 'cccccccc-1111-4000-8000-000000000003', 'claims', '{"sub":"x"}'::jsonb
  )) -> 'claims',
  '{"sub":"x"}'::jsonb,
  'hook leaves claims unchanged without a membership'
);

select is(
  access.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-1111-4000-8000-000000000001', 'claims', '{}'::jsonb
  )) -> 'claims' ->> 'office_role',
  'hr',
  'hook adds office_role from the membership'
);

-- The hook runs as supabase_auth_admin: assert the grants and the policy it depends on.
select function_privs_are('access', 'custom_access_token_hook', array['jsonb'], 'supabase_auth_admin', array['EXECUTE']);
select function_privs_are('access', 'custom_access_token_hook', array['jsonb'], 'authenticated', array[]::text[]);
select function_privs_are('access', 'custom_access_token_hook', array['jsonb'], 'anon', array[]::text[]);
select table_privs_are('public', 'memberships', 'supabase_auth_admin', array['SELECT']);
select policy_roles_are('public', 'memberships', 'auth hook reads memberships', array['supabase_auth_admin']);

-- Default privileges give anon and authenticated everything: the grants must be the complete surface.
select table_privs_are('public', 'offices', 'authenticated', array['SELECT']);
select table_privs_are('public', 'memberships', 'authenticated', array['SELECT']);
select table_privs_are('public', 'employees', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'employees', 'anon', array[]::text[]);
select is_empty(
  $$select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity$$,
  'every table in public has RLS enabled'
);

-- postgres cannot become supabase_auth_admin (role memberships are reserved), so the runtime path is asserted through its privileges.
select ok(has_schema_privilege('supabase_auth_admin', 'access', 'USAGE'), 'supabase_auth_admin can use schema access');
select ok(has_schema_privilege('supabase_auth_admin', 'public', 'USAGE'), 'supabase_auth_admin can use schema public');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001"}';

select results_eq(
  'select last_name from public.employees',
  $$values ('Z-A')$$,
  'account sees only employees of its office'
);

select results_eq(
  'select name from public.offices',
  $$values ('Urząd A')$$,
  'account sees only its own office'
);

select ok(
  not access.can('read', 'employee', 'bbbbbbbb-0000-4000-8000-000000000002', null),
  'access.can denies another office'
);

select throws_ok(
  $$insert into public.employees (office_id, first_name, last_name) values ('bbbbbbbb-0000-4000-8000-000000000002', 'X', 'Y')$$,
  '42501',
  null,
  'cannot create an employee in another office'
);

select throws_ok(
  $$update public.employees set user_id = 'bbbbbbbb-1111-4000-8000-000000000002' where last_name = 'Z-A'$$,
  '23503',
  null,
  'cannot link an employee to an account of another office'
);

select lives_ok($$update public.employees set first_name = 'X' where last_name = 'Z-B'$$, 'update aimed at another office runs');
select lives_ok($$delete from public.employees where last_name = 'Z-B'$$, 'delete aimed at another office runs');
select throws_ok(
  $$update public.employees set office_id = 'bbbbbbbb-0000-4000-8000-000000000002' where last_name = 'Z-A'$$,
  '42501', null, 'cannot move an employee to another office'
);
select throws_ok($$insert into public.offices (name) values ('X')$$, '42501', null, 'cannot create an office');
select throws_ok(
  $$update public.memberships set role = 'admin' where user_id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501', null, 'cannot change own role'
);
select throws_ok($$select access.can('reed', 'employee', null, null)$$, '22P02', null, 'unknown action is rejected');

set local request.jwt.claims = '{"sub":"cccccccc-1111-4000-8000-000000000003","role":"authenticated"}';

select is_empty(
  'select 1 from public.employees',
  'without office_id in the JWT nothing is visible'
);

reset role;
select results_eq(
  $$select first_name from public.employees where last_name = 'Z-B'$$,
  $$values ('Ewa')$$,
  'employee of another office survives update and delete'
);

select * from finish();
rollback;
