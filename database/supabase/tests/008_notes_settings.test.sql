begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

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
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna', null, 'aaaaaaaa-2222-4000-8000-000000000002'),
  ('bbbbbbbb-2222-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Jan', 'Obcy', null, null);
insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'test-notes', null, true, '2016-04-23',
   '{"id":"test-notes","effectiveFrom":"2016-04-23"}');
-- Open evaluation of Ewa, evaluator one.
insert into public.evaluations (id, office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, status, cycle_start, snapshot, created_by) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001',
   'aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-3333-4000-8000-000000000001', 'A', 'period', '2026-01-01', '{}',
   'aaaaaaaa-1111-4000-8000-000000000001');

-- Settings exist for every office, with defaults.
select results_eq(
  $$select ai_enabled, reminder_lead_days, notes_retention_months
      from public.office_settings where office_id = 'bbbbbbbb-0000-4000-8000-000000000002'$$,
  $$values (true, '{14,3}'::smallint[], 36::smallint)$$,
  'new office gets default settings'
);

-- Evaluator one writes a note.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';

select lives_ok(
  $$insert into public.notes (id, employee_id, kind, occurred_on, criterion_id, sign, body, author_account_id) values
    ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'observation', '2026-03-01',
     'communication', 'plus', 'Jasno przekazała ustalenia.', 'aaaaaaaa-1111-4000-8000-000000000003')$$,
  'evaluator inserts a note'
);
select results_eq(
  $$select author_account_id, office_id from public.notes where id = '11111111-0000-4000-8000-000000000001'$$,
  $$values (auth.uid(), 'aaaaaaaa-0000-4000-8000-000000000001'::uuid)$$,
  'evaluator creates note and is its author'
);

select lives_ok(
  $$update public.notes set body = 'Jasno przekazała ustalenia zespołowi.' where id = '11111111-0000-4000-8000-000000000001'$$,
  'author edits note'
);
select results_eq(
  $$select n.version, (select count(*) from public.note_versions v where v.note_id = n.id),
           (select v.body from public.note_versions v where v.note_id = n.id and v.version = 1)
      from public.notes n where n.id = '11111111-0000-4000-8000-000000000001'$$,
  $$values (2, 1::bigint, 'Jasno przekazała ustalenia.')$$,
  'author edits note and previous version is kept'
);
select throws_ok(
  $$update public.notes set created_at = now() - interval '1 day' where id = '11111111-0000-4000-8000-000000000001'$$,
  '42501', null, 'created_at cannot be changed'
);
select throws_ok(
  $$insert into public.note_versions (note_id, office_id, version, kind, occurred_on, communicated, body, valid_from, valid_to)
    values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 9, 'observation', '2026-03-01',
            false, 'x', now(), now())$$,
  '42501', null, 'note versions are not writable by clients'
);

do $$
declare
  line text;
  plan text := '';
begin
  set local enable_seqscan = off;
  for line in execute 'explain select * from public.notes' loop
    plan := plan || line || E'\n';
  end loop;
  perform set_config('test.notes_plan', plan, true);
end $$;
select ok(
  current_setting('test.notes_plan') like '%Index Cond: (office_id%',
  'office filter stays an index condition'
);

select throws_ok(
  $$select smtp_password_secret_id from public.office_settings$$,
  '42501', null, 'member cannot read smtp secret'
);
select throws_ok(
  $$select * from vault.decrypted_secrets$$,
  '42501', null, 'member cannot read vault secrets directly'
);

-- Admin cannot write notes.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$insert into public.notes (employee_id, kind, occurred_on, body)
    values ('aaaaaaaa-2222-4000-8000-000000000001', 'observation', '2026-03-02', 'Admin')$$,
  '42501', null, 'admin cannot create note'
);
select is_empty(
  $$select 1 from public.notes$$,
  'admin does not read notes'
);

-- Hr: reads, writes, but does not edit the evaluator's note.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';
select results_eq(
  $$select count(*) from public.notes where id = '11111111-0000-4000-8000-000000000001'$$,
  $$values (1::bigint)$$,
  'hr reads note'
);
select results_eq(
  $$with u as (update public.notes set body = 'Zmienione przez kadry' where id = '11111111-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (0::bigint)$$,
  'hr cannot edit note of evaluator: no row changed'
);
select results_eq(
  $$select body from public.notes where id = '11111111-0000-4000-8000-000000000001'$$,
  $$values ('Jasno przekazała ustalenia zespołowi.')$$,
  'hr cannot edit note of evaluator: body unchanged'
);
insert into public.notes (id, employee_id, kind, occurred_on, body) values
  ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-2222-4000-8000-000000000001', 'workload_fact', '2026-03-03', 'Dodatkowe zadania.');

-- Evaluator one reads the hr note (current evaluator of an open evaluation).
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select count(*) from public.notes where id = '11111111-0000-4000-8000-000000000002'$$,
  $$values (1::bigint)$$,
  'current evaluator reads note written by hr'
);

