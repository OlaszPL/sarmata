begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-1111-4000-8000-000000000001', 'claims', '{}'::jsonb
  )) -> 'claims' ->> 'office_id',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'hook adds office_id from the membership'
);

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'cccccccc-1111-4000-8000-000000000003', 'claims', '{"sub":"x"}'::jsonb
  )) -> 'claims',
  '{"sub":"x"}'::jsonb,
  'hook leaves claims unchanged without a membership'
);

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
  not access.can('read', 'employee', 'bbbbbbbb-0000-4000-8000-000000000002'),
  'access.can denies another office'
);

select throws_ok(
  $$insert into public.employees (office_id, first_name, last_name) values ('bbbbbbbb-0000-4000-8000-000000000002', 'X', 'Y')$$,
  '42501',
  null,
  'cannot create an employee in another office'
);

set local request.jwt.claims = '{"sub":"cccccccc-1111-4000-8000-000000000003","role":"authenticated"}';

select is_empty(
  'select 1 from public.employees',
  'without office_id in the JWT nothing is visible'
);

select * from finish();
rollback;
