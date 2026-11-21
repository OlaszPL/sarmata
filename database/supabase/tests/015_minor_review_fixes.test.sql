begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.offices (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000002', 'ev@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'admin@a.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'admin');
insert into public.employees (id, office_id, first_name, last_name) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'test-minor', null, true, '2016-04-23',
   '{"id":"test-minor","effectiveFrom":"2016-04-23"}');

select lives_ok(
  $$insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
    values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
            'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'criteria', '2026-01-01', '{}',
            'aaaaaaaa-1111-4000-8000-000000000002')$$,
  'an evaluator account can lead an evaluation'
);
select throws_ok(
  $$insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
    values ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
            'aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'criteria', '2026-01-01', '{}',
            'aaaaaaaa-1111-4000-8000-000000000002')$$,
  '23503',
  null,
  'the admin account cannot be the evaluator of a new evaluation'
);
select throws_ok(
  $$update public.evaluations set evaluator_account_id = 'aaaaaaaa-1111-4000-8000-000000000004'
     where id = 'cccccccc-0000-4000-8000-000000000001'$$,
  '23503',
  null,
  'the evaluator cannot be changed to the admin account'
);

select * from finish();
rollback;
