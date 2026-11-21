begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Office A: hr, evaluator, admin. Office B: hr.
insert into public.offices (id, name) values
  ('a2a2a2a2-0000-4000-8000-000000000001', 'Urząd A'),
  ('b2b2b2b2-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('a2a2a2a2-1111-4000-8000-000000000001', 'hr@s10e.test'),
  ('a2a2a2a2-1111-4000-8000-000000000002', 'ev@s10e.test'),
  ('a2a2a2a2-1111-4000-8000-000000000004', 'admin@s10e.test'),
  ('b2b2b2b2-1111-4000-8000-000000000001', 'hr@s10eb.test');
insert into public.memberships (user_id, office_id, role) values
  ('a2a2a2a2-1111-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000001', 'hr'),
  ('a2a2a2a2-1111-4000-8000-000000000002', 'a2a2a2a2-0000-4000-8000-000000000001', 'evaluator'),
  ('a2a2a2a2-1111-4000-8000-000000000004', 'a2a2a2a2-0000-4000-8000-000000000001', 'admin'),
  ('b2b2b2b2-1111-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002', 'hr');
-- Cezary: civil servant, grade 3 since 2020-01-10. Ewa: employee, not a civil servant.
insert into public.employees (id, office_id, first_name, last_name, service_status, grade, grade_granted_on) values
  ('a2a2a2a2-2222-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000001', 'Cezary', 'Urzędnik', 'civil_servant', 3, '2020-01-10'),
  ('a2a2a2a2-2222-4000-8000-000000000002', 'a2a2a2a2-0000-4000-8000-000000000001', 'Ewa', 'Pracownik', 'employee', null, null),
  ('b2b2b2b2-2222-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002', 'Olek', 'Obcy', 'civil_servant', 2, '2019-05-01');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('a2a2a2a2-3333-4000-8000-000000000001', 'test-hr-entries', null, true, '2016-04-23',
   '{"id":"test-hr-entries","effectiveFrom":"2016-04-23"}');

-- EA closed after a rejected objection, EB closed after a changed objection (carries the grade slot),
-- EO closed after a rejected objection in office B.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
select v.id::uuid, v.office::uuid, v.employee::uuid, v.evaluator::uuid,
       'a2a2a2a2-3333-4000-8000-000000000001', 'A', 'closed', '2026-01-01', '{}', v.evaluator::uuid
  from (values
    ('e2e2e2e2-0000-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000001', 'a2a2a2a2-2222-4000-8000-000000000001', 'a2a2a2a2-1111-4000-8000-000000000002'),
    ('e2e2e2e2-0000-4000-8000-000000000002', 'a2a2a2a2-0000-4000-8000-000000000001', 'a2a2a2a2-2222-4000-8000-000000000001', 'a2a2a2a2-1111-4000-8000-000000000002'),
    ('e2e2e2e2-0000-4000-8000-0000000000b1', 'b2b2b2b2-0000-4000-8000-000000000002', 'b2b2b2b2-2222-4000-8000-000000000001', 'b2b2b2b2-1111-4000-8000-000000000001')
  ) as v(id, office, employee, evaluator);
insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload, recorded_by)
select e.office_id, e.id, k.kind::public.evaluation_event_kind, k.on_date::date, k.payload::jsonb, e.evaluator_account_id
  from public.evaluations e
  join (values
    ('e2e2e2e2-0000-4000-8000-000000000001', 'objection_outcome', '2026-06-20', '{"outcome":"rejected"}'),
    ('e2e2e2e2-0000-4000-8000-000000000002', 'objection_outcome', '2026-06-20', '{"outcome":"changed"}'),
    ('e2e2e2e2-0000-4000-8000-0000000000b1', 'objection_outcome', '2026-06-20', '{"outcome":"rejected"}')
  ) as k(id, kind, on_date, payload) on k.id::uuid = e.id;
insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on) values
  ('e2e2e2e2-0000-4000-8000-000000000002', 'a2a2a2a2-0000-4000-8000-000000000001', 'gradeByLawGrant', '2026-09-01');
