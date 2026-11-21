begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

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
-- Ewa: employee on an indefinite contract, Jan: civil servant, Zofia: employee who left in June 2026.
insert into public.employees (id, office_id, first_name, last_name, service_status, grade, employment_ended_on) values
  ('a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'Ewa', 'Pierwsza', 'employee', null, null),
  ('a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'Jan', 'Drugi', 'civil_servant', 3, null),
  ('a1a1a1a1-2222-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'Zofia', 'Trzecia', 'employee', null, '2026-06-30'),
  ('b1b1b1b1-2222-4000-8000-000000000001', 'b1b1b1b1-0000-4000-8000-000000000002', 'Ola', 'Obca', 'employee', null, null);
-- The evaluator accounts are also employees, so the evaluator report has names.
insert into public.employees (office_id, first_name, last_name, user_id, service_status, grade) values
  ('a1a1a1a1-0000-4000-8000-000000000001', 'Olga', 'Oceniajaca', 'a1a1a1a1-1111-4000-8000-000000000002', 'employee', null);
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

-- Report fixtures. E4 delivered (civil servant, with conclusions and a grade request), E5 closed (negative, a far
-- below partial), E6 drafted in 2025 with a rejected objection and an appeal, E7 pending objection, E8 redraft
-- (current sheet is a draft), E9 closed (corrected at the end), E10 objection changed (v2 locked), E11 objection
-- rejected with an appeal, E12 and E13 open with deadlines.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
select v.id::uuid, 'a1a1a1a1-0000-4000-8000-000000000001', v.employee::uuid, v.evaluator::uuid,
       'a1a1a1a1-3333-4000-8000-000000000001', 'A', v.status::public.evaluation_status, '2026-01-01',
       v.snapshot::jsonb, v.evaluator::uuid
  from (values
    ('e1e1e1e1-0000-4000-8000-000000000004', 'a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-1111-4000-8000-000000000002', 'delivered', '{"orgUnit":"Wydział Y","serviceStatus":"civil_servant"}'),
    ('e1e1e1e1-0000-4000-8000-000000000005', 'a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-1111-4000-8000-000000000002', 'closed', '{"orgUnit":"Wydział X","serviceStatus":"employee"}'),
    ('e1e1e1e1-0000-4000-8000-000000000006', 'a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-1111-4000-8000-000000000003', 'closed', '{"orgUnit":"Wydział X","serviceStatus":"employee"}'),
    ('e1e1e1e1-0000-4000-8000-000000000007', 'a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-1111-4000-8000-000000000003', 'objection', '{"orgUnit":"Wydział Y","serviceStatus":"civil_servant"}'),
    ('e1e1e1e1-0000-4000-8000-000000000008', 'a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-1111-4000-8000-000000000002', 'interview', '{"orgUnit":"Wydział Y","serviceStatus":"civil_servant"}'),
    ('e1e1e1e1-0000-4000-8000-000000000009', 'a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-1111-4000-8000-000000000002', 'closed', '{"orgUnit":"Wydział X","serviceStatus":"employee"}'),
    ('e1e1e1e1-0000-4000-8000-00000000000a', 'a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-1111-4000-8000-000000000002', 'closed', '{"orgUnit":"Wydział X","serviceStatus":"employee"}'),
    ('e1e1e1e1-0000-4000-8000-00000000000b', 'a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-1111-4000-8000-000000000002', 'closed', '{"orgUnit":"Wydział X","serviceStatus":"employee"}'),
    ('e1e1e1e1-0000-4000-8000-00000000000c', 'a1a1a1a1-2222-4000-8000-000000000001', 'a1a1a1a1-1111-4000-8000-000000000002', 'period', '{"orgUnit":"Wydział X","serviceStatus":"employee"}'),
    ('e1e1e1e1-0000-4000-8000-00000000000d', 'a1a1a1a1-2222-4000-8000-000000000002', 'a1a1a1a1-1111-4000-8000-000000000003', 'interview', '{"orgUnit":"Wydział Y","serviceStatus":"civil_servant"}')
  ) as v(id, employee, evaluator, status, snapshot);
insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state, created_by)
select 'a1a1a1a1-0000-4000-8000-000000000001', v.id::uuid, v.version, v.content::jsonb, v.state, e.evaluator_account_id
  from (values
    ('e1e1e1e1-0000-4000-8000-000000000004', 1, 'locked', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{"a":5,"b":5},"developmentConclusions":"Szkolenie z komunikacji","gradeRequest":{"requestedGrade":4,"motivation":"x"}}}'),
    ('e1e1e1e1-0000-4000-8000-000000000005', 1, 'locked', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{"a":1,"b":9},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-000000000006', 1, 'locked', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-000000000007', 1, 'locked', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-000000000008', 1, 'cancelled', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-000000000008', 2, 'draft', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-000000000009', 1, 'locked', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-00000000000a', 1, 'superseded', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-00000000000a', 2, 'locked', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{"a":5,"b":7},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-00000000000b', 1, 'locked', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-00000000000c', 1, 'draft', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'),
    ('e1e1e1e1-0000-4000-8000-00000000000d', 1, 'draft', '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}')
  ) as v(id, version, state, content)
  join public.evaluations e on e.id = v.id::uuid;
insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload, recorded_by, recorded_at)
select e.office_id, e.id, k.kind::public.evaluation_event_kind, k.on_date::date, k.payload::jsonb,
       e.evaluator_account_id, k.on_date::date::timestamptz
  from public.evaluations e
  join (values
    ('e1e1e1e1-0000-4000-8000-000000000004', 'sheet_approved', '2026-05-10', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000005', 'sheet_approved', '2026-06-01', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000006', 'sheet_approved', '2025-12-20', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000006', 'objection_filed', '2025-12-25', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000006', 'objection_outcome', '2025-12-28', '{"outcome":"rejected"}'),
    ('e1e1e1e1-0000-4000-8000-000000000006', 'labour_court_appeal', '2025-12-30', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000007', 'sheet_approved', '2026-02-01', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000007', 'objection_filed', '2026-02-10', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000008', 'sheet_approved', '2026-03-01', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000008', 'objection_filed', '2026-03-05', '{}'),
    ('e1e1e1e1-0000-4000-8000-000000000008', 'objection_outcome', '2026-03-10', '{"outcome":"redraft"}'),
    ('e1e1e1e1-0000-4000-8000-000000000009', 'sheet_approved', '2026-04-20', '{}'),
    ('e1e1e1e1-0000-4000-8000-00000000000a', 'sheet_approved', '2026-04-01', '{}'),
    ('e1e1e1e1-0000-4000-8000-00000000000a', 'objection_filed', '2026-04-05', '{}'),
    ('e1e1e1e1-0000-4000-8000-00000000000a', 'objection_outcome', '2026-04-10', '{"outcome":"changed"}'),
    ('e1e1e1e1-0000-4000-8000-00000000000b', 'sheet_approved', '2026-04-02', '{}'),
    ('e1e1e1e1-0000-4000-8000-00000000000b', 'objection_filed', '2026-04-06', '{}'),
    ('e1e1e1e1-0000-4000-8000-00000000000b', 'objection_outcome', '2026-04-12', '{"outcome":"rejected"}'),
    ('e1e1e1e1-0000-4000-8000-00000000000b', 'labour_court_appeal', '2026-05-01', '{}'),
    ('e1e1e1e1-0000-4000-8000-00000000000d', 'evaluation_interview_held', '2026-09-01', '{}')
  ) as k(id, kind, on_date, payload) on k.id::uuid = e.id;
insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on, suspended_since) values
  ('e1e1e1e1-0000-4000-8000-00000000000c', 'a1a1a1a1-0000-4000-8000-000000000001', 'startingInterview', '2026-03-01', null),
  ('e1e1e1e1-0000-4000-8000-00000000000c', 'a1a1a1a1-0000-4000-8000-000000000001', 'evaluationDeadline', '2026-12-01', null),
  ('e1e1e1e1-0000-4000-8000-00000000000d', 'a1a1a1a1-0000-4000-8000-000000000001', 'evaluationDeadline', '2026-12-15', '2026-11-01');
insert into public.grade_grants (office_id, employee_id, basis, granted_on, previous_grade, new_grade, recorded_by) values
  ('a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-2222-4000-8000-000000000002', 'on_request', '2026-03-01', 2, 3, 'a1a1a1a1-1111-4000-8000-000000000001'),
  ('a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-2222-4000-8000-000000000002', 'on_request', '2025-03-01', 1, 2, 'a1a1a1a1-1111-4000-8000-000000000001');

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

-- Reports. The hr of office B saves a result of its own, it never shows in office A.
set local request.jwt.claims = '{"sub":"b1b1b1b1-1111-4000-8000-000000000001","role":"authenticated","office_id":"b1b1b1b1-0000-4000-8000-000000000002","office_role":"hr"}';
select lives_ok(
  $$select public.save_evaluation_results(
    '[{"evaluation_id":"e1e1e1e1-0000-4000-8000-0000000000b1","sheet_version":1,"level_code":"above","outcome":"positive","mean":7,"second_consecutive_negative":false,"grade_by_law_due_on":null}]'::jsonb)$$,
  'hr of another office saves its own result'
);

