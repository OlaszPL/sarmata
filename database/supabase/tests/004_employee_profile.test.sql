begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into public.employees (id, office_id, first_name, last_name, position_title, org_unit) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ewa', 'Ewidencyjna', 'Referent', 'Wydział A'),
  ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Marek', 'Merytoryczny', null, null),
  ('bbbbbbbb-2222-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'Ewa', 'Ewidencyjna', null, null);

select throws_ok(
  $$update public.employees set grade = 4 where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  '23514', null, 'grade is refused for a non civil servant'
);

update public.employees set service_status = 'civil_servant', appointment_year = 2020
 where id = 'aaaaaaaa-2222-4000-8000-000000000001';
select throws_ok(
  $$update public.employees set grade = 10 where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  '23514', null, 'grade above 9 is refused'
);

-- A (Ewa) supervises B (Marek), then B cannot supervise A.
update public.employees set supervisor_employee_id = 'aaaaaaaa-2222-4000-8000-000000000001'
 where id = 'aaaaaaaa-2222-4000-8000-000000000002';
select throws_ok(
  $$update public.employees set supervisor_employee_id = 'aaaaaaaa-2222-4000-8000-000000000002' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  'P0001', 'supervisor cycle', 'supervisor cycle is refused'
);
-- Longer chain: C -> Marek -> Ewa, so Ewa -> C closes a cycle of three.
insert into public.employees (id, office_id, first_name, last_name, supervisor_employee_id) values
  ('aaaaaaaa-2222-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'Cezary', 'Cykliczny', 'aaaaaaaa-2222-4000-8000-000000000002');
select throws_ok(
  $$update public.employees set supervisor_employee_id = 'aaaaaaaa-2222-4000-8000-000000000004' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  'P0001', 'supervisor cycle', 'multi step supervisor cycle is refused'
);
select throws_ok(
  $$update public.employees set supervisor_employee_id = 'bbbbbbbb-2222-4000-8000-000000000003' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  '23503', null, 'supervisor from another office is refused'
);
select throws_ok(
  $$update public.employees set supervisor_employee_id = id where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  'P0001', 'supervisor cycle', 'employee cannot supervise themselves'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001"}';

select results_eq(
  $$select id from public.find_similar_employees('Ewa Ewidencyjn') limit 1$$,
  $$values ('aaaaaaaa-2222-4000-8000-000000000001'::uuid)$$,
  'similar search finds Ewa first'
);
select is(
  (select count(*) from public.find_similar_employees('Ewa Ewidencyjn')),
  1::bigint, 'similar search does not leak other offices'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-1111-4000-8000-000000000002","role":"authenticated","office_id":"cccccccc-0000-4000-8000-000000000009"}';
select is_empty(
  $$select 1 from public.find_similar_employees('Ewa Ewidencyjn')$$,
  'search from an office without matching employees is empty'
);

select * from finish();
rollback;