insert into public.grade_grants (office_id, employee_id, basis, granted_on, previous_grade, new_grade, recorded_by) values
  ('b2b2b2b2-0000-4000-8000-000000000002', 'b2b2b2b2-2222-4000-8000-000000000001', 'on_request', '2024-01-01', 1, 2,
   'b2b2b2b2-1111-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2a2a2a2-1111-4000-8000-000000000001","role":"authenticated","office_id":"a2a2a2a2-0000-4000-8000-000000000001","office_role":"hr"}';

-- Appeal to the labour court.
select throws_ok(
  $$select public.record_labour_court_appeal('e2e2e2e2-0000-4000-8000-000000000001', '2026-06-01')$$,
  'P0001', 'date_before_outcome', 'appeal before outcome date fails'
);
select throws_ok(
  $$select public.record_labour_court_appeal('e2e2e2e2-0000-4000-8000-000000000002', '2026-07-01')$$,
  'P0001', 'no_rejected_objection', 'appeal without rejected objection fails'
);
select lives_ok(
  $$select public.record_labour_court_appeal('e2e2e2e2-0000-4000-8000-000000000001', '2026-07-01')$$,
  'hr records labour court appeal after rejected objection'
);
select results_eq(
  $$select occurred_on, payload from public.evaluation_events
     where evaluation_id = 'e2e2e2e2-0000-4000-8000-000000000001' and kind = 'labour_court_appeal'$$,
  $$values ('2026-07-01'::date, '{}'::jsonb)$$,
  'the appeal event carries the filing date'
);
select throws_ok(
  $$select public.record_labour_court_appeal('e2e2e2e2-0000-4000-8000-000000000001', '2026-07-02')$$,
  'P0001', 'already_recorded', 'appeal twice fails already_recorded'
);
select throws_ok(
  $$select public.record_labour_court_appeal('e2e2e2e2-0000-4000-8000-0000000000b1', '2026-07-01')$$,
  '42501', null, 'appeal of another office is denied'
);
select throws_ok(
  $$insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on)
    values ('a2a2a2a2-0000-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-000000000002', 'labour_court_appeal', '2026-07-01')$$,
  'P0001', 'this event is recorded only through its RPC', 'client cannot insert appeal event directly'
);

-- Grade grants.
select lives_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000001', null, 'on_request', '2026-07-01', 4::smallint)$$,
  'hr grants grade on request without evaluation'
);
select results_eq(
  $$select grade::int, grade_granted_on from public.employees where id = 'a2a2a2a2-2222-4000-8000-000000000001'$$,
  $$values (4, '2026-07-01'::date)$$,
  'the grade and its date of the employee change'
);
select results_eq(
  $$select previous_grade::int, new_grade::int, basis from public.grade_grants
     where employee_id = 'a2a2a2a2-2222-4000-8000-000000000001'$$,
  $$values (3, 4, 'on_request')$$,
  'the register row keeps the previous grade'
);
select throws_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000001', null, 'on_request', '2026-07-02', 4::smallint)$$,
  'P0001', 'grade_not_higher', 'grade must be higher'
);
select throws_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000001', null, 'on_request', '2026-06-01', 5::smallint)$$,
  'P0001', 'date_before_previous_grant', 'grant date before previous grant fails'
);
select throws_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000002', null, 'on_request', '2026-07-01', 2::smallint)$$,
  'P0001', 'not_civil_servant', 'employee who is not a civil servant fails'
);
select throws_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000001', null, 'by_law', '2026-08-01', 5::smallint)$$,
  'P0001', 'evaluation_required', 'by law needs evaluation'
);
select lives_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-000000000002', 'by_law', '2026-08-01', 5::smallint)$$,
  'hr grants grade by law and slot is removed'
);
select is_empty(
  $$select 1 from public.evaluation_deadlines
     where evaluation_id = 'e2e2e2e2-0000-4000-8000-000000000002' and slot = 'gradeByLawGrant'$$,
  'the grade by law slot of the evaluation is gone'
);
select throws_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000001', 'e2e2e2e2-0000-4000-8000-000000000002', 'by_law', '2026-09-01', 6::smallint)$$,
  '23505', null, 'second by law grant for the evaluation fails'
);

