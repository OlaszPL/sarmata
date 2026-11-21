begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

-- Office A: hr, two evaluators, admin, a boss above evaluator one, tops of a 40 and a 60 employee chain.
-- Tree: boss (account boss) > mid (account evaluator one) > worker. Peer is evaluator two, outside that branch.
insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'hr@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'ev1@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'ev2@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'admin@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000005', 'boss@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000040', 'top40@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000060', 'top60@a.test'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'hr@b.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hr'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'admin'),
  ('aaaaaaaa-1111-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000040', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000060', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'hr');
insert into public.employees (id, office_id, first_name, last_name, user_id, supervisor_employee_id) values
  ('aaaaaaaa-2222-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'Bogdan', 'Szef', 'aaaaaaaa-1111-4000-8000-000000000005', null),
  ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Olga', 'Oceniająca', 'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-2222-4000-8000-000000000005'),
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna', null, 'aaaaaaaa-2222-4000-8000-000000000002'),
  ('aaaaaaaa-2222-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Piotr', 'Równoległy', 'aaaaaaaa-1111-4000-8000-000000000003', null);
-- Chains of 40 and 60: employee n reports to n + 1, the top one has an account.
insert into public.employees (id, office_id, first_name, last_name, user_id, supervisor_employee_id)
select ('cccccccc-2222-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-000000000001', 'Ogniwo', 'C' || n,
       case when n = 40 then 'aaaaaaaa-1111-4000-8000-000000000040'::uuid end,
       case when n < 40 then ('cccccccc-2222-4000-8000-' || lpad((n + 1)::text, 12, '0'))::uuid end
  from generate_series(1, 40) as n;
insert into public.employees (id, office_id, first_name, last_name, user_id, supervisor_employee_id)
select ('dddddddd-2222-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-000000000001', 'Ogniwo', 'D' || n,
       case when n = 60 then 'aaaaaaaa-1111-4000-8000-000000000060'::uuid end,
       case when n < 60 then ('dddddddd-2222-4000-8000-' || lpad((n + 1)::text, 12, '0'))::uuid end
  from generate_series(1, 60) as n;
insert into public.employees (id, office_id, first_name, last_name) values
  ('bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Jan', 'Obcy');

-- Own code: the seed already holds regulation-2016 and codes are unique.
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'test-evaluations', null, true, '2016-04-23',
   '{"id":"test-evaluations","effectiveFrom":"2016-04-23"}'),
  ('aaaaaaaa-3333-4000-8000-000000000002', 'test-evaluations-a', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2016-04-23',
   '{"id":"test-evaluations-a","effectiveFrom":"2016-04-23"}'),
  ('bbbbbbbb-3333-4000-8000-000000000001', 'test-evaluations-b', 'bbbbbbbb-0000-4000-8000-000000000002', false, '2016-04-23',
   '{"id":"test-evaluations-b","effectiveFrom":"2016-04-23"}');

-- E1 worker (criteria, draft sheet), E3 locked sheet, E4 period with a draft sheet, E40 and E60 bottoms of the chains.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by)
select v.id::uuid, 'aaaaaaaa-0000-4000-8000-000000000001', v.employee_id::uuid, 'aaaaaaaa-1111-4000-8000-000000000002',
       'aaaaaaaa-3333-4000-8000-000000000001', 'A', v.status::public.evaluation_status, '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001'
  from (values
    ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'criteria'),
    ('eeeeeeee-0000-4000-8000-000000000003', 'aaaaaaaa-2222-4000-8000-000000000001', 'drafted'),
    ('eeeeeeee-0000-4000-8000-000000000004', 'aaaaaaaa-2222-4000-8000-000000000001', 'period'),
    ('eeeeeeee-0000-4000-8000-000000000040', 'cccccccc-2222-4000-8000-000000000001', 'criteria'),
    ('eeeeeeee-0000-4000-8000-000000000060', 'dddddddd-2222-4000-8000-000000000001', 'criteria')
  ) as v(id, employee_id, status);
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot, created_by) values
  ('eeeeeeee-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-2222-4000-8000-000000000001',
   'bbbbbbbb-1111-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', '2026-01-01', '{}', 'bbbbbbbb-1111-4000-8000-000000000001');
insert into public.evaluation_sheets (id, office_id, evaluation_id, version, content, state, created_by) values
  ('ffffffff-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001', 1,
   '{"partOne":{"criteria":["a"]},"partTwo":{"score":null}}', 'draft', 'aaaaaaaa-1111-4000-8000-000000000002'),
  ('ffffffff-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000003', 1,
   '{"partOne":{"criteria":["a"]},"partTwo":{"score":4}}', 'locked', 'aaaaaaaa-1111-4000-8000-000000000002'),
  ('ffffffff-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000004', 1,
   '{"partOne":{"criteria":["a"]},"partTwo":{"score":null}}', 'draft', 'aaaaaaaa-1111-4000-8000-000000000002');
