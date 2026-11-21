begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into public.regulation_versions (code, office_id, is_official, effective_from, document) values
  ('test-official', null, true, '2016-04-23', '{"id":"test-official","effectiveFrom":"2016-04-23"}'),
  ('test-local-a', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2016-04-23', '{"id":"test-local-a","effectiveFrom":"2016-04-23"}'),
  ('test-local-b', 'bbbbbbbb-0000-4000-8000-000000000002', false, '2016-04-23', '{"id":"test-local-b","effectiveFrom":"2016-04-23"}');

select throws_ok(
  $$update public.regulation_versions set document = document where code = 'test-official'$$,
  'P0001',
  'official regulation version test-official is immutable',
  'nobody updates an official version, not even the database owner'
);

select throws_ok(
  $$delete from public.regulation_versions where code = 'test-official'$$,
  'P0001',
  'official regulation version test-official is immutable',
  'nobody deletes an official version'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-mismatch', null, true, '2016-04-23', '{"id":"other","effectiveFrom":"2016-04-23"}')$$,
  '23514',
  null,
  'the document id must match the code'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-orphan', null, false, '2016-04-23', '{"id":"test-orphan","effectiveFrom":"2016-04-23"}')$$,
  '23514',
  null,
  'a local version belongs to an office'
);

select throws_ok(
  'truncate public.regulation_versions',
  'P0001',
  'official regulation versions are immutable, truncate refused',
  'nobody truncates the table while official versions exist, not even the database owner'
);

set local role service_role;
select throws_ok(
  'truncate public.regulation_versions',
  '42501',
  null,
  'service_role has no truncate privilege'
);
reset role;

set local role anon;
select throws_ok(
  $$select 1 from public.regulation_versions$$,
  '42501',
  null,
  'an anonymous client reads no versions'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';

select results_eq(
  $$select code from public.regulation_versions where code like 'test-%' order by code$$,
  $$values ('test-local-a'), ('test-official')$$,
  'an account sees official versions and the local versions of its office'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-by-hr', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2016-04-23', '{"id":"test-by-hr","effectiveFrom":"2016-04-23"}')$$,
  '42501',
  null,
  'hr cannot create a local version'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000009","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';

select lives_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-by-admin', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2016-04-23', '{"id":"test-by-admin","effectiveFrom":"2016-04-23"}')$$,
  'the office admin creates a local version'
);

update public.regulation_versions set document = document || '{"name":"changed"}' where code = 'test-local-a';
select is(
  (select document ->> 'name' from public.regulation_versions where code = 'test-local-a'),
  'changed',
  'the office admin edits a local version of the office'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-fake-official', null, true, '2016-04-23', '{"id":"test-fake-official","effectiveFrom":"2016-04-23"}')$$,
  '42501',
  null,
  'an admin cannot create an official version'
);

update public.regulation_versions set document = document || '{"name":"hijacked"}' where code = 'test-local-b';

select throws_ok(
  $$update public.regulation_versions set office_id = 'bbbbbbbb-0000-4000-8000-000000000002',
      code = 'test-moved', document = '{"id":"test-moved","effectiveFrom":"2016-04-23"}'
    where code = 'test-local-a'$$,
  '42501',
  null,
  'an admin cannot move a local version to another office'
);

delete from public.regulation_versions where code = 'test-local-b';

set local request.jwt.claims = '{"sub":"cccccccc-1111-4000-8000-000000000003","role":"authenticated"}';

select is_empty(
  $$select 1 from public.regulation_versions where code like 'test-%'$$,
  'without office_id in the JWT no version is visible'
);

reset role;

select is(
  (select document ->> 'name' from public.regulation_versions where code = 'test-local-b'),
  null,
  'an admin cannot edit a local version of another office'
);

select is(
  (select count(*) from public.regulation_versions where code = 'test-local-b'),
  1::bigint,
  'an admin cannot delete a local version of another office'
);

select * from finish();
rollback;
