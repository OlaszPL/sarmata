begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into public.offices (id, name) values ('cccccccc-0000-4000-8000-000000000001', 'Urząd C');
insert into public.employees (office_id, first_name, last_name, email) values
  ('cccccccc-0000-4000-8000-000000000001', 'Ewa', 'Istniejąca', 'ewa@c.test');

select is(
  access.create_account(
    email => ' Nowy@C.test ', password => 'Haslo-Testowe-1',
    office_id => 'cccccccc-0000-4000-8000-000000000001', role => 'hr',
    first_name => 'Jan', last_name => 'Nowy',
    account_id => 'cccccccc-1111-4000-8000-000000000001'
  ),
  'cccccccc-1111-4000-8000-000000000001'::uuid,
  'returns the id of the new account'
);

select is(
  (select email from auth.users where id = 'cccccccc-1111-4000-8000-000000000001'),
  'nowy@c.test',
  'stores the e-mail trimmed and in lower case'
);
select ok(
  (select encrypted_password = extensions.crypt('Haslo-Testowe-1', encrypted_password)
     from auth.users where id = 'cccccccc-1111-4000-8000-000000000001'),
  'stores a bcrypt hash of the password'
);
select ok(
  (select email_confirmed_at is not null and confirmation_token = '' and recovery_token = ''
     from auth.users where id = 'cccccccc-1111-4000-8000-000000000001'),
  'confirms the e-mail and leaves the token columns empty, not null'
);
select is(
  (select identity_data ->> 'email' from auth.identities
    where user_id = 'cccccccc-1111-4000-8000-000000000001' and provider = 'email'),
  'nowy@c.test',
  'adds the e-mail identity'
);
select is(
  (select role::text from public.memberships where user_id = 'cccccccc-1111-4000-8000-000000000001'),
  'hr',
  'adds the membership with the role'
);
select is(
  (select first_name || ' ' || last_name from public.employees
    where user_id = 'cccccccc-1111-4000-8000-000000000001'),
  'Jan Nowy',
  'adds the employee record of the account'
);

-- An employee from HR records with the same e-mail is linked, not duplicated.
select lives_ok(
  $$select access.create_account(
      email => 'EWA@c.test', password => 'Haslo-Testowe-1',
      office_id => 'cccccccc-0000-4000-8000-000000000001', role => 'evaluator',
      first_name => 'Ewa', last_name => 'Inna',
      account_id => 'cccccccc-1111-4000-8000-000000000002'
    )$$,
  'creates an account for an existing employee'
);
select is(
  (select count(*)::int from public.employees
    where office_id = 'cccccccc-0000-4000-8000-000000000001' and lower(email) = 'ewa@c.test'),
  1,
  'keeps one employee record per e-mail'
);
select is(
  (select last_name from public.employees where user_id = 'cccccccc-1111-4000-8000-000000000002'),
  'Istniejąca',
  'links the existing employee and keeps its data'
);

select lives_ok(
  $$select access.create_account(
      email => 'ewa2@c.test', password => 'Haslo-Testowe-1',
      office_id => 'cccccccc-0000-4000-8000-000000000001', role => 'hr',
      first_name => 'Ewa', last_name => 'Druga'
    )$$,
  'creates another account in the same office'
);
select throws_ok(
  $$select access.create_account(
      email => 'ewa@c.test', password => 'Haslo-Testowe-1',
      office_id => 'cccccccc-0000-4000-8000-000000000001', role => 'hr',
      first_name => 'Ewa', last_name => 'Istniejąca'
    )$$,
  '23505',
  null,
  'refuses a second account with the same e-mail'
);

select lives_ok(
  $$select access.create_account(
      email => 'samo-konto@c.test', password => 'Haslo-Testowe-1',
      account_id => 'cccccccc-1111-4000-8000-000000000003'
    )$$,
  'creates an account without an office'
);
select is_empty(
  $$select 1 from public.memberships where user_id = 'cccccccc-1111-4000-8000-000000000003'
    union all
    select 1 from public.employees where user_id = 'cccccccc-1111-4000-8000-000000000003'$$,
  'an account without an office has no membership and no employee record'
);

select throws_ok(
  $$select access.create_account(email => 'a@c.test', password => 'Haslo-Testowe-1', role => 'hr')$$,
  'P0001',
  'office_id and role go together',
  'refuses a role without an office'
);
select throws_ok(
  $$select access.create_account(email => 'b@c.test', password => 'krotkie')$$,
  'P0001',
  'password must have at least 12 characters',
  'refuses a short password'
);

select function_privs_are(
  'access', 'create_account', array['text', 'text', 'uuid', 'public.office_role', 'text', 'text', 'uuid'],
  'authenticated', array[]::text[]
);
select function_privs_are(
  'access', 'create_account', array['text', 'text', 'uuid', 'public.office_role', 'text', 'text', 'uuid'],
  'anon', array[]::text[]
);
select function_privs_are(
  'access', 'create_account', array['text', 'text', 'uuid', 'public.office_role', 'text', 'text', 'uuid'],
  'service_role', array['EXECUTE']
);

select * from finish();
rollback;
