begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.offices (id, name) values
  ('a1515151-0000-4000-8000-000000000001', 'Urząd A'),
  ('b1515151-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('a1515151-1111-4000-8000-000000000001', 'admin@a15.test'),
  ('a1515151-1111-4000-8000-000000000002', 'admin2@a15.test'),
  ('a1515151-1111-4000-8000-000000000003', 'hr@a15.test'),
  ('a1515151-1111-4000-8000-000000000004', 'nowy@a15.test'),
  ('a1515151-1111-4000-8000-000000000005', 'wolny@a15.test'),
  ('b1515151-1111-4000-8000-000000000001', 'obcy@b15.test');
insert into public.memberships (user_id, office_id, role) values
  ('a1515151-1111-4000-8000-000000000001', 'a1515151-0000-4000-8000-000000000001', 'admin'),
  ('a1515151-1111-4000-8000-000000000003', 'a1515151-0000-4000-8000-000000000001', 'hr'),
  ('b1515151-1111-4000-8000-000000000001', 'b1515151-0000-4000-8000-000000000002', 'admin');
-- An employee with the e-mail of the invited account already exists without an account.
insert into public.employees (id, office_id, first_name, last_name, email) values
  ('a1515151-2222-4000-8000-0000000000a1', 'a1515151-0000-4000-8000-000000000001', 'Nina', 'Wcześniej', 'nowy@a15.test');

-- admit_account: links the employee of the same e-mail, creates one otherwise.
select is(
  public.admit_account('a1515151-1111-4000-8000-000000000004', 'a1515151-0000-4000-8000-000000000001', 'evaluator', 'Nina', 'Nowa'),
  'a1515151-2222-4000-8000-0000000000a1'::uuid,
  'links the existing employee with the same e-mail and returns its id'
);
select is(
  (select user_id from public.employees where id = 'a1515151-2222-4000-8000-0000000000a1'),
  'a1515151-1111-4000-8000-000000000004'::uuid,
  'the employee now points at the account'
);
select is(
  (select role::text from public.memberships where user_id = 'a1515151-1111-4000-8000-000000000004'),
  'evaluator',
  'creates the membership with the role'
);
select lives_ok(
  $$select public.admit_account('a1515151-1111-4000-8000-000000000005', 'a1515151-0000-4000-8000-000000000001', 'hr', 'Wiktor', 'Wolny')$$,
  'admits an account without an employee record'
);
select is(
  (select count(*)::integer from public.employees where user_id = 'a1515151-1111-4000-8000-000000000005' and email = 'wolny@a15.test'),
  1,
  'and creates the employee record with the e-mail of the account'
);
select throws_ok(
  $$select public.admit_account('a1515151-1111-4000-8000-000000000004', 'a1515151-0000-4000-8000-000000000001', 'hr', 'Nina', 'Nowa')$$,
  'P0001', 'membership_exists',
  'refuses an account that already has a membership'
);
select throws_ok(
  $$select public.admit_account('a1515151-1111-4000-8000-000000000004', 'b1515151-0000-4000-8000-000000000002', 'hr', 'Nina', 'Nowa')$$,
  'P0001', 'membership_exists',
  'also when the membership is in another office'
);
select throws_ok(
  $$select public.admit_account('00000000-0000-4000-8000-000000000999', 'a1515151-0000-4000-8000-000000000001', 'hr', 'X', 'Y')$$,
  'P0001', 'account_missing',
  'refuses an unknown account'
);

-- Privileges: admit_account is for the service role only.
select function_privs_are(
  'public', 'admit_account', array['uuid', 'uuid', 'public.office_role', 'text', 'text'],
  'authenticated', array[]::text[]
);
select function_privs_are(
  'public', 'admit_account', array['uuid', 'uuid', 'public.office_role', 'text', 'text'],
  'service_role', array['EXECUTE']
);

-- hr: no access to role changes and ending memberships.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1515151-1111-4000-8000-000000000003","role":"authenticated","office_id":"a1515151-0000-4000-8000-000000000001","office_role":"hr"}';
select throws_ok(
  $$select public.change_member_role('a1515151-1111-4000-8000-000000000004', 'hr')$$,
  '42501', null, 'hr cannot change a role'
);
select throws_ok(
  $$select public.end_membership('a1515151-1111-4000-8000-000000000004')$$,
  '42501', null, 'hr cannot end a membership'
);

-- Admin A.
set local request.jwt.claims = '{"sub":"a1515151-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1515151-0000-4000-8000-000000000001","office_role":"admin"}';
select lives_ok(
  $$select public.change_member_role('a1515151-1111-4000-8000-000000000004', 'hr')$$,
  'the admin changes a role'
);
select is(
  (select role::text from public.memberships where user_id = 'a1515151-1111-4000-8000-000000000004'),
  'hr',
  'the role is stored'
);
select throws_ok(
  $$select public.change_member_role('b1515151-1111-4000-8000-000000000001', 'hr')$$,
  'P0001', 'membership_missing',
  'the admin cannot touch an account of another office'
);
select throws_ok(
  $$select public.change_member_role('a1515151-1111-4000-8000-000000000001', 'hr')$$,
  'P0001', 'last_admin',
  'the only admin cannot be demoted'
);
select throws_ok(
  $$select public.end_membership('a1515151-1111-4000-8000-000000000001')$$,
  'P0001', 'last_admin',
  'the only admin cannot be ended'
);

reset role;
update public.memberships set role = 'admin' where user_id = 'a1515151-1111-4000-8000-000000000004';
set local role authenticated;
select lives_ok(
  $$select public.change_member_role('a1515151-1111-4000-8000-000000000001', 'hr')$$,
  'with a second admin the first can step down'
);

-- Now N (admin) ends the membership of the former admin A.
set local request.jwt.claims = '{"sub":"a1515151-1111-4000-8000-000000000004","role":"authenticated","office_id":"a1515151-0000-4000-8000-000000000001","office_role":"admin"}';
select is(
  public.end_membership('a1515151-1111-4000-8000-000000000001'),
  0,
  'ending a membership returns the number of open evaluations the account leads'
);
reset role;
select is(
  (select ended_on from public.memberships where user_id = 'a1515151-1111-4000-8000-000000000001'),
  current_date,
  'the access ends today and the row stays'
);
select is(
  (access.custom_access_token_hook(
     '{"user_id":"a1515151-1111-4000-8000-000000000001","claims":{}}'::jsonb
   ) -> 'claims') ? 'office_id',
  false,
  'the token of the ended account carries no office'
);

-- Reactivation: inviting the ended account again restores the membership and keeps its employee record.
select lives_ok(
  $$select public.admit_account('a1515151-1111-4000-8000-000000000001', 'a1515151-0000-4000-8000-000000000001', 'evaluator', 'Anna', 'Admin')$$,
  'an ended membership of the same office is reactivated'
);
select is(
  (select ended_on is null and role = 'evaluator' from public.memberships where user_id = 'a1515151-1111-4000-8000-000000000001'),
  true,
  'with the new role and no end date'
);
select throws_ok(
  $$select public.admit_account('a1515151-1111-4000-8000-000000000001', 'a1515151-0000-4000-8000-000000000001', 'hr', 'Anna', 'Admin')$$,
  'P0001', 'membership_exists',
  'an active membership is not reactivated'
);

select * from finish();
rollback;
