begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Office A: hr, evaluator one, evaluator two, admin. Office B: an evaluator (outside account).
insert into public.offices (id, name) values
  ('a7a7a7a7-0000-4000-8000-000000000001', 'Urząd A'),
  ('b7b7b7b7-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('a7a7a7a7-1111-4000-8000-000000000001', 'hr@a7.test'),
  ('a7a7a7a7-1111-4000-8000-000000000002', 'ev1@a7.test'),
  ('a7a7a7a7-1111-4000-8000-000000000003', 'ev2@a7.test'),
  ('a7a7a7a7-1111-4000-8000-000000000004', 'admin@a7.test'),
  ('b7b7b7b7-1111-4000-8000-000000000001', 'ev@b7.test');
insert into public.memberships (user_id, office_id, role) values
  ('a7a7a7a7-1111-4000-8000-000000000001', 'a7a7a7a7-0000-4000-8000-000000000001', 'hr'),
  ('a7a7a7a7-1111-4000-8000-000000000002', 'a7a7a7a7-0000-4000-8000-000000000001', 'evaluator'),
  ('a7a7a7a7-1111-4000-8000-000000000003', 'a7a7a7a7-0000-4000-8000-000000000001', 'evaluator'),
  ('a7a7a7a7-1111-4000-8000-000000000004', 'a7a7a7a7-0000-4000-8000-000000000001', 'admin'),
  ('b7b7b7b7-1111-4000-8000-000000000001', 'b7b7b7b7-0000-4000-8000-000000000002', 'evaluator');
insert into public.employees (id, office_id, first_name, last_name) values
  ('a7a7a7a7-2222-4000-8000-000000000001', 'a7a7a7a7-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('a7a7a7a7-3333-4000-8000-000000000001', 'test-staffing-events', null, true, '2016-04-23',
   '{"id":"test-staffing-events","effectiveFrom":"2016-04-23"}');

-- E1 delivered, E2 objection (changed), E3 objection (redraft), E4 objection (evaluator tries), E5 drafted
-- (corrections), E6 period (interrupt), E7 delivered (evaluator tries objection and interrupt), E8 closed.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
select v.id::uuid, 'a7a7a7a7-0000-4000-8000-000000000001', 'a7a7a7a7-2222-4000-8000-000000000001',
       'a7a7a7a7-1111-4000-8000-000000000002', 'a7a7a7a7-3333-4000-8000-000000000001', 'A',
       v.status::public.evaluation_status, '2026-01-01', '{}', 'a7a7a7a7-1111-4000-8000-000000000001'
  from (values
    ('e7e7e7e7-0000-4000-8000-000000000001', 'delivered'),
    ('e7e7e7e7-0000-4000-8000-000000000002', 'objection'),
    ('e7e7e7e7-0000-4000-8000-000000000003', 'objection'),
    ('e7e7e7e7-0000-4000-8000-000000000004', 'objection'),
    ('e7e7e7e7-0000-4000-8000-000000000005', 'drafted'),
    ('e7e7e7e7-0000-4000-8000-000000000006', 'period'),
    ('e7e7e7e7-0000-4000-8000-000000000007', 'delivered'),
    ('e7e7e7e7-0000-4000-8000-000000000008', 'closed')
  ) as v(id, status);
insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state, created_by)
select 'a7a7a7a7-0000-4000-8000-000000000001', ('e7e7e7e7-0000-4000-8000-00000000000' || n)::uuid, 1,
       '{"partOne":{"criteria":["a"]},"partTwo":{"score":3}}',
       case when n = 6 then 'draft' else 'locked' end, 'a7a7a7a7-1111-4000-8000-000000000002'
  from generate_series(1, 8) as n;

-- Hr: files an objection and rejects it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a7a7a7a7-1111-4000-8000-000000000001","role":"authenticated","office_id":"a7a7a7a7-0000-4000-8000-000000000001","office_role":"hr"}';

select lives_ok(
  $$select public.apply_evaluation_transition('e7e7e7e7-0000-4000-8000-000000000001', 'delivered', 'objection', 'objection_filed', '2026-06-10', '{}', false)$$,
  'hr files objection and rejects it: objection filed'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'e7e7e7e7-0000-4000-8000-000000000001'$$,
  $$values ('objection')$$,
  'objection filed moves the evaluation to objection'
);
select lives_ok(
  $$select public.apply_objection_outcome('e7e7e7e7-0000-4000-8000-000000000001', 'rejected', '2026-06-20', '{"note":"x"}', null)$$,
  'hr files objection and rejects it: outcome rejected'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'e7e7e7e7-0000-4000-8000-000000000001'$$,
  $$values ('closed')$$,
  'rejected objection closes the evaluation'
);
select results_eq(
  $$select payload ->> 'outcome', payload ->> 'note', (payload ->> 'sheetVersion')::int, length(payload ->> 'sheetSha256')
      from public.evaluation_events where evaluation_id = 'e7e7e7e7-0000-4000-8000-000000000001' and kind = 'objection_outcome'$$,
  $$values ('rejected', 'x', 1, 64)$$,
  'objection outcome event carries outcome, caller payload, sheet version and hash'
);
select results_eq(
  $$select state from public.evaluation_sheets where evaluation_id = 'e7e7e7e7-0000-4000-8000-000000000001'$$,
  $$values ('locked')$$,
  'rejected objection leaves the locked sheet alone'
);