-- The guard: an upsert of the closed slot by the evaluation service writes nothing.
reset role;
insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on) values
  ('e2e2e2e2-0000-4000-8000-000000000002', 'a2a2a2a2-0000-4000-8000-000000000001', 'gradeByLawGrant', '2026-10-01');
select is_empty(
  $$select 1 from public.evaluation_deadlines
     where evaluation_id = 'e2e2e2e2-0000-4000-8000-000000000002' and slot = 'gradeByLawGrant'$$,
  'refresh cannot bring the grade by law slot back'
);

set local role authenticated;
select results_eq(
  $$select count(*)::int from public.grade_grants where office_id = 'b2b2b2b2-0000-4000-8000-000000000002'$$,
  $$values (0)$$,
  'grade grants readable only in own office'
);
select throws_ok(
  $$insert into public.grade_grants (office_id, employee_id, basis, granted_on, new_grade)
    values ('a2a2a2a2-0000-4000-8000-000000000001', 'a2a2a2a2-2222-4000-8000-000000000001', 'on_request', '2026-10-01', 6)$$,
  '42501', null, 'clients cannot write grade grants directly'
);

-- Evaluator.
set local request.jwt.claims = '{"sub":"a2a2a2a2-1111-4000-8000-000000000002","role":"authenticated","office_id":"a2a2a2a2-0000-4000-8000-000000000001","office_role":"evaluator"}';
select throws_ok(
  $$select public.record_labour_court_appeal('e2e2e2e2-0000-4000-8000-000000000001', '2026-07-05')$$,
  '42501', null, 'evaluator cannot record appeal'
);

-- Admin.
set local request.jwt.claims = '{"sub":"a2a2a2a2-1111-4000-8000-000000000004","role":"authenticated","office_id":"a2a2a2a2-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$select public.record_grade_grant('a2a2a2a2-2222-4000-8000-000000000001', null, 'on_request', '2026-10-01', 6::smallint)$$,
  '42501', null, 'admin cannot grant grade'
);
update public.office_settings
   set evaluator_flag_min_evaluations = 3, evaluator_flag_central_share = 0.75, evaluator_flag_leniency_points = 1.5
 where office_id = 'a2a2a2a2-0000-4000-8000-000000000001';
select results_eq(
  $$select evaluator_flag_min_evaluations::int, evaluator_flag_central_share, evaluator_flag_leniency_points
      from public.office_settings where office_id = 'a2a2a2a2-0000-4000-8000-000000000001'$$,
  $$values (3, 0.75::numeric, 1.5::numeric)$$,
  'admin sets evaluator flag thresholds'
);
select throws_ok(
  $$update public.office_settings set evaluator_flag_central_share = 0.3 where office_id = 'a2a2a2a2-0000-4000-8000-000000000001'$$,
  '23514', null, 'threshold out of range fails for the central share'
);
select throws_ok(
  $$update public.office_settings set evaluator_flag_min_evaluations = 0 where office_id = 'a2a2a2a2-0000-4000-8000-000000000001'$$,
  '23514', null, 'threshold out of range fails for the minimum'
);
select throws_ok(
  $$insert into public.archived_evaluations (office_id, employee_id, drafted_on)
    values ('a2a2a2a2-0000-4000-8000-000000000001', 'a2a2a2a2-2222-4000-8000-000000000001', '2020-01-01')$$,
  '42501', null, 'earlier access branches still hold'
);

-- Hr cannot change the thresholds: no update policy for the role, zero rows.
set local request.jwt.claims = '{"sub":"a2a2a2a2-1111-4000-8000-000000000001","role":"authenticated","office_id":"a2a2a2a2-0000-4000-8000-000000000001","office_role":"hr"}';
with changed as (
  update public.office_settings set evaluator_flag_min_evaluations = 9
   where office_id = 'a2a2a2a2-0000-4000-8000-000000000001'
  returning 1
)
select is((select count(*)::int from changed), 0, 'hr cannot change thresholds');

select * from finish();
rollback;
