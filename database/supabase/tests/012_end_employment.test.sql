begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Office A: hr, evaluator, admin, worker W with an account. Office B: hr and an employee.
insert into public.offices (id, name) values
  ('a1212121-0000-4000-8000-000000000001', 'Urząd A'),
  ('b1212121-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('a1212121-1111-4000-8000-000000000001', 'hr@a12.test'),
  ('a1212121-1111-4000-8000-000000000002', 'ev@a12.test'),
  ('a1212121-1111-4000-8000-000000000003', 'admin@a12.test'),
  ('a1212121-1111-4000-8000-000000000004', 'w@a12.test'),
  ('b1212121-1111-4000-8000-000000000001', 'hr@b12.test');
insert into public.memberships (user_id, office_id, role) values
  ('a1212121-1111-4000-8000-000000000001', 'a1212121-0000-4000-8000-000000000001', 'hr'),
  ('a1212121-1111-4000-8000-000000000002', 'a1212121-0000-4000-8000-000000000001', 'evaluator'),
  ('a1212121-1111-4000-8000-000000000003', 'a1212121-0000-4000-8000-000000000001', 'admin'),
  ('a1212121-1111-4000-8000-000000000004', 'a1212121-0000-4000-8000-000000000001', 'evaluator'),
  ('b1212121-1111-4000-8000-000000000001', 'b1212121-0000-4000-8000-000000000002', 'hr');
-- X leaves with an open and a closed evaluation, W has an account, Y1 and Y2 are spare, Z is in office B.
insert into public.employees (id, office_id, first_name, last_name, user_id) values
  ('a1212121-2222-4000-8000-0000000000a1', 'a1212121-0000-4000-8000-000000000001', 'Xenia', 'Odchodząca', null),
  ('a1212121-2222-4000-8000-0000000000a2', 'a1212121-0000-4000-8000-000000000001', 'Wojciech', 'Konto', 'a1212121-1111-4000-8000-000000000004'),
  ('a1212121-2222-4000-8000-0000000000a3', 'a1212121-0000-4000-8000-000000000001', 'Yola', 'Pierwsza', null),
  ('a1212121-2222-4000-8000-0000000000a4', 'a1212121-0000-4000-8000-000000000001', 'Yan', 'Druga', null),
  ('b1212121-2222-4000-8000-0000000000b1', 'b1212121-0000-4000-8000-000000000002', 'Zofia', 'Obca', null);
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('a1212121-3333-4000-8000-000000000001', 'test-end-employment', null, true, '2016-04-23',
   '{"id":"test-end-employment","effectiveFrom":"2016-04-23"}');
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
values
  ('e1212121-0000-4000-8000-000000000001', 'a1212121-0000-4000-8000-000000000001', 'a1212121-2222-4000-8000-0000000000a1',
   'a1212121-1111-4000-8000-000000000002', 'a1212121-3333-4000-8000-000000000001', 'A', 'period', '2015-01-01', '{}',
   'a1212121-1111-4000-8000-000000000001'),
  ('e1212121-0000-4000-8000-000000000002', 'a1212121-0000-4000-8000-000000000001', 'a1212121-2222-4000-8000-0000000000a1',
   'a1212121-1111-4000-8000-000000000002', 'a1212121-3333-4000-8000-000000000001', 'A', 'closed', '2014-01-01', '{}',
   'a1212121-1111-4000-8000-000000000001');
insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state, created_by) values
  ('a1212121-0000-4000-8000-000000000001', 'e1212121-0000-4000-8000-000000000001', 1, '{"partOne":{},"partTwo":{}}', 'draft',
   'a1212121-1111-4000-8000-000000000002'),
  ('a1212121-0000-4000-8000-000000000001', 'e1212121-0000-4000-8000-000000000002', 1, '{"partOne":{},"partTwo":{}}', 'locked',
   'a1212121-1111-4000-8000-000000000002');

-- Evaluator: no access to ending an employment and no retention register.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1212121-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1212121-0000-4000-8000-000000000001","office_role":"evaluator"}';

select throws_ok(
  $$select * from public.end_employment('a1212121-2222-4000-8000-0000000000a1', '2015-06-30', 'resignation', '2025-12-31')$$,
  '42501', null, 'evaluator cannot end employment'
);
select throws_ok(
  $$select * from public.retention_overview(90)$$,
  '42501', null, 'evaluator cannot list the retention overview'
);
select throws_ok(
  $$select public.confirm_archive_export('a1212121-2222-4000-8000-0000000000a1')$$,
  '42501', null, 'evaluator cannot confirm an archive export'
);

-- Hr of office A.
set local request.jwt.claims = '{"sub":"a1212121-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1212121-0000-4000-8000-000000000001","office_role":"hr"}';