-- Evaluator two is not the evaluator.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000003","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select 1 from public.notes$$,
  'other evaluator does not read note'
);

-- The evaluator changes to evaluator two.
reset role;
update public.evaluations set evaluator_account_id = 'aaaaaaaa-1111-4000-8000-000000000003'
 where id = 'eeeeeeee-0000-4000-8000-000000000001';
set local role authenticated;
select results_eq(
  $$select count(*) from public.notes$$,
  $$values (2::bigint)$$,
  'evaluator change moves notes to new evaluator: new one reads all'
);
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select id from public.notes$$,
  $$values ('11111111-0000-4000-8000-000000000001'::uuid)$$,
  'evaluator change moves notes to new evaluator: previous one keeps only his own'
);

-- Closed evaluation: evaluator two loses access to what others wrote.
reset role;
update public.evaluations set status = 'closed' where id = 'eeeeeeee-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000003","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select 1 from public.notes$$,
  'closed evaluation gives no access'
);

-- Supervisor: nothing in office mode, reads in tree mode.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000005","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"evaluator"}';
select is_empty(
  $$select 1 from public.notes$$,
  'supervisor reads only in tree mode: nothing in office mode'
);
reset role;
update public.offices set evaluation_visibility = 'tree' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select results_eq(
  $$select count(*) from public.notes$$,
  $$values (2::bigint)$$,
  'supervisor reads only in tree mode: reads in tree mode'
);

-- Office B sees nothing of office A.
set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-4000-8000-000000000001","role":"authenticated","office_id":"bbbbbbbb-0000-4000-8000-000000000002","office_role":"hr"}';
select is_empty(
  $$select 1 from public.notes union all select 1 from public.note_versions
    union all select 1 from public.office_settings where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'other office reads nothing'
);

-- Settings: hr cannot update, admin can.
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';
select results_eq(
  $$with u as (update public.office_settings set ai_enabled = false where office_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (0::bigint)$$,
  'hr cannot update settings'
);
select results_eq(
  $$with u as (update public.offices set evaluation_visibility = 'office' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (0::bigint)$$,
  'only admin changes evaluation visibility: hr changes nothing'
);
select throws_ok(
  $$select public.set_smtp_password('secret')$$,
  '42501', null, 'hr cannot set smtp password'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';
select results_eq(
  $$with u as (update public.office_settings set ai_enabled = false, reminder_lead_days = '{7}', smtp_host = 'smtp.a.test'
                where office_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (1::bigint)$$,
  'admin updates settings'
);
select throws_ok(
  $$update public.office_settings set reminder_lead_days = '{91}' where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514', null, 'lead days outside range rejected'
);
select results_eq(
  $$with u as (update public.offices set evaluation_visibility = 'office' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (1::bigint)$$,
  'only admin changes evaluation visibility: admin does'
);

-- SMTP password goes to the vault, the second call keeps the secret.
select lives_ok($$select public.set_smtp_password('first-secret')$$, 'admin sets smtp password');
select results_eq(
  $$select smtp_password_set from public.office_settings where office_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  $$values (true)$$,
  'admin sees only that the password is set'
);
reset role;
create temp table first_secret as
  select smtp_password_secret_id as id from public.office_settings where office_id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.set_smtp_password('second-secret')$$, 'admin changes smtp password');
reset role;
select ok(
  (select s.decrypted_secret::text = 'second-secret' and s.id = (select id from first_secret)
     from vault.decrypted_secrets s
     join public.office_settings o on o.smtp_password_secret_id = s.id
    where o.office_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'admin sets smtp password into vault and keeps the secret id'
);

-- B2 branches survive the redefinition of access.can.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000004","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';
select throws_ok(
  $$insert into public.archived_evaluations (employee_id, drafted_on)
    values ('aaaaaaaa-2222-4000-8000-000000000001', '2020-01-01')$$,
  '42501', null, 'earlier access branches still hold'
);

reset role;
select * from finish();
rollback;
