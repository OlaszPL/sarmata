begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Office A: admin, hr and the evaluator of Ewa. Office B: its own admin.
insert into public.offices (id, name) values
  ('a1818181-0000-4000-8000-000000000001', 'Urząd A'),
  ('b1818181-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('a1818181-1111-4000-8000-000000000001', 'admin@a18.test'),
  ('a1818181-1111-4000-8000-000000000002', 'hr@a18.test'),
  ('a1818181-1111-4000-8000-000000000003', 'ev@a18.test'),
  ('b1818181-1111-4000-8000-000000000001', 'admin@b18.test');
insert into public.memberships (user_id, office_id, role) values
  ('a1818181-1111-4000-8000-000000000001', 'a1818181-0000-4000-8000-000000000001', 'admin'),
  ('a1818181-1111-4000-8000-000000000002', 'a1818181-0000-4000-8000-000000000001', 'hr'),
  ('a1818181-1111-4000-8000-000000000003', 'a1818181-0000-4000-8000-000000000001', 'evaluator'),
  ('b1818181-1111-4000-8000-000000000001', 'b1818181-0000-4000-8000-000000000002', 'admin');
insert into public.employees (id, office_id, first_name, last_name, user_id) values
  ('a1818181-2222-4000-8000-000000000003', 'a1818181-0000-4000-8000-000000000001', 'Olga', 'Oceniająca', 'a1818181-1111-4000-8000-000000000003'),
  ('a1818181-2222-4000-8000-000000000001', 'a1818181-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna', null);
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('a1818181-3333-4000-8000-000000000001', 'test-ai-log', null, true, '2016-04-23',
   '{"id":"test-ai-log","effectiveFrom":"2016-04-23"}');
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by) values
  ('a1818181-4444-4000-8000-000000000001', 'a1818181-0000-4000-8000-000000000001', 'a1818181-2222-4000-8000-000000000001',
   'a1818181-1111-4000-8000-000000000003', 'a1818181-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}',
   'a1818181-1111-4000-8000-000000000002');
-- A finished HR signals run of the evaluator, with its content, inserted as the worker leaves it.
insert into public.ai_runs (id, office_id, kind, requested_by, employee_id, input, status, output, model, prompt_version, output_tokens, finished_at) values
  ('a1818181-5555-4000-8000-000000000001', 'a1818181-0000-4000-8000-000000000001', 'hr_signals',
   'a1818181-1111-4000-8000-000000000003', 'a1818181-2222-4000-8000-000000000001', '{"notes":[]}', 'done',
   '{"signals":[]}', 'bielik-test + decision-test', 'hr-signals.v1', 42, now());
-- Two decisions about action.0: an older acceptance, then an edit with its text. The edit wins.
insert into public.ai_fragment_decisions (run_id, office_id, fragment, decision, decided_by) values
  ('a1818181-5555-4000-8000-000000000001', 'a1818181-0000-4000-8000-000000000001', 'action.0', 'accepted',
   'a1818181-1111-4000-8000-000000000003');
update public.ai_fragment_decisions set decided_at = now() - interval '1 hour'
 where run_id = 'a1818181-5555-4000-8000-000000000001';
insert into public.ai_fragment_decisions (run_id, office_id, fragment, decision, final_text, decided_by) values
  ('a1818181-5555-4000-8000-000000000001', 'a1818181-0000-4000-8000-000000000001', 'action.0', 'edited',
   'Rozmowa o priorytetach.', 'a1818181-1111-4000-8000-000000000003'),
  ('a1818181-5555-4000-8000-000000000001', 'a1818181-0000-4000-8000-000000000001', 'question.0', 'accepted',
   'a1818181-1111-4000-8000-000000000003');

select has_column('public', 'ai_runs', 'model', 'ai_runs has the model column');

