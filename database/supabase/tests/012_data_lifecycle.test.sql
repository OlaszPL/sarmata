begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Office A: hr, admin, evaluator, the leaver L (account, led the evaluation of O), his subordinate S, the
-- employee O with an evaluation and notes, Q (employment ended, period not over), R (still employed).
-- Office B: hr and an employee P with a note and an evaluation.
insert into public.offices (id, name) values
  ('a1313131-0000-4000-8000-000000000001', 'Urząd A'),
  ('b1313131-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('a1313131-1111-4000-8000-000000000001', 'hr@a13.test'),
  ('a1313131-1111-4000-8000-000000000002', 'admin@a13.test'),
  ('a1313131-1111-4000-8000-000000000003', 'ev@a13.test'),
  ('a1313131-1111-4000-8000-000000000004', 'leaver@a13.test'),
  ('b1313131-1111-4000-8000-000000000001', 'hr@b13.test');
insert into public.memberships (user_id, office_id, role) values
  ('a1313131-1111-4000-8000-000000000001', 'a1313131-0000-4000-8000-000000000001', 'hr'),
  ('a1313131-1111-4000-8000-000000000002', 'a1313131-0000-4000-8000-000000000001', 'admin'),
  ('a1313131-1111-4000-8000-000000000003', 'a1313131-0000-4000-8000-000000000001', 'evaluator'),
  ('a1313131-1111-4000-8000-000000000004', 'a1313131-0000-4000-8000-000000000001', 'evaluator'),
  ('b1313131-1111-4000-8000-000000000001', 'b1313131-0000-4000-8000-000000000002', 'hr');
insert into public.employees (id, office_id, first_name, last_name, email, position_title, org_unit, user_id, grade, service_status, appointment_year, grade_granted_on, supervisor_employee_id) values
  ('a1313131-2222-4000-8000-0000000000a1', 'a1313131-0000-4000-8000-000000000001', 'Lena', 'Odeszła', 'lena@a13.test', 'Kierowniczka', 'Wydział L',
   'a1313131-1111-4000-8000-000000000004', 3, 'civil_servant', 2010, '2012-01-01', null);
insert into public.employees (id, office_id, first_name, last_name, org_unit, supervisor_employee_id) values
  ('a1313131-2222-4000-8000-0000000000a2', 'a1313131-0000-4000-8000-000000000001', 'Stefan', 'Podwładny', 'Wydział L', 'a1313131-2222-4000-8000-0000000000a1'),
  ('a1313131-2222-4000-8000-0000000000a3', 'a1313131-0000-4000-8000-000000000001', 'Olek', 'Pozostały', 'Wydział O', null),
  ('a1313131-2222-4000-8000-0000000000a4', 'a1313131-0000-4000-8000-000000000001', 'Quirin', 'Później', 'Wydział Q', null),
  ('a1313131-2222-4000-8000-0000000000a5', 'a1313131-0000-4000-8000-000000000001', 'Roman', 'Zatrudniony', 'Wydział R', null),
  ('b1313131-2222-4000-8000-0000000000b1', 'b1313131-0000-4000-8000-000000000002', 'Piotr', 'Obcy', 'Wydział P', null);
update public.employees set employment_start = '2010-05-17' where id = 'a1313131-2222-4000-8000-0000000000a1';
update public.employees set employment_ended_on = '2015-06-30' where id = 'a1313131-2222-4000-8000-0000000000a1';
update public.employees set employment_ended_on = '2026-03-15' where id = 'a1313131-2222-4000-8000-0000000000a4';
insert into public.employee_retention (employee_id, office_id, retained_until) values
  ('a1313131-2222-4000-8000-0000000000a1', 'a1313131-0000-4000-8000-000000000001', '2025-12-31'),
  ('a1313131-2222-4000-8000-0000000000a4', 'a1313131-0000-4000-8000-000000000001', '2036-12-31');

insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('a1313131-3333-4000-8000-000000000001', 'test-data-lifecycle', null, true, '2016-04-23',
   '{"id":"test-data-lifecycle","effectiveFrom":"2016-04-23"}');

-- Evaluations: L has a closed one with an objection history and a closed one, O has one led by the account
-- of L, P (office B) has one.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by) values
  ('e1313131-0000-4000-8000-000000000001', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a1',
   'a1313131-1111-4000-8000-000000000003', 'a1313131-3333-4000-8000-000000000001', 'A', 'closed', '2013-01-01', '{"firstName":"Lena"}', 'a1313131-1111-4000-8000-000000000001'),
  ('e1313131-0000-4000-8000-000000000002', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a1',
   'a1313131-1111-4000-8000-000000000003', 'a1313131-3333-4000-8000-000000000001', 'A', 'closed', '2014-01-01', '{"firstName":"Lena"}', 'a1313131-1111-4000-8000-000000000001'),
  ('e1313131-0000-4000-8000-000000000003', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a3',
   'a1313131-1111-4000-8000-000000000004', 'a1313131-3333-4000-8000-000000000001', 'A', 'closed', '2025-01-01', '{}', 'a1313131-1111-4000-8000-000000000001'),
  ('e1313131-0000-4000-8000-0000000000b1', 'b1313131-0000-4000-8000-000000000002', 'b1313131-2222-4000-8000-0000000000b1',
   'b1313131-1111-4000-8000-000000000001', 'a1313131-3333-4000-8000-000000000001', 'A', 'closed', '2025-01-01', '{}', 'b1313131-1111-4000-8000-000000000001');
insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state, created_by)
select e.office_id, e.id, 1, '{"partOne":{},"partTwo":{"justification":"tekst o Lenie"}}', 'locked', 'a1313131-1111-4000-8000-000000000003'
  from public.evaluations e
 where e.id::text like '%1313131-0000-4000-8000-%';
insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, recorded_by)
select e.office_id, e.id, k.kind::public.evaluation_event_kind, k.occurred_on::date, 'a1313131-1111-4000-8000-000000000001'
  from public.evaluations e
 cross join (values ('created', '2013-01-02'), ('sheet_approved', '2013-12-01'), ('closed', '2014-01-10')) as k(kind, occurred_on)
 where e.id::text like '%1313131-0000-4000-8000-%';
insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on)
select e.id, e.office_id, 'objection', '2014-01-10' from public.evaluations e where e.id = 'e1313131-0000-4000-8000-000000000001';
insert into public.evaluation_results (evaluation_id, office_id, sheet_version, level_code, outcome, mean, second_consecutive_negative)
values ('e1313131-0000-4000-8000-000000000001', 'a1313131-0000-4000-8000-000000000001', 1, 'above', 'positive', 4.5, false);
insert into public.grade_grants (id, office_id, employee_id, evaluation_id, basis, granted_on, previous_grade, new_grade, recorded_by) values
  ('9a131313-0000-4000-8000-000000000001', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a1',
   'e1313131-0000-4000-8000-000000000001', 'by_law', '2014-03-01', 2, 3, 'a1313131-1111-4000-8000-000000000001'),
  ('9a131313-0000-4000-8000-000000000002', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a1',
   null, 'on_request', '2015-02-01', 3, 4, 'a1313131-1111-4000-8000-000000000001');

