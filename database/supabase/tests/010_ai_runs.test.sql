begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Office A: hr, two evaluators, admin and a boss above evaluator one. Ewa works under evaluator one.
insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'hr@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'ev1@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'ev2@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'admin@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000005', 'boss@a.test'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'hr@b.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hr'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'admin'),
  ('aaaaaaaa-1111-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'hr');
insert into public.employees (id, office_id, first_name, last_name, user_id, supervisor_employee_id) values
  ('aaaaaaaa-2222-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'Bogdan', 'Szef', 'aaaaaaaa-1111-4000-8000-000000000005', null),
  ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Olga', 'Oceniająca', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-2222-4000-8000-000000000005'),
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna', null, 'aaaaaaaa-2222-4000-8000-000000000002');
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'test-ai', null, true, '2016-04-23',
   '{"id":"test-ai","effectiveFrom":"2016-04-23"}');
-- Open evaluation of Ewa, evaluator one.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
   'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}',
   'aaaaaaaa-1111-4000-8000-000000000001');
-- A finished sheet draft from the seed: inserted with its output, so nothing is enqueued.
insert into public.ai_runs (id, office_id, kind, requested_by, employee_id, input, status, output, prompt_version, finished_at) values
  ('44444444-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'sheet_draft',
   'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-2222-4000-8000-000000000001', '{"notes":[]}', 'done',
   '{"status":"draft"}', 'sheet-draft.v1', now());

select is_empty(
  $$select 1 from pgmq.read('jobs', 0, 100) r
     where r.message -> 'payload' ->> 'runId' = '44444444-0000-4000-8000-000000000001'$$,
  'done run from seed is not enqueued'
);

-- Evaluator one requests signals about Ewa.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';

select lives_ok(
  $$insert into public.ai_runs (kind, employee_id, input, input_refs)
    values ('hr_signals', 'aaaaaaaa-2222-4000-8000-000000000001', '{"notes":[]}', '{"noteIds":[]}')$$,
  'evaluator inserts a run'
);
select results_eq(
  $$select requested_by, office_id, status::text from public.ai_runs where kind = 'hr_signals'$$,
  $$values (auth.uid(), 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'queued')$$,
  'evaluator requests run and is its requester'
);
do $$
begin
  perform set_config('test.signals_run',
    (select id::text from public.ai_runs where kind = 'hr_signals'), true);
end $$;

select throws_ok(
  $$update public.ai_runs set output = '{"signals":[]}', status = 'done'
     where id = current_setting('test.signals_run')::uuid$$,
  '42501', null, 'client cannot update run output'
);
select throws_ok(
  $$update public.ai_runs set input = null, content_deleted_at = now()
     where id = current_setting('test.signals_run')::uuid$$,
  '42501', null, 'client cannot null run content'
);
select throws_ok(
  $$insert into public.ai_fragment_decisions (run_id, fragment, decision)
    values (current_setting('test.signals_run')::uuid, 'question.0', 'accepted')$$,
  '42501', null, 'decision on queued run rejected'
);

-- A procedure question without an employee.
select lives_ok(
  $$insert into public.ai_runs (kind, input) values ('procedure_question', '{"question":"Termin?"}')$$,
  'procedure run without employee is read only by requester: requester inserts'
);

reset role;
select results_eq(
  $$select count(*) from pgmq.read('jobs', 0, 100) r
     where r.message ->> 'type' = 'ai.run'
       and r.message -> 'payload' ->> 'runId' = current_setting('test.signals_run')$$,
  $$values (1::bigint)$$,
  'insert enqueues ai.run job'
);
-- The worker finishes the run.
update public.ai_runs set status = 'done', output = '{"signals":[]}', prompt_version = 'hr-signals.v1',
       finished_at = now()
 where id = current_setting('test.signals_run')::uuid;
set local role authenticated;

select lives_ok(
  $$insert into public.ai_fragment_decisions (run_id, fragment, decision)
    values (current_setting('test.signals_run')::uuid, 'question.0', 'accepted')$$,
  'decision on done run saved'
);
select lives_ok(
  $$insert into public.ai_fragment_decisions (run_id, fragment, decision, final_text)
    values (current_setting('test.signals_run')::uuid, 'action.0', 'edited', 'Rozmowa o priorytetach.')$$,
  'edited decision with text saved'
);
select results_eq(
  $$select fragment, decision, decided_by from public.ai_fragment_decisions order by decided_at, fragment$$,
  $$values ('action.0', 'edited', auth.uid()), ('question.0', 'accepted', auth.uid())$$,
  'decisions are read with the run'
);
select throws_ok(
  $$insert into public.ai_fragment_decisions (run_id, fragment, decision)
    values (current_setting('test.signals_run')::uuid, 'action.1', 'edited')$$,
  '23514', null, 'edited decision without text rejected'
);