-- The result columns are exactly the metadata: no input, output, partial_text, partial_output,
-- failure_message or final_text. Types compared as oids, so the search path does not matter.
select results_eq(
  $$select a.name::text, a.typ::oid
      from pg_proc p,
           unnest(p.proargnames, p.proallargtypes::oid[], p.proargmodes::text[])
             with ordinality as a(name, typ, mode, ord)
     where p.oid = 'public.ai_usage_log(integer)'::regprocedure and a.mode = 't'
     order by a.ord$$,
  $$values
      ('id', 'uuid'::regtype::oid),
      ('kind', 'public.ai_run_kind'::regtype::oid),
      ('status', 'public.ai_run_status'::regtype::oid),
      ('requested_by', 'uuid'::regtype::oid),
      ('requester_first_name', 'text'::regtype::oid),
      ('requester_last_name', 'text'::regtype::oid),
      ('employee_id', 'uuid'::regtype::oid),
      ('evaluation_id', 'uuid'::regtype::oid),
      ('model', 'text'::regtype::oid),
      ('prompt_version', 'text'::regtype::oid),
      ('output_tokens', 'integer'::regtype::oid),
      ('failure_reason', 'text'::regtype::oid),
      ('requested_at', 'timestamptz'::regtype::oid),
      ('started_at', 'timestamptz'::regtype::oid),
      ('finished_at', 'timestamptz'::regtype::oid),
      ('content_deleted_at', 'timestamptz'::regtype::oid),
      ('decisions', 'jsonb'::regtype::oid)$$,
  'ai_usage_log returns exactly the metadata columns'
);
select ok(
  not has_function_privilege('anon', 'public.ai_usage_log(integer)', 'execute'),
  'anon cannot execute ai_usage_log'
);

set local role authenticated;

-- Admin of office A.
set local request.jwt.claims = '{"sub":"a1818181-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1818181-0000-4000-8000-000000000001","office_role":"admin"}';
select is_empty(
  $$select 1 from public.ai_runs$$,
  'admin still reads no AI runs through the table'
);
select results_eq(
  $$select id, kind::text, status::text, requested_by, requester_first_name, requester_last_name,
           employee_id, model, prompt_version, output_tokens
      from public.ai_usage_log()$$,
  $$values ('a1818181-5555-4000-8000-000000000001'::uuid, 'hr_signals', 'done',
            'a1818181-1111-4000-8000-000000000003'::uuid, 'Olga', 'Oceniająca',
            'a1818181-2222-4000-8000-000000000001'::uuid, 'bielik-test + decision-test', 'hr-signals.v1', 42)$$,
  'admin reads the run metadata with the model and the requester name'
);
select is(
  (select jsonb_array_length(decisions) from public.ai_usage_log()),
  2,
  'decisions hold the latest decision per fragment'
);
select is(
  (select concat(decisions -> 0 ->> 'fragment', ':', decisions -> 0 ->> 'decision', ',',
                 decisions -> 1 ->> 'fragment', ':', decisions -> 1 ->> 'decision')
     from public.ai_usage_log()),
  'action.0:edited,question.0:accepted',
  'the edit wins over the older acceptance, fragments in order'
);
select is(
  (select decisions -> 0 ->> 'decidedBy' from public.ai_usage_log()),
  'a1818181-1111-4000-8000-000000000003',
  'a decision carries who decided'
);
select ok(
  (select not (decisions -> 0 ? 'finalText') and not (decisions -> 0 ? 'final_text')
          and position('Rozmowa' in decisions::text) = 0
     from public.ai_usage_log()),
  'decisions carry no final text'
);
select is(
  (select count(*)::integer from public.ai_usage_log(0)),
  1,
  'a limit below 1 is clamped to 1'
);

-- Hr and the evaluator read the run through the table, but not the usage log.
set local request.jwt.claims = '{"sub":"a1818181-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1818181-0000-4000-8000-000000000001","office_role":"hr"}';
select throws_ok(
  $$select * from public.ai_usage_log()$$,
  '42501', null, 'hr cannot read the usage log'
);
set local request.jwt.claims = '{"sub":"a1818181-1111-4000-8000-000000000003","role":"authenticated","office_id":"a1818181-0000-4000-8000-000000000001","office_role":"evaluator"}';
select throws_ok(
  $$select * from public.ai_usage_log()$$,
  '42501', null, 'evaluator cannot read the usage log'
);

-- Admin of office B sees nothing of office A.
set local request.jwt.claims = '{"sub":"b1818181-1111-4000-8000-000000000001","role":"authenticated","office_id":"b1818181-0000-4000-8000-000000000002","office_role":"admin"}';
select is_empty(
  $$select 1 from public.ai_usage_log() where id = 'a1818181-5555-4000-8000-000000000001'$$,
  'admin of another office does not see the run'
);
select is(
  (select count(*)::integer from public.ai_usage_log()),
  0,
  'admin of another office reads an empty log'
);

select * from finish();
rollback;
