begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.offices (id, name) values
  ('a1919191-0000-4000-8000-000000000001', 'Urząd A');
insert into auth.users (id, email) values
  ('a1919191-1111-4000-8000-000000000001', 'admin@a19.test'),
  ('a1919191-1111-4000-8000-000000000002', 'hr@a19.test'),
  ('a1919191-1111-4000-8000-000000000003', 'ev@a19.test');
insert into public.memberships (user_id, office_id, role) values
  ('a1919191-1111-4000-8000-000000000001', 'a1919191-0000-4000-8000-000000000001', 'admin'),
  ('a1919191-1111-4000-8000-000000000002', 'a1919191-0000-4000-8000-000000000001', 'hr'),
  ('a1919191-1111-4000-8000-000000000003', 'a1919191-0000-4000-8000-000000000001', 'evaluator');

select results_eq(
  $$select accessibility_office_address, accessibility_contact_name, accessibility_contact_email,
           accessibility_contact_phone, accessibility_architecture, accessibility_sign_language
      from public.office_settings where office_id = 'a1919191-0000-4000-8000-000000000001'$$,
  $$values (null::text, null::text, null::text, null::text, null::text, null::text)$$,
  'accessibility data is empty for a new office'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1919191-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1919191-0000-4000-8000-000000000001","office_role":"hr"}';
select results_eq(
  $$with u as (update public.office_settings set accessibility_contact_name = 'Kadry'
                where office_id = 'a1919191-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (0::bigint)$$,
  'hr cannot change the accessibility data'
);

set local request.jwt.claims = '{"sub":"a1919191-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1919191-0000-4000-8000-000000000001","office_role":"admin"}';
select results_eq(
  $$with u as (update public.office_settings
                  set accessibility_office_address = 'ul. Testowa 1, 00-001 Kropka',
                      accessibility_contact_name = 'Jan Dostępny',
                      accessibility_contact_email = 'dostepnosc@a19.test',
                      accessibility_contact_phone = '+48 22 000 00 00',
                      accessibility_architecture = 'https://a19.test/architektura',
                      accessibility_sign_language = 'Tłumacz PJM po wcześniejszym zgłoszeniu.'
                where office_id = 'a1919191-0000-4000-8000-000000000001' returning 1)
    select count(*) from u$$,
  $$values (1::bigint)$$,
  'admin changes the accessibility data'
);

set local request.jwt.claims = '{"sub":"a1919191-1111-4000-8000-000000000003","role":"authenticated","office_id":"a1919191-0000-4000-8000-000000000001","office_role":"evaluator"}';
select results_eq(
  $$select accessibility_contact_name, accessibility_contact_email from public.office_settings$$,
  $$values ('Jan Dostępny'::text, 'dostepnosc@a19.test'::text)$$,
  'an evaluator reads the accessibility data of the office'
);

set local request.jwt.claims = '{"sub":"a1919191-1111-4000-8000-000000000099","role":"authenticated"}';
select is_empty(
  $$select 1 from public.office_settings where office_id = 'a1919191-0000-4000-8000-000000000001'$$,
  'an account without the office reads nothing'
);

select * from finish();
rollback;