insert into public.evaluation_events (id, office_id, evaluation_id, kind, occurred_on, recorded_by) values
  ('99999999-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000040',
   'created', '2026-01-01', 'aaaaaaaa-1111-4000-8000-000000000001');

-- Grants are the complete Data API surface: no delete anywhere, the event log only grows,
-- evaluations change only through apply_evaluation_transition.
select table_privs_are('public', 'evaluations', 'authenticated', array['SELECT', 'INSERT']);
select table_privs_are('public', 'evaluation_sheets', 'authenticated', array['SELECT', 'INSERT', 'UPDATE']);
select table_privs_are('public', 'evaluation_events', 'authenticated', array['SELECT', 'INSERT']);
select table_privs_are('public', 'evaluation_deadlines', 'authenticated', array['SELECT', 'INSERT', 'UPDATE']);
select table_privs_are('public', 'evaluations', 'anon', array[]::text[]);
select function_privs_are('public', 'apply_evaluation_transition',
  array['uuid', 'evaluation_status', 'evaluation_status', 'evaluation_event_kind', 'date', 'jsonb', 'boolean'],
  'anon', array[]::text[]);

-- Events are append-only for everyone, the database owner included.
select throws_ok(
  $$update public.evaluation_events set payload = '{"x":1}' where id = '99999999-0000-4000-8000-000000000001'$$,
  'P0001', 'evaluation events are append-only', 'events are append-only: update is refused'
);
select throws_ok(
  $$delete from public.evaluation_events where id = '99999999-0000-4000-8000-000000000001'$$,
  'P0001', 'evaluation events are append-only', 'events are append-only: delete is refused'
);

-- Evaluation triggers hold on the owner path too (security definer functions, service role).
select throws_ok(
  $$update public.evaluations set snapshot = '{"forged":true}' where id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  'P0001', 'evaluation identity is immutable', 'identity columns are immutable: snapshot'
);
select throws_ok(
  $$update public.evaluations set employee_id = 'aaaaaaaa-2222-4000-8000-000000000003' where id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  'P0001', 'evaluation identity is immutable', 'identity columns are immutable: employee'
);
select lives_ok(
  $$update public.evaluations set evaluator_account_id = 'aaaaaaaa-1111-4000-8000-000000000003' where id = 'eeeeeeee-0000-4000-8000-000000000003'$$,
  'the evaluator can still be changed on the owner path'
);
select throws_ok(
  $$update public.evaluations set status = 'criteria' where id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  'P0001', 'evaluation cannot return to criteria', 'an evaluation never reopens the criteria stage'
);

-- Evaluator one.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';

insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot, created_by) values
  ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
   'aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', '2026-01-01', '{}', 'aaaaaaaa-1111-4000-8000-000000000001');
select results_eq(
  $$select evaluator_account_id from public.evaluations where id = 'eeeeeeee-0000-4000-8000-000000000002'$$,
  $$values (auth.uid())$$,
  'evaluator creates evaluation and becomes its evaluator'
);
select results_eq(
  $$select created_by from public.evaluations where id = 'eeeeeeee-0000-4000-8000-000000000002'$$,
  $$values (auth.uid())$$,
  'the author of an evaluation is the signed-in account, whatever the client sends'
);
select throws_ok(
  $$update public.evaluations set status = 'closed' where id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  '42501', null, 'evaluator cannot update evaluation columns directly'
);
select throws_ok(
  $$insert into public.evaluations (office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002',
            'bbbbbbbb-3333-4000-8000-000000000001', 'A', '2026-01-01', '{}')$$,
  'P0001', 'regulation version must be official or belong to the office',
  'regulation version from another office is rejected'
);
select lives_ok(
  $$insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot)
    values ('eeeeeeee-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
            'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000002', 'A', '2026-01-01', '{}')$$,
  'a local regulation version of the own office is accepted'
);

select throws_ok(
  $$update public.evaluation_sheets set content = '{"partOne":{"criteria":["b"]},"partTwo":{"score":null}}'
     where id = 'ffffffff-0000-4000-8000-000000000004'$$,
  'P0001', 'part one is locked', 'part one is frozen after criteria stage'
);
select lives_ok(
  $$update public.evaluation_sheets set content = '{"partOne":{"criteria":["a"]},"partTwo":{"score":3}}'
     where id = 'ffffffff-0000-4000-8000-000000000004'$$,
  'part two stays editable after criteria stage'
);
select throws_ok(
  $$insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000004', 2,
            '{"partOne":{"criteria":["b"]},"partTwo":{"score":null}}', 'draft')$$,
  'P0001', 'part one is locked', 'a new sheet version cannot change a frozen part one'
);

