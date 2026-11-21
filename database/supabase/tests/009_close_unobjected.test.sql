begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Today is 2026-12-01. Objection windows end before it for c1 and c6, not yet for c2.
insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'hr@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'ev@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'admin@a.test'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'hr@b.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hr'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'admin'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'hr');
insert into public.employees (id, office_id, first_name, last_name) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna'),
  ('bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Jan', 'Obcy');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'test-closing', null, true, '2016-04-23',
   '{"id":"test-closing","effectiveFrom":"2016-04-23"}');

-- c1 delivered, window over (closes), also has an overdue evaluator deadline
-- c2 delivered, window ends today (stays)
-- c3 objection, c4 delivered but suspended, c5 drafted with a stray objection slot, c7 delivered, suspended with a date
-- c6 delivered in office B, window over (closes)
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'delivered', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'delivered', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'objection', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'delivered', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'drafted', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'delivered', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-1111-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'delivered', '2026-01-01', '{}', 'bbbbbbbb-1111-4000-8000-000000000001');
insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on, suspended_since) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'objection', '2026-11-30', null),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluationOnPositionChange', '2026-11-20', null),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'objection', '2026-12-01', null),
  ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'objection', '2026-11-30', null),
  ('cccccccc-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'objection', null, '2026-11-25'),
  ('cccccccc-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'objection', '2026-11-30', null),
  ('cccccccc-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 'objection', '2026-11-30', '2026-11-25'),
  ('cccccccc-0000-4000-8000-000000000006', 'bbbbbbbb-0000-4000-8000-000000000002', 'objection', '2026-11-30', null);

-- An overdue task exists before the evaluation closes.
create temp table collected (label text, created integer, queued integer, resolved integer);
insert into collected select 'before', * from public.collect_notifications('2026-12-01');
select ok(
  (select count(*) from public.notifications
    where evaluation_id = 'cccccccc-0000-4000-8000-000000000001' and kind = 'deadline_overdue' and status = 'open') = 2,
  'overdue tasks exist before closing'
);

create temp table closed_first as select * from public.close_unobjected_evaluations('2026-12-01');
create temp table closed_second as select * from public.close_unobjected_evaluations('2026-12-01');

select results_eq(
  $$select id::text, status::text from public.evaluations
     where id in ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000006') order by id$$,
  $$values ('cccccccc-0000-4000-8000-000000000001', 'closed'), ('cccccccc-0000-4000-8000-000000000006', 'closed')$$,
  'delivered evaluation past the objection window is closed'
);
select results_eq(
  $$select count(*), min(occurred_on)::text, min(payload ->> 'automatic'), min(recorded_by::text)
      from public.evaluation_events
     where evaluation_id = 'cccccccc-0000-4000-8000-000000000001' and kind = 'closed'$$,
  $$values (1::bigint, '2026-12-01', 'true', '00000000-0000-0000-0000-000000000000')$$,
  'closing records one automatic closed event by the system author'
);
select is(
  (select count(*) from closed_second)::integer, 0,
  'second run closes nothing'
);
select is(
  (select due_on from public.evaluation_deadlines
    where evaluation_id = 'cccccccc-0000-4000-8000-000000000001' and slot = 'objection'),
  null::date,
  'closing clears the objection deadline of the closed evaluation'
);
select results_eq(
  $$select count(*) from public.evaluation_events
     where evaluation_id = 'cccccccc-0000-4000-8000-000000000001' and kind = 'closed'$$,
  $$values (1::bigint)$$,
  'second run adds no second event'
);
select is(
  (select status::text from public.evaluations where id = 'cccccccc-0000-4000-8000-000000000002'),
  'delivered', 'evaluation inside the window stays'
);
select is(
  (select status::text from public.evaluations where id = 'cccccccc-0000-4000-8000-000000000003'),
  'objection', 'evaluation with objection stays'
);
select results_eq(
  $$select status::text from public.evaluations
     where id in ('cccccccc-0000-4000-8000-000000000004', 'cccccccc-0000-4000-8000-000000000007') order by id$$,
  $$values ('delivered'), ('delivered')$$,
  'suspended slot stays'
);
select is(
  (select status::text from public.evaluations where id = 'cccccccc-0000-4000-8000-000000000005'),
  'drafted', 'other statuses stay'
);
select results_eq(
  $$select e.office_id::text from public.evaluation_events e
     where e.kind = 'closed' and e.evaluation_id in
       ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000006')
     order by e.evaluation_id$$,
  $$values ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002')$$,
  'closing is per office'
);

insert into collected select 'after', * from public.collect_notifications('2026-12-01');
select results_eq(
  $$select count(*) from public.notifications
     where evaluation_id = 'cccccccc-0000-4000-8000-000000000001' and status = 'resolved' and read_at is not null$$,
  $$values (2::bigint)$$,
  'closed evaluation leaves hr tasks resolved after collect'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';
select throws_ok(
  $$select * from public.close_unobjected_evaluations('2026-12-01')$$,
  '42501', null, 'clients cannot run the closer: hr'
);
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$select * from public.close_unobjected_evaluations('2026-12-01')$$,
  '42501', null, 'clients cannot run the closer: admin'
);
reset role;

select results_eq(
  $$select count(*) from cron.job where jobname = 'close-unobjected-daily'$$,
  $$values (1::bigint)$$,
  'daily close job is scheduled'
);

select * from finish();
rollback;