-- Changed outcome.
select lives_ok(
  $$select public.apply_objection_outcome('e7e7e7e7-0000-4000-8000-000000000002', 'changed', '2026-06-20', '{"reason":"lower grade"}',
      '{"partOne":{"criteria":["a"]},"partTwo":{"score":4}}')$$,
  'changed outcome supersedes and locks new version'
);
select results_eq(
  $$select version, state, content #>> '{partTwo,score}', reason from public.evaluation_sheets
     where evaluation_id = 'e7e7e7e7-0000-4000-8000-000000000002' order by version$$,
  $$values (1, 'superseded', '3', null::text), (2, 'locked', '4', 'lower grade')$$,
  'changed outcome: old version superseded, new version locked with the new content'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'e7e7e7e7-0000-4000-8000-000000000002'$$,
  $$values ('closed')$$,
  'changed outcome closes the evaluation'
);
select results_eq(
  $$select (payload ->> 'sheetVersion')::int from public.evaluation_events
     where evaluation_id = 'e7e7e7e7-0000-4000-8000-000000000002' and kind = 'objection_outcome'$$,
  $$values (2)$$,
  'changed outcome event records the new version'
);
select throws_ok(
  $$select public.apply_objection_outcome('e7e7e7e7-0000-4000-8000-000000000005', 'rejected', '2026-06-20', '{}', null)$$,
  'P0001', 'invalid_transition', 'an outcome needs status objection'
);

-- Redraft.
select lives_ok(
  $$select public.apply_objection_outcome('e7e7e7e7-0000-4000-8000-000000000003', 'redraft', '2026-06-20', '{}', null)$$,
  'redraft cancels version and returns to interview with draft copy'
);
select results_eq(
  $$select version, state, content::text from public.evaluation_sheets
     where evaluation_id = 'e7e7e7e7-0000-4000-8000-000000000003' order by version$$,
  $$values (1, 'cancelled', '{"partOne": {"criteria": ["a"]}, "partTwo": {"score": 3}}'),
           (2, 'draft', '{"partOne": {"criteria": ["a"]}, "partTwo": {"score": 3}}')$$,
  'redraft: old version cancelled, new draft is a copy of its content'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'e7e7e7e7-0000-4000-8000-000000000003'$$,
  $$values ('interview')$$,
  'redraft returns the evaluation to interview'
);
select lives_ok(
  $$select public.apply_evaluation_transition('e7e7e7e7-0000-4000-8000-000000000003', 'interview', 'drafted', 'sheet_approved', '2026-07-01', '{}', true)$$,
  'after redraft the normal path continues and locks the new draft'
);

-- Interrupt from period, hr.
select lives_ok(
  $$select public.apply_evaluation_transition('e7e7e7e7-0000-4000-8000-000000000006', 'period', 'interrupted', 'interrupted', '2026-06-01', '{"reason":"x"}', false)$$,
  'interrupt from period'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'e7e7e7e7-0000-4000-8000-000000000006'$$,
  $$values ('interrupted')$$,
  'interrupt moves the evaluation to interrupted'
);

-- Hr changes evaluator.
select lives_ok(
  $$select public.change_evaluator('e7e7e7e7-0000-4000-8000-000000000008', 'a7a7a7a7-1111-4000-8000-000000000003', '2026-06-01', 'leave')$$,
  'hr changes evaluator'
);
select results_eq(
  $$select e.evaluator_account_id, (v.payload ->> 'from')::uuid, (v.payload ->> 'to')::uuid, v.payload ->> 'reason'
      from public.evaluations e join public.evaluation_events v on v.evaluation_id = e.id and v.kind = 'evaluator_changed'
     where e.id = 'e7e7e7e7-0000-4000-8000-000000000008'$$,
  $$values ('a7a7a7a7-1111-4000-8000-000000000003'::uuid, 'a7a7a7a7-1111-4000-8000-000000000002'::uuid,
            'a7a7a7a7-1111-4000-8000-000000000003'::uuid, 'leave')$$,
  'evaluator changed event records from, to and reason'
);
select throws_ok(
  $$select public.change_evaluator('e7e7e7e7-0000-4000-8000-000000000008', 'b7b7b7b7-1111-4000-8000-000000000001', '2026-06-01', 'x')$$,
  'P0001', 'invalid_evaluator', 'change to account outside office fails'
);
select throws_ok(
  $$select public.change_evaluator('e7e7e7e7-0000-4000-8000-000000000008', 'a7a7a7a7-1111-4000-8000-000000000004', '2026-06-01', 'x')$$,
  'P0001', 'invalid_evaluator', 'change to an admin account fails'
);
select throws_ok(
  $$select public.correct_sheet('e7e7e7e7-0000-4000-8000-000000000005', '{"partOne":{"criteria":["a"]},"partTwo":{"score":5}}', 'typo')$$,
  '42501', 'insufficient_privilege', 'hr cannot correct a locked sheet'
);