set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1a1a1a1-0000-4000-8000-000000000001","office_role":"hr"}';
select lives_ok(
  $$select public.save_evaluation_results($json$[
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000001","sheet_version":1,"level_code":"above","outcome":"positive","mean":7,"second_consecutive_negative":false,"grade_by_law_due_on":null},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000003","sheet_version":1,"level_code":"above","outcome":"positive","mean":7,"second_consecutive_negative":false,"grade_by_law_due_on":null},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000004","sheet_version":1,"level_code":"meets","outcome":"positive","mean":5,"second_consecutive_negative":false,"grade_by_law_due_on":"2026-09-01"},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000005","sheet_version":1,"level_code":"meets","outcome":"negative","mean":5,"second_consecutive_negative":true,"grade_by_law_due_on":null},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000006","sheet_version":1,"level_code":"above","outcome":"positive","mean":7,"second_consecutive_negative":false,"grade_by_law_due_on":null},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000007","sheet_version":1,"level_code":"above","outcome":"positive","mean":7,"second_consecutive_negative":false,"grade_by_law_due_on":null},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-000000000009","sheet_version":1,"level_code":"meets","outcome":"positive","mean":5,"second_consecutive_negative":false,"grade_by_law_due_on":null},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-00000000000a","sheet_version":2,"level_code":"meets","outcome":"positive","mean":6,"second_consecutive_negative":false,"grade_by_law_due_on":null},
    {"evaluation_id":"e1e1e1e1-0000-4000-8000-00000000000b","sheet_version":1,"level_code":"meets","outcome":"positive","mean":5,"second_consecutive_negative":false,"grade_by_law_due_on":null}
  ]$json$::jsonb)$$,
  'hr saves the results of the report fixtures'
);
select results_eq(
  $$select org_unit, civil_servant, level_code, evaluations::int, negative::int, second_negative::int,
           with_conclusions::int, grade_requests::int, grade_by_law::int
      from public.statistics_distribution(2026) order by 1, 2, 3$$,
  $$values ('Wydział X', false, 'above', 2, 0, 0, 0, 0, 0),
           ('Wydział X', false, 'meets', 4, 1, 1, 0, 0, 0),
           ('Wydział Y', true, 'above', 1, 0, 0, 0, 0, 0),
           ('Wydział Y', true, 'meets', 1, 0, 0, 1, 1, 1)$$,
  'distribution counts levels per unit and civil servants'
);
select is_empty(
  $$select 1 from public.statistics_evaluation_facts where evaluation_id = 'e1e1e1e1-0000-4000-8000-000000000008'$$,
  'redraft drops the evaluation from the distribution'
);
select results_eq(
  $$select sum(evaluations)::int from public.statistics_distribution(2026)$$,
  $$values (8)$$,
  'another office is not counted'
);
select results_eq(
  $$select objections_upheld::int from public.statistics_dsc_ock_counts(2026)$$,
  $$values (2)$$,
  'redraft counts as upheld objection'
);
select results_eq(
  $$select objections_pending::int, objections_rejected::int from public.statistics_dsc_ock_counts(2026)$$,
  $$values (1, 1)$$,
  'pending objection counted'
);
select results_eq(
  $$select labour_court_appeals::int, grades_on_request::int from public.statistics_dsc_ock_counts(2026)$$,
  $$values (1, 1)$$,
  'appeals and grades on request counted in their year'
);
select results_eq(
  $$select indefinite_employees::int, civil_servants::int from public.statistics_dsc_ock_counts(2026)$$,
  $$values (2, 1)$$,
  'employees are counted as of the end of the year'
);
select results_eq(
  $$select criterion_id, points, ratings::int from public.statistics_criteria(2026) order by 1, 2$$,
  $$values ('a', 1, 1), ('a', 5, 2), ('b', 5, 1), ('b', 7, 1), ('b', 9, 1)$$,
  'criteria ratings per points'
);
select results_eq(
  $$select evaluation_id, interview_held, suspended, starting_interview_due_on, evaluation_due_on
      from public.statistics_schedule()
     where evaluation_id in ('e1e1e1e1-0000-4000-8000-00000000000c', 'e1e1e1e1-0000-4000-8000-00000000000d')
     order by evaluation_id$$,
  $$values ('e1e1e1e1-0000-4000-8000-00000000000c'::uuid, false, false, '2026-03-01'::date, '2026-12-01'::date),
           ('e1e1e1e1-0000-4000-8000-00000000000d'::uuid, true, true, null::date, '2026-12-15'::date)$$,
  'schedule lists open evaluations with interview flag'
);
select is_empty(
  $$select 1 from public.statistics_schedule() where evaluation_id = 'e1e1e1e1-0000-4000-8000-000000000005'$$,
  'schedule skips closed evaluations'
);
select results_eq(
  $$select evaluator_name, evaluations::int, points_sum::int, ratings::int
      from public.statistics_evaluators(2026)
     where evaluator_account_id = 'a1a1a1a1-1111-4000-8000-000000000002' and level_code = 'meets'$$,
  $$values ('Olga Oceniajaca', 5, 32, 6)$$,
  'hr reads evaluators'
);

set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1a1a1a1-0000-4000-8000-000000000001","office_role":"evaluator"}';
select throws_ok(
  $$select * from public.statistics_distribution(2026)$$,
  '42501', null, 'evaluator gets 42501 from distribution'
);

set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4000-8000-000000000004","role":"authenticated","office_id":"a1a1a1a1-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$select * from public.statistics_evaluators(2026)$$,
  '42501', null, 'admin gets 42501 from evaluators'
);
select lives_ok(
  $$select public.correct_sheet('e1e1e1e1-0000-4000-8000-000000000009',
      '{"partOne":{"additionalCriteria":[],"dueOn":null},"partTwo":{"ratings":{},"developmentConclusions":"","gradeRequest":null}}'::jsonb, 'typo')$$,
  'admin corrects a locked sheet'
);
select results_eq(
  $$select sum(evaluations)::int from public.statistics_distribution(2026)$$,
  $$values (7)$$,
  'stale result row is ignored after correction'
);

select * from finish();
rollback;
