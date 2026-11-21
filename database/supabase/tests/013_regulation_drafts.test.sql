begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A');
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000002', 'ev@a.test'),
  ('aaaaaaaa-1111-4000-8000-000000000009', 'admin@a.test');
insert into public.memberships (user_id, office_id, role) values
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'evaluator'),
  ('aaaaaaaa-1111-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001', 'admin');
insert into public.employees (id, office_id, first_name, last_name) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna');

select is(
  (select status from public.regulation_versions where code = 'regulation-2016'),
  'published',
  'the synced official version is published'
);

-- Official insert as the database owner gets status published whatever the default says.
insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
  values ('test-official-x', null, true, '2016-04-23', '{"id":"test-official-x","effectiveFrom":"2016-04-23"}');
select is(
  (select status from public.regulation_versions where code = 'test-official-x'),
  'published',
  'an official version gets status published'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000002","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';

select throws_ok(
  $$insert into public.regulation_versions (code, is_official, effective_from, document)
    values ('test-by-hr', false, '2099-01-01', '{"id":"test-by-hr","effectiveFrom":"2099-01-01"}')$$,
  '42501',
  null,
  'hr cannot create a draft'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000009","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';

select lives_ok(
  $$insert into public.regulation_versions (code, is_official, effective_from, document)
    values ('test-draft-a', false, '2099-01-01', '{"id":"test-draft-a","effectiveFrom":"2099-01-01"}')$$,
  'admin creates a draft clone'
);

select results_eq(
  $$select status, office_id::text, created_by::text, published_at is null
      from public.regulation_versions where code = 'test-draft-a'$$,
  $$values ('draft', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000009', true)$$,
  'the draft belongs to the office of the admin, stamped with the author, not published'
);

select throws_ok(
  $$insert into public.regulation_versions (code, is_official, effective_from, document, status)
    values ('test-pub', false, '2099-01-01', '{"id":"test-pub","effectiveFrom":"2099-01-01"}', 'published')$$,
  'P0001',
  'local regulation version test-pub must start as a draft',
  'local insert as published fails'
);

select throws_ok(
  $$insert into public.regulation_versions (code, is_official, effective_from, document)
    values ('regulation-2016', false, '2099-01-01', '{"id":"regulation-2016","effectiveFrom":"2099-01-01"}')$$,
  'P0001',
  'code regulation-2016 belongs to an official regulation version',
  'local code equal to an official code fails'
);

update public.regulation_versions
   set document = document || '{"name":"edited"}'
 where code = 'test-draft-a';
select is(
  (select document ->> 'name' from public.regulation_versions where code = 'test-draft-a'),
  'edited',
  'admin edits a draft'
);

select throws_ok(
  $$update public.regulation_versions
       set status = 'published', effective_from = '2020-01-01',
           document = document || '{"effectiveFrom":"2020-01-01"}'
     where code = 'test-draft-a'$$,
  'P0001',
  'effective date 2020-01-01 of regulation version test-draft-a is in the past',
  'publish with a past date fails'
);

update public.regulation_versions
   set status = 'published'
 where code = 'test-draft-a';
select results_eq(
  $$select status, published_at is not null from public.regulation_versions where code = 'test-draft-a'$$,
  $$values ('published', true)$$,
  'publish sets published_at'
);

select throws_ok(
  $$update public.regulation_versions set document = document || '{"name":"again"}' where code = 'test-draft-a'$$,
  'P0001',
  'published regulation version test-draft-a is immutable',
  'a published local version cannot be updated'
);

select throws_ok(
  $$delete from public.regulation_versions where code = 'test-draft-a'$$,
  'P0001',
  'published regulation version test-draft-a is immutable',
  'a published local version cannot be deleted'
);

insert into public.regulation_versions (code, is_official, effective_from, document)
  values ('test-draft-b', false, '2099-01-01', '{"id":"test-draft-b","effectiveFrom":"2099-01-01"}');

select throws_ok(
  $$update public.regulation_versions set status = 'published' where code = 'test-draft-b'$$,
  '23505',
  null,
  'second published version with the same date fails'
);

select lives_ok(
  $$delete from public.regulation_versions where code = 'test-draft-b'$$,
  'admin deletes a draft'
);

select is(
  (select count(*) from public.regulation_versions where code = 'test-draft-b'),
  0::bigint,
  'the deleted draft is gone'
);

reset role;

insert into public.regulation_versions (id, code, office_id, is_official, effective_from, document)
  values ('aaaaaaaa-3333-4000-8000-000000000003', 'test-draft-c', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2099-02-01',
          '{"id":"test-draft-c","effectiveFrom":"2099-02-01"}');

select throws_ok(
  $$insert into public.evaluations (office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002',
            'aaaaaaaa-3333-4000-8000-000000000003', 'A', '2026-01-01', '{}')$$,
  'P0001',
  'regulation version must be official or belong to the office',
  'evaluation on a draft version fails'
);

select lives_ok(
  $$insert into public.evaluations (office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start, snapshot)
    select 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000002',
           id, 'A', '2026-01-01', '{}'
      from public.regulation_versions where code = 'test-draft-a'$$,
  'evaluation on a published office version is accepted'
);

select * from finish();
rollback;