-- Evaluator.
set local request.jwt.claims = '{"sub":"a7a7a7a7-1111-4000-8000-000000000002","role":"authenticated","office_id":"a7a7a7a7-0000-4000-8000-000000000001","office_role":"evaluator"}';

select throws_ok(
  $$select public.apply_objection_outcome('e7e7e7e7-0000-4000-8000-000000000004', 'rejected', '2026-06-20', '{}', null)$$,
  '42501', 'insufficient_privilege', 'evaluator cannot decide objection'
);
select throws_ok(
  $$select public.apply_evaluation_transition('e7e7e7e7-0000-4000-8000-000000000007', 'delivered', 'objection', 'objection_filed', '2026-06-10', '{}', false)$$,
  '42501', 'insufficient_privilege', 'evaluator cannot file objection'
);
select throws_ok(
  $$select public.apply_evaluation_transition('e7e7e7e7-0000-4000-8000-000000000007', 'delivered', 'interrupted', 'interrupted', '2026-06-10', '{}', false)$$,
  '42501', 'insufficient_privilege', 'evaluator cannot interrupt'
);
select throws_ok(
  $$insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on)
    values ('a7a7a7a7-0000-4000-8000-000000000001', 'e7e7e7e7-0000-4000-8000-000000000007', 'evaluator_changed', '2026-06-10')$$,
  'P0001', 'this event is recorded only through its RPC', 'a client cannot write an RPC-only event directly'
);

-- Archived evaluation: inserted by an evaluator, read by any member, not by another office.
insert into public.archived_evaluations (office_id, employee_id, drafted_on, acquainted_on, level_code, outcome, ratings) values
  ('a7a7a7a7-0000-4000-8000-000000000001', 'a7a7a7a7-2222-4000-8000-000000000001', '2024-03-01', '2024-03-10', 'good', 'positive', '{"a":4}');
select pass('archived evaluation insert by evaluator');

-- Admin.
set local request.jwt.claims = '{"sub":"a7a7a7a7-1111-4000-8000-000000000004","role":"authenticated","office_id":"a7a7a7a7-0000-4000-8000-000000000001","office_role":"admin"}';

select results_eq(
  $$select count(*)::int from public.archived_evaluations$$,
  $$values (1)$$,
  'archived evaluation read by member'
);
select throws_ok(
  $$insert into public.archived_evaluations (office_id, employee_id, drafted_on)
    values ('a7a7a7a7-0000-4000-8000-000000000001', 'a7a7a7a7-2222-4000-8000-000000000001', '2024-03-01')$$,
  '42501', null, 'admin cannot enter an archived evaluation'
);
select lives_ok(
  $$select public.correct_sheet('e7e7e7e7-0000-4000-8000-000000000005', '{"partOne":{"criteria":["a"]},"partTwo":{"score":5}}', 'typo')$$,
  'admin corrects locked sheet with reason'
);
select results_eq(
  $$select version, state, reason from public.evaluation_sheets
     where evaluation_id = 'e7e7e7e7-0000-4000-8000-000000000005' order by version$$,
  $$values (1, 'superseded', null::text), (2, 'locked', 'typo')$$,
  'correction supersedes the old version and locks the new one with the reason'
);
select results_eq(
  $$select payload ->> 'reason', (payload ->> 'sheetVersion')::int from public.evaluation_events
     where evaluation_id = 'e7e7e7e7-0000-4000-8000-000000000005' and kind = 'correction'$$,
  $$values ('typo', 2)$$,
  'correction event records reason and the new version'
);

-- Another office.
set local request.jwt.claims = '{"sub":"b7b7b7b7-1111-4000-8000-000000000001","role":"authenticated","office_id":"b7b7b7b7-0000-4000-8000-000000000002","office_role":"evaluator"}';
select results_eq(
  $$select count(*)::int from public.archived_evaluations$$,
  $$values (0)$$,
  'archived evaluations stay inside their office'
);

select * from finish();
rollback;