-- Notes: L and O have an old one (edited once, so it has a version) and a recent one, P has a recent one.
-- The entry time is stamped by a trigger, so the fixture sets it afterwards.
insert into public.notes (id, office_id, employee_id, author_account_id, kind, occurred_on, body) values
  ('4a131313-0000-4000-8000-000000000001', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a1', 'a1313131-1111-4000-8000-000000000003', 'observation', '2023-01-10', 'stara notatka o L'),
  ('4a131313-0000-4000-8000-000000000002', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a1', 'a1313131-1111-4000-8000-000000000003', 'observation', '2026-01-10', 'świeża notatka o L'),
  ('4a131313-0000-4000-8000-000000000003', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a3', 'a1313131-1111-4000-8000-000000000003', 'observation', '2023-01-10', 'stara notatka o O'),
  ('4a131313-0000-4000-8000-000000000004', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a3', 'a1313131-1111-4000-8000-000000000003', 'observation', '2026-02-10', 'świeża notatka o O'),
  ('4a131313-0000-4000-8000-000000000005', 'a1313131-0000-4000-8000-000000000001', 'a1313131-2222-4000-8000-0000000000a3', 'a1313131-1111-4000-8000-000000000003', 'observation', '2023-12-20', 'notatka sprzed 35 miesięcy'),
  ('4a131313-0000-4000-8000-0000000000b1', 'b1313131-0000-4000-8000-000000000002', 'b1313131-2222-4000-8000-0000000000b1', 'b1313131-1111-4000-8000-000000000001', 'observation', '2026-01-10', 'notatka w urzędzie B');
update public.notes set body = 'stara notatka o O po edycji' where id = '4a131313-0000-4000-8000-000000000003';
update public.notes set created_at = '2023-01-10' where id in ('4a131313-0000-4000-8000-000000000001', '4a131313-0000-4000-8000-000000000003');
update public.notes set created_at = '2023-10-20' where id = '4a131313-0000-4000-8000-000000000003';
update public.notes set created_at = '2023-12-20' where id = '4a131313-0000-4000-8000-000000000005';
update public.notes set created_at = '2026-01-10' where id in ('4a131313-0000-4000-8000-000000000002', '4a131313-0000-4000-8000-0000000000b1');
update public.notes set created_at = '2026-02-10' where id = '4a131313-0000-4000-8000-000000000004';

-- AI runs about O: finished and old (done, failed), running and old, recent. Requested time is stamped too.
insert into public.ai_runs (id, office_id, kind, requested_by, employee_id, input, status, output, failure_message, prompt_version) values
  ('7a131313-0000-4000-8000-000000000001', 'a1313131-0000-4000-8000-000000000001', 'sheet_draft', 'a1313131-1111-4000-8000-000000000003',
   'a1313131-2222-4000-8000-0000000000a3', '{"notes":["tekst"]}', 'done', '{"text":"wynik"}', null, 'v1'),
  ('7a131313-0000-4000-8000-000000000002', 'a1313131-0000-4000-8000-000000000001', 'quality_check', 'a1313131-1111-4000-8000-000000000003',
   'a1313131-2222-4000-8000-0000000000a3', '{"notes":["tekst"]}', 'failed', null, 'sekret w komunikacie', 'v1'),
  ('7a131313-0000-4000-8000-000000000003', 'a1313131-0000-4000-8000-000000000001', 'sheet_draft', 'a1313131-1111-4000-8000-000000000003',
   'a1313131-2222-4000-8000-0000000000a3', '{"notes":["tekst"]}', 'running', null, null, 'v1'),
  ('7a131313-0000-4000-8000-000000000004', 'a1313131-0000-4000-8000-000000000001', 'sheet_draft', 'a1313131-1111-4000-8000-000000000003',
   'a1313131-2222-4000-8000-0000000000a3', '{"notes":["tekst"]}', 'done', '{"text":"świeży"}', null, 'v1'),
  ('7a131313-0000-4000-8000-000000000005', 'a1313131-0000-4000-8000-000000000001', 'sheet_draft', 'a1313131-1111-4000-8000-000000000003',
   'a1313131-2222-4000-8000-0000000000a1', '{"notes":["o Lenie"]}', 'done', '{"text":"o Lenie"}', null, 'v1');
update public.ai_runs set requested_at = '2023-10-20' where id in ('7a131313-0000-4000-8000-000000000001', '7a131313-0000-4000-8000-000000000002', '7a131313-0000-4000-8000-000000000003');
update public.ai_runs set requested_at = '2026-10-20' where id in ('7a131313-0000-4000-8000-000000000004', '7a131313-0000-4000-8000-000000000005');
insert into public.ai_fragment_decisions (run_id, office_id, fragment, decision, final_text, decided_by) values
  ('7a131313-0000-4000-8000-000000000001', 'a1313131-0000-4000-8000-000000000001', 'text', 'edited', 'poprawiony tekst', 'a1313131-1111-4000-8000-000000000003'),
  ('7a131313-0000-4000-8000-000000000004', 'a1313131-0000-4000-8000-000000000001', 'text', 'edited', 'świeży poprawiony tekst', 'a1313131-1111-4000-8000-000000000003');

-- The facts the service would compute for the evaluations of L.
create temp table facts (body jsonb);
insert into facts values (
  '[{"evaluationId":"e1313131-0000-4000-8000-000000000001","sheetId":"A","year":2013,"orgUnit":"Wydział L","civilServant":true,"levelCode":"above","outcome":"positive","mean":4.5,"secondConsecutiveNegative":false,"gradeByLawDueYear":2014,"withConclusions":true,"gradeRequested":false,"ratings":[{"criterionId":"quality","points":5}],"objection":"none","labourCourtAppealYear":null,"evaluatorAccountId":"a1313131-1111-4000-8000-000000000003"},
    {"evaluationId":"e1313131-0000-4000-8000-000000000002","sheetId":"A","year":2013,"orgUnit":"Wydział L","civilServant":true,"levelCode":"good","outcome":"positive","mean":3.5,"secondConsecutiveNegative":false,"gradeByLawDueYear":null,"withConclusions":false,"gradeRequested":true,"ratings":[{"criterionId":"quality","points":3}],"objection":"rejected","labourCourtAppealYear":2014,"evaluatorAccountId":"a1313131-1111-4000-8000-000000000003"}]'::jsonb
);
grant select on facts to public;

-- The log only grows, for the owner too, and a marker of another transaction does not change that.
select throws_ok(
  $$delete from public.evaluation_events where evaluation_id = 'e1313131-0000-4000-8000-000000000001'$$,
  'P0001', 'evaluation events are append-only', 'delete without marker still fails'
);
insert into lifecycle.purge_marker (txid) values (1);
select throws_ok(
  $$delete from public.evaluation_events where evaluation_id = 'e1313131-0000-4000-8000-000000000001'$$,
  'P0001', 'evaluation events are append-only', 'marker from another transaction does not unlock'
);
delete from lifecycle.purge_marker where txid = 1;
select throws_ok(
  $$update public.evaluation_events set payload = '{"x":1}' where evaluation_id = 'e1313131-0000-4000-8000-000000000001'$$,
  'P0001', 'evaluation events are append-only', 'a marker never allows an update either'
);

-- Clients cannot call the system functions or touch the marker schema.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1313131-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1313131-0000-4000-8000-000000000001","office_role":"hr"}';
select throws_ok(
  $$select * from public.purge_expired_content('2026-11-21')$$,
  '42501', null, 'clients cannot call the content purge: hr'
);
select throws_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a1', '2026-11-21', '[]')$$,
  '42501', null, 'clients cannot call anonymize: hr'
);
select throws_ok(
  $$insert into lifecycle.purge_marker (txid) values (txid_current())$$,
  '42501', null, 'clients cannot write the marker'
);
set local request.jwt.claims = '{"sub":"a1313131-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1313131-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$select * from public.purge_expired_content('2026-11-21')$$,
  '42501', null, 'clients cannot call the content purge: admin'
);
select results_eq(
  $$select notes, ai_runs from public.notes_retention_preview(24)$$,
  $$values (3, 2)$$,
  'the admin sees how many notes and runs a shorter period would remove'
);
reset role;

-- Content retention (36 months by default). Today is 2026-11-21: the boundary is 2023-11-21.
select results_eq(
  $$select * from public.purge_expired_content('2026-11-21')$$,
  $$values (2, 2, 1)$$,
  'old notes, runs and decisions are counted'
);
select results_eq(
  $$select id::text from public.notes where employee_id in ('a1313131-2222-4000-8000-0000000000a1', 'a1313131-2222-4000-8000-0000000000a3') order by id$$,
  $$values ('4a131313-0000-4000-8000-000000000002'), ('4a131313-0000-4000-8000-000000000004'), ('4a131313-0000-4000-8000-000000000005')$$,
  'old notes are purged and recent stay'
);
select is_empty(
  $$select * from public.note_versions where note_id = '4a131313-0000-4000-8000-000000000003'$$,
  'note versions go with their note'
);
select results_eq(
  $$select kind::text, requested_by::text, status::text, prompt_version, input is null, output is null, failure_message is null, content_deleted_at is not null
      from public.ai_runs where id in ('7a131313-0000-4000-8000-000000000001', '7a131313-0000-4000-8000-000000000002') order by id$$,
  $$values ('sheet_draft', 'a1313131-1111-4000-8000-000000000003', 'done', 'v1', true, true, true, true),
           ('quality_check', 'a1313131-1111-4000-8000-000000000003', 'failed', 'v1', true, true, true, true)$$,
  'ai run keeps metadata and loses content'
);
select results_eq(
  $$select input is not null, content_deleted_at is null from public.ai_runs where id = '7a131313-0000-4000-8000-000000000003'$$,
  $$values (true, true)$$,
  'running ai run is untouched'
);
select results_eq(
  $$select input is not null, content_deleted_at is null from public.ai_runs where id = '7a131313-0000-4000-8000-000000000004'$$,
  $$values (true, true)$$,
  'recent ai run is untouched'
);
select results_eq(
  $$select final_text is null, content_deleted_at is not null from public.ai_fragment_decisions where run_id = '7a131313-0000-4000-8000-000000000001'$$,
  $$values (true, true)$$,
  'the text of an old decision is removed'
);
select results_eq(
  $$select final_text from public.ai_fragment_decisions where run_id = '7a131313-0000-4000-8000-000000000004'$$,
  $$values ('świeży poprawiony tekst')$$,
  'the text of a recent decision stays'
);
select results_eq(
  $$select * from public.purge_expired_content('2026-11-21')$$,
  $$values (0, 0, 0)$$,
  'second content purge changes nothing'
);
update public.office_settings set notes_retention_months = 12 where office_id = 'b1313131-0000-4000-8000-000000000002';
select results_eq(
  $$select * from public.purge_expired_content('2026-11-21')$$,
  $$values (0, 0, 0)$$,
  'a shorter period of another office changes nothing here'
);
select results_eq(
  $$select count(*)::integer from public.notes where office_id = 'b1313131-0000-4000-8000-000000000002'$$,
  $$values (1)$$,
  'a note of office B within its period stays'
);
update public.office_settings set notes_retention_months = 36 where office_id = 'b1313131-0000-4000-8000-000000000002';

-- Anonymization.
select throws_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a4', '2026-11-21', '[]')$$,
  'P0001', 'not_due', 'anonymize refuses before due date'
);
select throws_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a5', '2026-11-21', '[]')$$,
  'P0001', 'not_due', 'anonymize refuses without employment end'
);
select throws_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a1', '2025-12-31', '[]')$$,
  'P0001', 'not_due', 'the last day of retention is not yet due'
);
select throws_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a1', '2026-11-21', '[]')$$,
  'P0001', 'facts_mismatch', 'anonymize rejects incomplete facts'
);
select throws_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a1', '2026-11-21',
      (select body || '[{"evaluationId":"e1313131-0000-4000-8000-000000000003"}]'::jsonb from facts))$$,
  'P0001', 'facts_mismatch', 'anonymize rejects facts of an evaluation of somebody else'
);
select throws_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a1', '2026-11-21',
      '[{"evaluationId":"e1313131-0000-4000-8000-000000000001"},{"evaluationId":"e1313131-0000-4000-8000-000000000002"}]')$$,
  '23502', null, 'anonymize is atomic: a fact without its keys fails the whole call'
);
select results_eq(
  $$select (select count(*) from public.evaluation_events where evaluation_id in ('e1313131-0000-4000-8000-000000000001', 'e1313131-0000-4000-8000-000000000002'))::integer,
          (select first_name from public.employees where id = 'a1313131-2222-4000-8000-0000000000a1'),
          (select count(*) from public.retained_evaluation_facts)::integer$$,
  $$values (6, 'Lena', 0)$$,
  'after a failed call nothing changed'
);

