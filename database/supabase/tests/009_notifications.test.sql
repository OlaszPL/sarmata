begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Office A: two hr accounts, two evaluators, admin. Office B: hr and an evaluator with their own lead days.
-- Today is fixed: 2026-12-01. Deadlines are written as the evaluation service stores them.
insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'hr1@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'ev1@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'ev2@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'admin@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000005', 'hr2@a.test'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'hr@b.test'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'ev@b.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hr'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'admin'),
  ('aaaaaaaa-1111-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'hr'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'hr'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'evaluator');
insert into public.employees (id, office_id, first_name, last_name) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna'),
  ('bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Jan', 'Obcy');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'test-notifications', null, true, '2016-04-23',
   '{"id":"test-notifications","effectiveFrom":"2016-04-23"}');

-- Evaluations of office A (employee Ewa for all of them, ev1 = evaluator one, ev2 = evaluator two):
--   e01 ev1 period, evaluationDeadline in 10 days (reminder with lead 14)
--   e02 ev2 period, evaluationDeadline in 2 days (late first run, lead 3)
--   e03 ev1 objection, objectionDecision in 4 days (hr task)
--   e05 ev1 period, startingInterview overdue (evaluator and both hr accounts)
--   e06 hr1 period (evaluator is also hr), evaluationDeadline overdue
--   e07 ev2 delivered, gradeByLawGrant in 19 days (hr task)
--   e08 ev2 closed, startingInterview in 2 days (no reminder)
--   e09 ev2 period, suspended startingInterview (no reminder)
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'objection', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'delivered', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'closed', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}', 'bbbbbbbb-1111-4000-8000-000000000001');
insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on, suspended_since) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluationDeadline', '2026-12-11', null),
  ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluationDeadline', '2026-12-03', null),
  ('eeeeeeee-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'objectionDecision', '2026-12-05', null),
  ('eeeeeeee-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'startingInterview', '2026-11-25', null),
  ('eeeeeeee-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluationDeadline', '2026-11-20', null),
  ('eeeeeeee-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 'gradeByLawGrant', '2026-12-20', null),
  ('eeeeeeee-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000001', 'startingInterview', '2026-12-03', null),
  ('eeeeeeee-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001', 'startingInterview', null, '2026-11-01'),
  ('eeeeeeee-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000002', 'evaluationDeadline', '2026-12-11', null);
update public.office_settings set reminder_lead_days = '{7}' where office_id = 'bbbbbbbb-0000-4000-8000-000000000002';

create temp table runs (label text, created integer, queued integer, resolved integer);
grant all on runs to public;
insert into runs select 'r1', * from public.collect_notifications('2026-12-01');
insert into runs select 'r2', * from public.collect_notifications('2026-12-01');

select results_eq(
  $$select count(*), min(lead_days) from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001' and kind = 'deadline_reminder'$$,
  $$values (1::bigint, 14::smallint)$$,
  'reminder created once within lead window'
);
select results_eq(
  $$select count(*), min(lead_days) from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000002' and kind = 'deadline_reminder'$$,
  $$values (1::bigint, 3::smallint)$$,
  'late first run sends only the nearest lead'
);
select is_empty(
  $$select 1 from public.notifications where evaluation_id = 'eeeeeeee-0000-4000-8000-0000000000b1'$$,
  'office lead days are used: ten days ahead with lead 7 gives nothing'
);
select results_eq(
  $$select account_id from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000005' and kind = 'deadline_overdue'
     order by account_id$$,
  $$values ('aaaaaaaa-1111-4000-8000-000000000001'::uuid), ('aaaaaaaa-1111-4000-8000-000000000002'::uuid),
           ('aaaaaaaa-1111-4000-8000-000000000005'::uuid)$$,
  'overdue slot notifies evaluator and every hr account'
);
select results_eq(
  $$select account_id from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000006' and kind = 'deadline_overdue'
     order by account_id$$,
  $$values ('aaaaaaaa-1111-4000-8000-000000000001'::uuid), ('aaaaaaaa-1111-4000-8000-000000000005'::uuid)$$,
  'overdue slot gives one row to an evaluator who is also hr'
);
select results_eq(
  $$select account_id from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000003' and kind = 'objection_decision'
     order by account_id$$,
  $$values ('aaaaaaaa-1111-4000-8000-000000000001'::uuid), ('aaaaaaaa-1111-4000-8000-000000000005'::uuid)$$,
  'objection decision task goes to hr'
);
select results_eq(
  $$select account_id from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000007' and kind = 'grade_by_law'
     order by account_id$$,
  $$values ('aaaaaaaa-1111-4000-8000-000000000001'::uuid), ('aaaaaaaa-1111-4000-8000-000000000005'::uuid)$$,
  'grade by law task goes to hr'
);
select is_empty(
  $$select 1 from public.notifications where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000008'$$,
  'closed evaluation gets no reminder'
);
select is_empty(
  $$select 1 from public.notifications where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000009'$$,
  'suspended slot gets no reminder'
);
select is_empty(
  $$select 1 from public.notifications n
     where n.account_id in ('bbbbbbbb-1111-4000-8000-000000000001', 'bbbbbbbb-1111-4000-8000-000000000002')$$,
  'other office gets nothing'
);

select results_eq(
  $$select
      (select count(*) from public.notification_digests g
        where g.day = '2026-12-01' and g.office_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
      (select count(distinct n.account_id) from public.notifications n
        where n.office_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
      (select count(*) from pgmq.q_jobs q
        where q.message ->> 'type' = 'notifications.send_digest'
          and (q.message -> 'payload' ->> 'accountId')::uuid in
              (select m.user_id from public.memberships m where m.office_id = 'aaaaaaaa-0000-4000-8000-000000000001'))$$,
  $$values (4::bigint, 4::bigint, 4::bigint)$$,
  'one digest job per account per day'
);
select results_eq(
  $$select created, queued, resolved from runs where label = 'r2'$$,
  $$values (0, 0, 0)$$,
  'second run on the same day adds nothing'
);

-- Office lead days: the same evaluation seven days ahead now gets its reminder.
update public.evaluation_deadlines set due_on = '2026-12-08'
 where evaluation_id = 'eeeeeeee-0000-4000-8000-0000000000b1';
insert into runs select 'rx', * from public.collect_notifications('2026-12-01');
select results_eq(
  $$select account_id, lead_days from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-0000000000b1'$$,
  $$values ('bbbbbbbb-1111-4000-8000-000000000002'::uuid, 7::smallint)$$,
  'office lead days are used: seven days ahead gives a reminder with lead 7'
);

-- The inbox as a client.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select count(*) filter (where account_id = auth.uid()), count(*) filter (where account_id <> auth.uid())
      from public.notifications$$,
  $$values (2::bigint, 0::bigint)$$,
  'account reads only own notifications'
);
select results_eq(
  $$with u as (update public.notifications set read_at = now()
                where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (1::bigint)$$,
  'account marks own notification read'
);
select results_eq(
  $$with u as (update public.notifications set read_at = now()
                where account_id = 'aaaaaaaa-1111-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (0::bigint)$$,
  'account cannot mark other notification'
);
select throws_ok(
  $$update public.notifications set due_on = '2030-01-01'$$,
  '42501', null, 'account cannot change due_on'
);
select throws_ok(
  $$update public.notifications set status = 'resolved'$$,
  '42501', null, 'account cannot resolve a task by hand'
);
select throws_ok(
  $$select * from public.collect_notifications('2026-12-01')$$,
  '42501', null, 'clients cannot run collector'
);
select throws_ok(
  $$select * from public.notification_digest_facts('aaaaaaaa-1111-4000-8000-000000000002', '2026-12-01')$$,
  '42501', null, 'clients cannot read digest facts'
);
select throws_ok(
  $$select * from public.office_smtp_settings('aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null, 'clients cannot read smtp settings'
);
select throws_ok(
  $$select * from public.notification_digests$$,
  '42501', null, 'clients cannot read digests'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-4000-8000-000000000001","role":"authenticated","office_id":"bbbbbbbb-0000-4000-8000-000000000002","office_role":"hr"}';
select is_empty(
  $$select 1 from public.notifications where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'other office hr reads no notification of office A'
);
reset role;

-- Digest facts: hr1 has four open tasks (two overdue, objection, grade by law), the nearest date is the objection.
select results_eq(
  $$select office_id, email, status, unread_count, nearest_due_on
      from public.notification_digest_facts('aaaaaaaa-1111-4000-8000-000000000001', '2026-12-01')$$,
  $$values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'hr1@a.test', 'queued', 4, '2026-12-05'::date)$$,
  'digest facts count unread and nearest date'
);
select results_eq(
  $$select unread_count, nearest_due_on
      from public.notification_digest_facts('aaaaaaaa-1111-4000-8000-000000000002', '2026-12-01')$$,
  $$values (1, null::date)$$,
  'digest facts skip read ones and report null when all are overdue'
);
select is_empty(
  $$select 1 from public.notification_digest_facts('aaaaaaaa-1111-4000-8000-000000000004', '2026-12-01')$$,
  'digest facts are empty without a digest row'
);

-- SMTP settings with the password from Vault.
select is_empty(
  $$select 1 from public.office_smtp_settings('bbbbbbbb-0000-4000-8000-000000000002')$$,
  'no smtp host gives no row'
);
update public.office_settings
   set smtp_host = 'smtp.a.test', smtp_port = 587, smtp_user = 'mailer', smtp_from = 'oceny@a.test',
       smtp_password_secret_id = vault.create_secret('pa55word', 'test_smtp_password_a')
 where office_id = 'aaaaaaaa-0000-4000-8000-000000000001';
select results_eq(
  $$select host, port, username, sender, sender_name, password
      from public.office_smtp_settings('aaaaaaaa-0000-4000-8000-000000000001')$$,
  $$values ('smtp.a.test', 587, 'mailer', 'oceny@a.test', 'Urząd A', 'pa55word')$$,
  'smtp settings include vault password'
);

-- Resolving tasks.
-- e05 closes: its three overdue tasks end and leave the unread count.
update public.evaluations set status = 'closed' where id = 'eeeeeeee-0000-4000-8000-000000000005';
insert into runs select 'r4', * from public.collect_notifications('2026-12-01');
select results_eq(
  $$select count(*), count(resolved_at), count(read_at) from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000005' and status = 'resolved'$$,
  $$values (3::bigint, 3::bigint, 3::bigint)$$,
  'task resolves when evaluation closes'
);
select results_eq(
  $$select resolved from runs where label = 'r4'$$,
  $$values (3)$$,
  'closing an evaluation resolves its three tasks in the run report'
);
select results_eq(
  $$select unread_count from public.notification_digest_facts('aaaaaaaa-1111-4000-8000-000000000002', '2026-12-01')$$,
  $$values (0)$$,
  'resolved task leaves the unread count'
);

-- e07 loses its grade by law slot.
update public.evaluation_deadlines set due_on = null
 where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000007';
insert into runs select 'rx', * from public.collect_notifications('2026-12-01');
select results_eq(
  $$select count(*) filter (where status = 'resolved' and resolved_at is not null and read_at is not null),
           count(*) from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000007'$$,
  $$values (2::bigint, 2::bigint)$$,
  'task resolves when its deadline disappears'
);

-- e03 gets a new objection decision date: the old tasks end, new ones start.
update public.evaluation_deadlines set due_on = '2026-12-09'
 where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000003';
insert into runs select 'r6', * from public.collect_notifications('2026-12-01');
select results_eq(
  $$select due_on, status, count(*) from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000003'
     group by due_on, status order by due_on$$,
  $$values ('2026-12-05'::date, 'resolved', 2::bigint), ('2026-12-09'::date, 'open', 2::bigint)$$,
  'a new due date creates a new task and ends the old one'
);

-- A reminder has no task status: it stays after its deadline disappears.
delete from public.evaluation_deadlines where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001';
insert into runs select 'rx', * from public.collect_notifications('2026-12-01');
select results_eq(
  $$select status, resolved_at is null from public.notifications
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001' and kind = 'deadline_reminder'$$,
  $$values ('open', true)$$,
  'reminder is not resolved'
);

select results_eq(
  $$select count(*) from cron.job where jobname = 'notifications-daily'$$,
  $$values (1::bigint)$$,
  'daily job is scheduled'
);

-- B2 and B3 branches survive the redefinition of access.can.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$insert into public.archived_evaluations (employee_id, drafted_on)
    values ('aaaaaaaa-2222-4000-8000-000000000001', '2020-01-01')$$,
  '42501', null, 'earlier access branches still hold: admin does not archive evaluations'
);
select is_empty(
  $$select 1 from public.notes$$,
  'earlier access branches still hold: admin does not read notes'
);

reset role;
select * from finish();
rollback;
