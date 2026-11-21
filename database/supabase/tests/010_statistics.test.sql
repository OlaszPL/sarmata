begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Office A (visibility tree): hr, evaluator one, evaluator two, admin. Office B: hr.
insert into public.offices (id, name, evaluation_visibility) values
  ('a1a1a1a1-0000-4000-8000-000000000001', 'Urząd A', 'tree'),
  ('b1b1b1b1-0000-4000-8000-000000000002', 'Urząd B', 'office');
insert into auth.users (id, email) values
  ('a1a1a1a1-1111-4000-8000-000000000001', 'hr@s10.test'),
  ('a1a1a1a1-1111-4000-8000-000000000002', 'ev1@s10.test'),
  ('a1a1a1a1-1111-4000-8000-000000000003', 'ev2@s10.test'),
  ('a1a1a1a1-1111-4000-8000-000000000004', 'admin@s10.test'),
  ('b1b1b1b1-1111-4000-8000-000000000001', 'hr@s10b.test');
insert into public.memberships (user_id, office_id, role) values
  ('a1a1a1a1-1111-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'hr'),
  ('a1a1a1a1-1111-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'evaluator'),
  ('a1a1a1a1-1111-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'evaluator'),
  ('a1a1a1a1-1111-4000-8000-000000000004', 'a1a1a1a1-0000-4000-8000-000000000001', 'admin'),
  ('b1b1b1b1-1111-4000-8000-000000000001', 'b1b1b1b1-0000-4000-8000-000000000002', 'hr');
insert into public.employees (id, office_id, first_name, last_name) values
  ('a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'Ewa', 'Pierwsza'),
  ('a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'Jan', 'Drugi'),
  ('b1b1b1b1-2222-4000-8000-000000000001', 'b1b1b1b1-0000-4000-8000-000000000002', 'Ola', 'Obca');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('a1a1a1a1-3333-4000-8000-000000000001', 'test-statistics', null, true, '2016-04-23',
   '{"id":"test-statistics","effectiveFrom":"2016-04-23"}');

-- E1 delivered (evaluator one, locked), E2 interview (draft only), E3 drafted (evaluator two, locked),
-- B1 delivered in office B.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
select v.id::uuid, v.office::uuid, v.employee::uuid, v.evaluator::uuid,
       'a1a1a1a1-3333-4000-8000-000000000001', 'A', v.status::public.evaluation_status, '2026-01-01',
       '{"orgUnit":"Wydział X","serviceStatus":"employee"}', v.evaluator::uuid
  from (values
    ('e1e1e1e1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-1111-4000-8000-000000000002', 'delivered'),
    ('e1e1e1e1-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-1111-4000-8000-000000000002', 'interview'),
    ('e1e1e1e1-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-1111-4000-8000-000000000003', 'drafted'),
    ('e1e1e1e1-0000-4000-8000-0000000000b1', 'b1b1b1b1-0000-4000-8000-000000000002', 'b1b1b1b1-2222-4000-8000-000000000001', 'b1b1b1b1-1111-4000-8000-000000000001', 'delivered')
  ) as v(id, office, employee, evaluator, status);
insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state, created_by)
select e.office_id, e.id, 1, '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{}}}',
       case when e.status = 'interview' then 'draft' else 'locked' end, e.evaluator_account_id
  from public.evaluations e
 where e.id::text like 'e1e1e1e1-%';
insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, recorded_by)
select e.office_id, e.id, k.kind::public.evaluation_event_kind, k.on_date::date, e.evaluator_account_id
  from public.evaluations e
  join (values
    ('e1e1e1e1-0000-4000-8000-000000000001', 'sheet_approved', '2026-03-10'),
    ('e1e1e1e1-0000-4000-8000-000000000001', 'acquainted', '2026-03-12'),
    ('e1e1e1e1-0000-4000-8000-000000000003', 'sheet_approved', '2026-04-01'),
    ('e1e1e1e1-0000-4000-8000-0000000000b1', 'sheet_approved', '2026-03-10')
  ) as k(id, kind, on_date) on k.id::uuid = e.id;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1a1a1a1-0000-4000-8000-000000000001","office_role":"hr"}';

select results_eq(
  $$select drafted_on, acquainted_on, org_unit, civil_servant, sheet_version
      from public.statistics_evaluation_facts where evaluation_id = 'e1e1e1e1-0000-4000-8000-000000000001'$$,
  $$values ('2026-03-10'::date, '2026-03-12'::date, 'Wydział X', false, 1)$$,
  'facts list a drafted evaluation with drafted_on'
);
select is_empty(
  $$select 1 from public.statistics_evaluation_facts where evaluation_id = 'e1e1e1e1-0000-4000-8000-000000000002'$$,
  'facts skip an evaluation in interview'
);
select is(
  public.save_evaluation_results(
    '[{"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000001","sheet_version":1,"level_code":"meets","outcome":"positive","mean":5,"second_consecutive_negative":false,"grade_by_law_due_on":null},
      {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000003","sheet_version":1,"level_code":"above","outcome":"positive","mean":7,"second_consecutive_negative":false,"grade_by_law_due_on":null}]'::jsonb),
  2,
  'hr saves results'
);
select results_eq(
  $$select level_code, outcome, mean from public.evaluation_results where evaluation_id = 'e1e1e1e1-0000-4000-8000-000000000001'$$,
  $$values ('meets', 'positive', 5::numeric)$$,
  'hr reads results back'
);
select is(
  public.save_evaluation_results(
    '[{"evaluation_id":"e1e1e1e1-0000-4000-8000-0000000000b1","sheet_version":1,"level_code":"meets","outcome":"positive","mean":5,"second_consecutive_negative":false,"grade_by_law_due_on":null}]'::jsonb),
  0,
  'rows of another office are skipped'
);

set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4000-8000-000000000004","role":"authenticated","office_id":"a1a1a1a1-0000-4000-8000-000000000001","office_role":"admin"}';
select is(
  public.save_evaluation_results(
    '[{"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000001","sheet_version":1,"level_code":"above","outcome":"positive","mean":7,"second_consecutive_negative":false,"grade_by_law_due_on":null}]'::jsonb),
  1,
  'admin saves results'
);

set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1a1a1a1-0000-4000-8000-000000000001","office_role":"evaluator"}';
select throws_ok(
  $$select public.save_evaluation_results('[]'::jsonb)$$,
  '42501', null, 'evaluator cannot save results'
);
select results_eq(
  $$select evaluation_id from public.evaluation_results$$,
  $$values ('e1e1e1e1-0000-4000-8000-000000000001'::uuid)$$,
  'evaluator reads the result of own evaluation only'
);

select * from finish();
rollback;