select throws_ok(
  $$select public.apply_evaluation_transition('eeeeeeee-0000-4000-8000-000000000001', 'period', 'interview',
      'evaluation_interview_held', '2026-02-01', '{}', false)$$,
  'P0001', 'stale_status', 'transition with stale expected status raises'
);
select is_empty(
  $$select 1 from public.evaluation_events where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  'a stale transition writes no event'
);

select lives_ok(
  $$select public.apply_evaluation_transition('eeeeeeee-0000-4000-8000-000000000001', 'criteria', 'criteria_awaiting_signature',
      'part_one_approved', '2026-01-15', '{"note":"first"}', true)$$,
  'transition by the evaluator succeeds'
);
select results_eq(
  $$select e.status::text, (select count(*) from public.evaluation_events v where v.evaluation_id = e.id),
           (select s.state from public.evaluation_sheets s where s.evaluation_id = e.id and s.version = 1)
      from public.evaluations e where e.id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  $$values ('criteria_awaiting_signature', 1::bigint, 'locked')$$,
  'transition writes event and locks sheet'
);
select throws_ok(
  $$select public.apply_evaluation_transition('eeeeeeee-0000-4000-8000-000000000001', 'criteria', 'criteria_awaiting_signature',
      'part_one_approved', '2026-01-15', '{}', true)$$,
  'P0001', 'stale_status', 'a second concurrent approval gets stale_status'
);
select results_eq(
  $$select recorded_by, payload ->> 'note', (payload ->> 'sheetVersion')::int, payload ->> 'sheetSha256'
      from public.evaluation_events where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  $$select auth.uid(), 'first', 1, encode(extensions.digest(content::text, 'sha256'), 'hex')
      from public.evaluation_sheets where id = 'ffffffff-0000-4000-8000-000000000001'$$,
  'transition payload carries sheet version and sha256 of the locked content'
);
select matches(
  (select payload ->> 'sheetSha256' from public.evaluation_events where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001'),
  '^[0-9a-f]{64}$',
  'the sheet hash is 64 hex characters'
);

-- A new version with a different part two, locked by the next transition, gets its own hash.
insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000001', 2,
   '{"partOne":{"criteria":["a"]},"partTwo":{"score":5}}', 'draft');
select public.apply_evaluation_transition('eeeeeeee-0000-4000-8000-000000000001', 'criteria_awaiting_signature', 'period',
  'part_one_signed', '2026-01-20', '{}', true);
select results_eq(
  $$select (payload ->> 'sheetVersion')::int from public.evaluation_events
     where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001' order by recorded_at, (payload ->> 'sheetVersion')::int$$,
  $$values (1), (2)$$,
  'each transition records the current sheet version'
);
select is(
  (select count(distinct payload ->> 'sheetSha256') from public.evaluation_events
    where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001'),
  2::bigint,
  'a content change gives a different hash'
);

-- Author stamps cannot be forged by the client.
insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, recorded_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000004', 'absence', '2026-03-01',
   'aaaaaaaa-1111-4000-8000-000000000001');
select results_eq(
  $$select recorded_by from public.evaluation_events where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  $$values (auth.uid())$$,
  'an event is recorded by the signed-in account, whatever the client sends'
);

-- Evaluator two: not the evaluator of E1.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000003","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';

select throws_ok(
  $$insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000004', 'absence', '2026-03-02')$$,
  '42501', null, 'other evaluator cannot record events on the evaluation'
);
select throws_ok(
  $$insert into public.evaluation_deadlines (evaluation_id, office_id, slot, due_on)
    values ('eeeeeeee-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluationDeadline', '2026-12-31')$$,
  '42501', null, 'other evaluator cannot write deadlines of the evaluation'
);
select throws_ok(
  $$select public.apply_evaluation_transition('eeeeeeee-0000-4000-8000-000000000004', 'period', 'interview',
      'evaluation_interview_held', '2026-02-01', '{}', false)$$,
  '42501', 'insufficient_privilege', 'transition rpc rejects other evaluator'
);
select results_eq(
  $$select status::text from public.evaluations where id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  $$values ('period')$$,
  'a rejected transition leaves the status as it was'
);

-- Admin.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';

select throws_ok(
  $$insert into public.evaluations (office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002',
            'aaaaaaaa-3333-4000-8000-000000000001', 'A', '2026-01-01', '{}')$$,
  '42501', null, 'admin cannot create evaluation'
);
select results_eq(
  $$select id from public.evaluations where id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  $$values ('eeeeeeee-0000-4000-8000-000000000004'::uuid)$$,
  'every member reads evaluations'
);