select lives_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a1', '2026-11-21', (select body from facts))$$,
  'anonymize runs for a due employee'
);
select is_empty(
  $$select * from lifecycle.purge_marker where txid = txid_current()$$,
  'marker does not outlive the transaction'
);
select results_eq(
  $$select (select count(*) from public.evaluations where employee_id = 'a1313131-2222-4000-8000-0000000000a1')::integer,
          (select count(*) from public.evaluation_sheets where evaluation_id in ('e1313131-0000-4000-8000-000000000001', 'e1313131-0000-4000-8000-000000000002'))::integer,
          (select count(*) from public.evaluation_events where evaluation_id in ('e1313131-0000-4000-8000-000000000001', 'e1313131-0000-4000-8000-000000000002'))::integer,
          (select count(*) from public.evaluation_results where evaluation_id = 'e1313131-0000-4000-8000-000000000001')::integer,
          (select count(*) from public.grade_grants where employee_id = 'a1313131-2222-4000-8000-0000000000a1')::integer,
          (select count(*) from public.notes where employee_id = 'a1313131-2222-4000-8000-0000000000a1')::integer$$,
  $$values (0, 0, 0, 0, 0, 0)$$,
  'anonymize removes sheets, events, results, grants and notes'
);
select results_eq(
  $$select first_name, last_name, email is null, position_title is null, org_unit is null, grade is null,
          grade_granted_on is null, appointment_year is null, anonymized_at is not null, user_id is null,
          employment_start::text, employment_ended_on::text
      from public.employees where id = 'a1313131-2222-4000-8000-0000000000a1'$$,
  $$values ('Anonimizowany', 'pracownik', true, true, true, true, true, true, true, true, '2010-01-01', '2015-06-30')$$,
  'anonymize removes the names and the personal fields'
);
select results_eq(
  $$select input is null, content_deleted_at is not null from public.ai_runs where id = '7a131313-0000-4000-8000-000000000005'$$,
  $$values (true, true)$$,
  'anonymize removes the content of the AI runs about the employee'
);
select results_eq(
  $$select (select count(*) from auth.users where id = 'a1313131-1111-4000-8000-000000000004')::integer,
          (select count(*) from public.memberships where user_id = 'a1313131-1111-4000-8000-000000000004')::integer$$,
  $$values (0, 0)$$,
  'anonymize deletes the account and its membership'
);
select results_eq(
  $$select supervisor_employee_id::text from public.employees where id = 'a1313131-2222-4000-8000-0000000000a2'$$,
  $$values ('a1313131-2222-4000-8000-0000000000a1')$$,
  'anonymize keeps id and the subordinates'
);
select results_eq(
  $$select (select count(*) from public.evaluations where employee_id = 'a1313131-2222-4000-8000-0000000000a3')::integer,
          (select count(*) from public.evaluation_events where evaluation_id = 'e1313131-0000-4000-8000-000000000003')::integer,
          (select evaluator_account_id::text from public.evaluations where id = 'e1313131-0000-4000-8000-000000000003'),
          (select count(*) from public.notes where employee_id = 'a1313131-2222-4000-8000-0000000000a3')::integer$$,
  $$values (1, 3, 'a1313131-1111-4000-8000-000000000004', 2)$$,
  'anonymize keeps evaluations of other people, also those led by the removed account'
);
select results_eq(
  $$select (select count(*) from public.evaluations where office_id = 'b1313131-0000-4000-8000-000000000002')::integer,
          (select count(*) from public.evaluation_events where office_id = 'b1313131-0000-4000-8000-000000000002')::integer,
          (select count(*) from public.notes where office_id = 'b1313131-0000-4000-8000-000000000002')::integer$$,
  $$values (1, 3, 1)$$,
  'other office untouched'
);
select results_eq(
  $$select evaluation_id::text, year::integer, level_code, outcome, civil_servant, org_unit, objection, labour_court_appeal_year::integer
      from public.retained_evaluation_facts order by evaluation_id$$,
  $$values ('e1313131-0000-4000-8000-000000000001', 2013, 'above', 'positive', true, 'Wydział L', 'none', null::integer),
           ('e1313131-0000-4000-8000-000000000002', 2013, 'good', 'positive', true, 'Wydział L', 'rejected', 2014)$$,
  'retained facts hold the evaluation without personal data'
);
select results_eq(
  $$select basis, granted_year::integer, new_grade::integer from public.retained_grade_grants order by granted_year$$,
  $$values ('by_law', 2014, 3), ('on_request', 2015, 4)$$,
  'anonymous grade grant counts are kept'
);
select lives_ok(
  $$select public.anonymize_employee('a1313131-2222-4000-8000-0000000000a1', '2026-11-21', (select body from facts))$$,
  'second anonymize does nothing'
);