select results_eq(
  $$select interrupted_evaluation_id::text from public.end_employment('a1212121-2222-4000-8000-0000000000a1', '2015-06-30', 'resignation', '2025-12-31')$$,
  $$values ('e1212121-0000-4000-8000-000000000001')$$,
  'hr ends employment and interrupts open evaluation'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'e1212121-0000-4000-8000-000000000001'$$,
  $$values ('interrupted')$$,
  'the open evaluation is interrupted'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'e1212121-0000-4000-8000-000000000002'$$,
  $$values ('closed')$$,
  'closed evaluation stays closed'
);
select results_eq(
  $$select occurred_on::text, payload ->> 'reason', payload ->> 'note'
      from public.evaluation_events
     where evaluation_id = 'e1212121-0000-4000-8000-000000000001' and kind = 'interrupted'$$,
  $$values ('2015-06-30', 'employment_ended', 'resignation')$$,
  'interrupt event carries employment_ended reason'
);
select results_eq(
  $$select employment_ended_on::text from public.employees where id = 'a1212121-2222-4000-8000-0000000000a1'$$,
  $$values ('2015-06-30')$$,
  'the end date is stored on the employee'
);
select results_eq(
  $$select retained_until::text, archive_exported_at is null from public.employee_retention
     where employee_id = 'a1212121-2222-4000-8000-0000000000a1'$$,
  $$values ('2025-12-31', true)$$,
  'the retention register row starts the clock'
);
select throws_ok(
  $$select * from public.end_employment('a1212121-2222-4000-8000-0000000000a1', '2015-07-30', 'again', '2025-12-31')$$,
  'P0001', 'already_ended', 'ending twice fails already_ended'
);
select throws_ok(
  $$select * from public.end_employment('b1212121-2222-4000-8000-0000000000b1', '2026-03-15', 'x', '2036-12-31')$$,
  '42501', null, 'other office employee is denied'
);
select throws_ok(
  $$select * from public.end_employment('a1212121-2222-4000-8000-0000000000a3', '2026-03-15', 'x', '2036-12-30')$$,
  '23514', null, 'purge due before the legal date is rejected'
);
select throws_ok(
  $$select * from public.end_employment('a1212121-2222-4000-8000-0000000000a3', '2026-03-15', '  ', '2036-12-31')$$,
  '22023', null, 'empty reason is rejected'
);

-- W has an account: its access ends with the employment.
select lives_ok(
  $$select * from public.end_employment('a1212121-2222-4000-8000-0000000000a2', '2026-03-15', 'end of contract', '2036-12-31')$$,
  'hr ends the employment of an employee with an account'
);

select throws_ok(
  $$select public.confirm_archive_export('a1212121-2222-4000-8000-0000000000a4')$$,
  'P0001', 'not_ended', 'confirm before end fails not_ended'
);
select lives_ok(
  $$select public.confirm_archive_export('a1212121-2222-4000-8000-0000000000a1')$$,
  'hr confirms archive export'
);
select results_eq(
  $$select archive_exported_at is not null, archive_exported_by::text from public.employee_retention
     where employee_id = 'a1212121-2222-4000-8000-0000000000a1'$$,
  $$values (true, 'a1212121-1111-4000-8000-000000000001')$$,
  'the confirmation records who and when'
);
select results_eq(
  $$select employee_id::text from public.retention_overview(90)$$,
  $$values ('a1212121-2222-4000-8000-0000000000a1')$$,
  'overview lists employee within window and not one with ten years left'
);

set local request.jwt.claims = '{"sub":"a1212121-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1212121-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select * from public.employee_retention$$,
  'evaluator cannot read retention'
);

-- Owner path: the account of W loses the office claims, an active one keeps them.
reset role;
select is(
  (access.custom_access_token_hook(jsonb_build_object('user_id', 'a1212121-1111-4000-8000-000000000004', 'claims', '{}'::jsonb)))
    -> 'claims' ->> 'office_id',
  null,
  'an account whose employment ended gets no office in the JWT'
);
select is(
  (access.custom_access_token_hook(jsonb_build_object('user_id', 'a1212121-1111-4000-8000-000000000002', 'claims', '{}'::jsonb)))
    -> 'claims' ->> 'office_id',
  'a1212121-0000-4000-8000-000000000001',
  'an active account keeps the office in the JWT'
);
set local request.jwt.claims = '';
select throws_ok(
  $$insert into public.evaluations (office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot, created_by)
    values ('a1212121-0000-4000-8000-000000000001', 'a1212121-2222-4000-8000-0000000000a3', 'a1212121-1111-4000-8000-000000000004',
            'a1212121-3333-4000-8000-000000000001', 'A', '2026-01-01', '{}', 'a1212121-1111-4000-8000-000000000001')$$,
  '23503', null, 'an account with ended access cannot become an evaluator'
);

select * from finish();
rollback;