-- HR.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';

select throws_ok(
  $$update public.evaluations set after_negative = true where id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  '42501', null, 'hr cannot update evaluation columns directly either'
);
select lives_ok(
  $$select public.apply_evaluation_transition('eeeeeeee-0000-4000-8000-000000000004', 'period', 'interview',
      'evaluation_interview_held', '2026-02-01', '{}', false)$$,
  'hr applies a transition to any evaluation of the office'
);
select results_eq(
  $$select e.status::text, v.recorded_by from public.evaluations e
      join public.evaluation_events v on v.evaluation_id = e.id and v.kind = 'evaluation_interview_held'
     where e.id = 'eeeeeeee-0000-4000-8000-000000000004'$$,
  $$values ('interview', auth.uid())$$,
  'hr updates any evaluation through the transition, recorded as hr'
);

select throws_ok(
  $$update public.evaluation_sheets set content = '{"partOne":{"criteria":["a"]},"partTwo":{"score":5}}'
     where id = 'ffffffff-0000-4000-8000-000000000003'$$,
  'P0001', 'evaluation sheet version is locked', 'locked sheet is immutable'
);
select lives_ok(
  $$update public.evaluation_sheets set state = 'superseded' where id = 'ffffffff-0000-4000-8000-000000000003'$$,
  'a locked sheet can be superseded'
);
select throws_ok(
  $$update public.evaluation_sheets set state = 'draft' where id = 'ffffffff-0000-4000-8000-000000000003'$$,
  'P0001', 'evaluation sheet version is locked', 'a superseded sheet stays as it is'
);

do $$
declare
  line text;
  plan text := '';
begin
  set local enable_seqscan = off;
  for line in execute 'explain select * from public.evaluations' loop
    plan := plan || line || E'\n';
  end loop;
  perform set_config('test.evaluations_plan', plan, true);
end $$;
select ok(
  current_setting('test.evaluations_plan') like '%Index Cond: (office_id%',
  'office filter stays an index condition'
);

-- Office B.
set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-4000-8000-000000000001","role":"authenticated","office_id":"bbbbbbbb-0000-4000-8000-000000000002","office_role":"hr"}';

select is_empty(
  $$select 1 from public.evaluations where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    union all select 1 from public.evaluation_sheets where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    union all select 1 from public.evaluation_events where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'other office sees nothing'
);
select throws_ok(
  $$insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000001', 'absence', '2026-03-02')$$,
  '23503', null, 'a row cannot point at an evaluation of another office'
);
select throws_ok(
  $$insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000004', 9,
            '{"partOne":{"criteria":["guess"]}}', 'draft')$$,
  '23503', null, 'the part one trigger reveals nothing about another office'
);
select throws_ok(
  $$select public.apply_evaluation_transition('eeeeeeee-0000-4000-8000-000000000004', 'period', 'interview',
      'evaluation_interview_held', '2026-02-01', '{}', false)$$,
  '42501', 'insufficient_privilege', 'hr of another office cannot apply a transition'
);

-- Tree visibility.
reset role;
update public.offices set evaluation_visibility = 'tree' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000003","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select 1 from public.evaluations where id = 'eeeeeeee-0000-4000-8000-000000000001'
    union all select 1 from public.evaluation_sheets where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001'
    union all select 1 from public.evaluation_events where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  'tree visibility hides peer evaluations'
);
select lives_ok(
  $$insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot)
    values ('eeeeeeee-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
            'aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', '2026-01-01', '{}')
    returning id$$,
  'tree visibility lets the evaluator get the created evaluation back'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000005","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select id from public.evaluations where id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  $$values ('eeeeeeee-0000-4000-8000-000000000001'::uuid)$$,
  'tree visibility shows subordinate evaluations up the chain'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select count(*) from public.evaluation_events where evaluation_id = 'eeeeeeee-0000-4000-8000-000000000001'$$,
  $$values (2::bigint)$$,
  'tree visibility shows the evaluator the events of their evaluation'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';
select is(
  (select count(*) from public.evaluations),
  8::bigint,
  'tree visibility keeps admin reading all'
);
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';
select is(
  (select count(*) from public.evaluations),
  8::bigint,
  'tree visibility keeps hr reading all'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000040","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select id from public.evaluations$$,
  $$values ('eeeeeeee-0000-4000-8000-000000000040'::uuid)$$,
  'supervises_employee handles deep chain: the top of 40 sees the bottom evaluation'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000060","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select lives_ok(
  $$select count(*) from public.evaluations$$,
  'supervises_employee handles deep chain: a chain of 60 does not break the query'
);
select is_empty(
  $$select 1 from public.evaluations$$,
  'supervises_employee stops at depth 50'
);

reset role;
select * from finish();
rollback;