-- Reading: hr and admin see the retained facts, the evaluator does not.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1313131-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1313131-0000-4000-8000-000000000001","office_role":"hr"}';
select results_eq(
  $$select count(*)::integer from public.retained_evaluation_facts$$,
  $$values (2)$$,
  'hr reads retained facts'
);
select results_eq(
  $$select level_code, evaluations::integer, with_conclusions::integer, grade_requests::integer, grade_by_law::integer
      from public.statistics_distribution(2013) order by level_code$$,
  $$values ('above', 1, 1, 0, 0), ('good', 1, 0, 1, 0)$$,
  'distribution is the same before and after anonymization: the retained facts are counted'
);
select results_eq(
  $$select objections_rejected::integer, labour_court_appeals::integer from public.statistics_dsc_ock_counts(2013)$$,
  $$values (1, 0)$$,
  'retained objections count in the year of the sheet'
);
select results_eq(
  $$select objections_rejected::integer, labour_court_appeals::integer, grades_by_law::integer from public.statistics_dsc_ock_counts(2014)$$,
  $$values (0, 1, 1)$$,
  'retained appeals and by-law grants count in their year'
);
select results_eq(
  $$select grades_on_request::integer from public.statistics_dsc_ock_counts(2015)$$,
  $$values (1)$$,
  'retained grade grants on request count in their year'
);
select results_eq(
  $$select count(*)::integer, sum(ratings)::integer from public.statistics_criteria(2013)$$,
  $$values (2, 2)$$,
  'retained ratings count in the criteria report'
);
set local request.jwt.claims = '{"sub":"a1313131-1111-4000-8000-000000000003","role":"authenticated","office_id":"a1313131-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select * from public.retained_evaluation_facts$$,
  'the evaluator does not read retained facts'
);
select is_empty(
  $$select * from public.retained_grade_grants$$,
  'the evaluator does not read retained grade grants'
);
reset role;

select results_eq(
  $$select schedule, command like '%retention.run%' from cron.job where jobname = 'retention-daily'$$,
  $$values ('30 5 * * *', true)$$,
  'daily retention job is scheduled'
);

select * from finish();
rollback;
