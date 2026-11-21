begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fix wave for B4: the former evaluator's overdue task ends, and a grade grant ends the grade by law task.
insert into public.offices (id, name) values ('cccccccc-0000-4000-8000-000000000001', 'Urząd C');
insert into auth.users (id, email) values
  ('cccccccc-1111-4000-8000-000000000001', 'hr@c.test'),
  ('cccccccc-1111-4000-8000-000000000002', 'ev1@c.test'),
  ('cccccccc-1111-4000-8000-000000000003', 'ev2@c.test');
insert into public.memberships (user_id, office_id, role) values
  ('cccccccc-1111-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'hr'),
  ('cccccccc-1111-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001', 'evaluator'),
  ('cccccccc-1111-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000001', 'evaluator');
insert into public.employees (id, office_id, first_name, last_name) values
  ('cccccccc-2222-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'Celina', 'Cywilna'),
  ('cccccccc-2222-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001', 'Cezary', 'Cywilny');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('cccccccc-3333-4000-8000-000000000001', 'test-notification-fixes', null, true, '2016-04-23',
   '{"id":"test-notification-fixes","effectiveFrom":"2016-04-23"}');
create temp table runs (created integer, queued integer, resolved integer);

-- c01 period, ev1, startingInterview overdue. c02 delivered (Celina), c03 delivered (Cezary), both with a
-- gradeByLawGrant slot and acquainted on 2026-11-20.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by) values
  ('cccccccc-0000-4000-8000-0000000000c1', 'cccccccc-0000-4000-8000-000000000001', 'cccccccc-2222-4000-8000-000000000001', 'cccccccc-1111-4000-8000-000000000002', 'cccccccc-3333-4000-8000-000000000001', 'C', 'period', '2026-01-01', '{}', 'cccccccc-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-000000000001', 'cccccccc-2222-4000-8000-000000000001', 'cccccccc-1111-4000-8000-000000000002', 'cccccccc-3333-4000-8000-000000000001', 'C', 'delivered', '2024-01-01', '{}', 'cccccccc-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-0000000000c3', 'cccccccc-0000-4000-8000-000000000001', 'cccccccc-2222-4000-8000-000000000002', 'cccccccc-1111-4000-8000-000000000002', 'cccccccc-3333-4000-8000-000000000001', 'C', 'delivered', '2024-01-01', '{}', 'cccccccc-1111-4000-8000-000000000001');
insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, recorded_by) values
  ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-0000000000c2', 'acquainted', '2026-11-20', 'cccccccc-1111-4000-8000-000000000002'),
  ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-0000000000c3', 'acquainted', '2026-11-20', 'cccccccc-1111-4000-8000-000000000002');
insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on, suspended_since) values
  ('cccccccc-0000-4000-8000-0000000000c1', 'cccccccc-0000-4000-8000-000000000001', 'startingInterview', '2026-11-25', null),
  ('cccccccc-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-000000000001', 'gradeByLawGrant', '2026-12-20', null),
  ('cccccccc-0000-4000-8000-0000000000c3', 'cccccccc-0000-4000-8000-000000000001', 'gradeByLawGrant', '2026-12-20', null);

insert into runs select * from public.collect_notifications('2026-12-01');

-- Change of evaluator: ev1 is no longer responsible, ev2 is.
update public.evaluations set evaluator_account_id = 'cccccccc-1111-4000-8000-000000000003'
 where id = 'cccccccc-0000-4000-8000-0000000000c1';
insert into runs select * from public.collect_notifications('2026-12-02');
select results_eq(
  $$select account_id, status from public.notifications
     where evaluation_id = 'cccccccc-0000-4000-8000-0000000000c1' and kind = 'deadline_overdue'
     order by account_id$$,
  $$values ('cccccccc-1111-4000-8000-000000000001'::uuid, 'open'),
           ('cccccccc-1111-4000-8000-000000000002'::uuid, 'resolved'),
           ('cccccccc-1111-4000-8000-000000000003'::uuid, 'open')$$,
  'after a change of evaluator the former evaluator task resolves, hr and the new evaluator keep theirs'
);

-- Grade grants: on request for Celina after the acquaintance, on request for Cezary before it.
insert into public.grade_grants (office_id, employee_id, evaluation_id, basis, granted_on, new_grade, recorded_by) values
  ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-2222-4000-8000-000000000001', null, 'on_request', '2026-11-28', 3, 'cccccccc-1111-4000-8000-000000000001'),
  ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-2222-4000-8000-000000000002', null, 'on_request', '2026-10-01', 3, 'cccccccc-1111-4000-8000-000000000001');
insert into runs select * from public.collect_notifications('2026-12-03');
select results_eq(
  $$select status from public.notifications
     where evaluation_id = 'cccccccc-0000-4000-8000-0000000000c2' and kind = 'grade_by_law'$$,
  $$values ('resolved')$$,
  'a grade grant dated after the acquaintance resolves the grade by law task'
);
select results_eq(
  $$select status from public.notifications
     where evaluation_id = 'cccccccc-0000-4000-8000-0000000000c3' and kind = 'grade_by_law'$$,
  $$values ('open')$$,
  'a grade grant dated before the acquaintance leaves the task open'
);
insert into runs select * from public.collect_notifications('2026-12-04');
select results_eq(
  $$select count(*) from public.notifications
     where evaluation_id = 'cccccccc-0000-4000-8000-0000000000c2' and kind = 'grade_by_law'$$,
  $$values (1::bigint)$$,
  'a resolved grade by law task is not created again'
);

-- A by law grant on the evaluation resolves the task as well.
insert into public.grade_grants (office_id, employee_id, evaluation_id, basis, granted_on, new_grade, recorded_by) values
  ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-2222-4000-8000-000000000002', 'cccccccc-0000-4000-8000-0000000000c3', 'by_law', '2026-12-04', 4, 'cccccccc-1111-4000-8000-000000000001');
insert into runs select * from public.collect_notifications('2026-12-05');
select results_eq(
  $$select status from public.notifications
     where evaluation_id = 'cccccccc-0000-4000-8000-0000000000c3' and kind = 'grade_by_law'$$,
  $$values ('resolved')$$,
  'a by law grant on the evaluation resolves the task'
);

-- A grant before the first run of the collector creates no task at all.
delete from public.notifications where evaluation_id = 'cccccccc-0000-4000-8000-0000000000c2';
insert into runs select * from public.collect_notifications('2026-12-06');
select is_empty(
  $$select 1 from public.notifications where evaluation_id = 'cccccccc-0000-4000-8000-0000000000c2'$$,
  'no grade by law task is created once the grade was granted'
);
select is_empty(
  $$select 1 from public.notifications
     where kind = 'grade_by_law' and status = 'open'
       and office_id = 'cccccccc-0000-4000-8000-000000000001'$$,
  'no open grade by law task is left in the office'
);

select * from finish();
rollback;