-- Admin: no AI runs, no notes, no archived evaluations.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$insert into public.ai_runs (kind, employee_id, input)
    values ('hr_signals', 'aaaaaaaa-2222-4000-8000-000000000001', '{}')$$,
  '42501', null, 'admin cannot request run'
);
select throws_ok(
  $$insert into public.notes (employee_id, kind, occurred_on, body)
    values ('aaaaaaaa-2222-4000-8000-000000000001', 'observation', '2026-03-02', 'Admin')$$,
  '42501', null, 'earlier access branches still hold: admin cannot create note'
);
select throws_ok(
  $$insert into public.archived_evaluations (employee_id, drafted_on)
    values ('aaaaaaaa-2222-4000-8000-000000000001', '2020-01-01')$$,
  '42501', null, 'earlier access branches still hold: admin cannot create archived evaluation'
);
select lives_ok(
  $$update public.office_settings set appreciation_gap_days = 14
     where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'admin sets appreciation gap days: update'
);
select results_eq(
  $$select appreciation_gap_days from public.office_settings
     where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  $$values (14::smallint)$$,
  'admin sets appreciation gap days: value saved'
);
select throws_ok(
  $$update public.office_settings set appreciation_gap_days = 0
     where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514', null, 'appreciation gap out of range fails: 0'
);
select throws_ok(
  $$update public.office_settings set appreciation_gap_days = 366
     where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514', null, 'appreciation gap out of range fails: 366'
);

-- Hr: reads the run of evaluator one, not the procedure question, requests its own run.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';
select results_eq(
  $$select count(*) from public.ai_runs where id = current_setting('test.signals_run')::uuid$$,
  $$values (1::bigint)$$,
  'hr reads run about employee'
);
select is_empty(
  $$select 1 from public.ai_runs where kind = 'procedure_question'$$,
  'procedure run without employee is read only by requester: hr does not read it'
);
select results_eq(
  $$with u as (update public.office_settings set appreciation_gap_days = 60
                where office_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (0::bigint)$$,
  'hr cannot change appreciation gap days'
);
select lives_ok(
  $$insert into public.ai_runs (kind, employee_id, input)
    values ('conversation_prep', 'aaaaaaaa-2222-4000-8000-000000000001', '{"notes":[]}')$$,
  'hr requests a run'
);

-- Evaluator one reads the hr run (current evaluator of an open evaluation).
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select count(*) from public.ai_runs where kind = 'conversation_prep'$$,
  $$values (1::bigint)$$,
  'current evaluator reads run requested by hr'
);

-- Evaluator two is not the evaluator.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000003","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select 1 from public.ai_runs union all select 1 from public.ai_fragment_decisions$$,
  'other evaluator does not read run'
);

-- Supervisor: nothing in office mode, reads in tree mode.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000005","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select 1 from public.ai_runs$$,
  'supervisor reads only in tree mode: nothing in office mode'
);
reset role;
update public.offices set evaluation_visibility = 'tree' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select results_eq(
  $$select count(*) from public.ai_runs$$,
  $$values (3::bigint)$$,
  'supervisor reads only in tree mode: reads runs about the employee in tree mode'
);

-- Office B sees nothing of office A.
set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-4000-8000-000000000001","role":"authenticated","office_id":"bbbbbbbb-0000-4000-8000-000000000002","office_role":"hr"}';
select is_empty(
  $$select 1 from public.ai_runs union all select 1 from public.ai_fragment_decisions$$,
  'other office reads nothing'
);

-- AI switched off: no new runs.
reset role;
update public.office_settings set ai_enabled = false where office_id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select throws_ok(
  $$insert into public.ai_runs (kind, employee_id, input)
    values ('sheet_draft', 'aaaaaaaa-2222-4000-8000-000000000001', '{}')$$,
  '42501', null, 'request with ai disabled fails'
);

-- Retention (B9, as the owner): content goes, metadata stays.
reset role;
select lives_ok(
  $$update public.ai_runs set input = null, output = null, failure_message = null, content_deleted_at = now()
     where id = current_setting('test.signals_run')::uuid$$,
  'retention can null content and keep metadata: run update'
);
select results_eq(
  $$select kind::text, requested_by, status::text, prompt_version, input is null and output is null
      from public.ai_runs where id = current_setting('test.signals_run')::uuid$$,
  $$values ('hr_signals', 'aaaaaaaa-1111-4000-8000-000000000002'::uuid, 'done', 'hr-signals.v1', true)$$,
  'retention can null content and keep metadata: metadata kept'
);
select lives_ok(
  $$update public.ai_fragment_decisions set final_text = null, content_deleted_at = now()
     where run_id = current_setting('test.signals_run')::uuid and decision = 'edited'$$,
  'retention can null content and keep metadata: decision text nulled'
);
select throws_ok(
  $$insert into public.ai_runs (office_id, kind, requested_by, input, status)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'sheet_draft', 'aaaaaaaa-1111-4000-8000-000000000002',
            '{}', 'done')$$,
  '23514', null, 'done run without output and without content_deleted_at is rejected'
);

select * from finish();
rollback;
