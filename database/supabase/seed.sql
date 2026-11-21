-- Demo data (fictional). Password for all accounts: Haslo-Demo-2026
insert into public.offices (id, name) values
  ('11111111-1111-4111-8111-111111111111', 'Urząd Ministerstwa Testowego w Kropce Wielkopolskiej');

select access.create_account(
  email => 'admin@kropka.test', password => 'Haslo-Demo-2026',
  office_id => '11111111-1111-4111-8111-111111111111', role => 'admin',
  first_name => 'Anna', last_name => 'Administracyjna',
  account_id => '22222222-2222-4222-8222-000000000001'
);
select access.create_account(
  email => 'kadry@kropka.test', password => 'Haslo-Demo-2026',
  office_id => '11111111-1111-4111-8111-111111111111', role => 'hr',
  first_name => 'Karol', last_name => 'Kadrowy',
  account_id => '22222222-2222-4222-8222-000000000002'
);
select access.create_account(
  email => 'oceniajacy@kropka.test', password => 'Haslo-Demo-2026',
  office_id => '11111111-1111-4111-8111-111111111111', role => 'evaluator',
  first_name => 'Olga', last_name => 'Oceniająca',
  account_id => '22222222-2222-4222-8222-000000000003'
);

-- Account without membership and employee record: covers the "no office" path of the app.
select access.create_account(
  email => 'bezurzedu@kropka.test', password => 'Haslo-Demo-2026',
  account_id => '22222222-2222-4222-8222-000000000004'
);

-- Employees without accounts: evaluated employees do not use the app. Their supervisor is Olga Oceniająca.
insert into public.employees (
  office_id, first_name, last_name, email, position_kind, service_status, employment_basis,
  appointment_year, grade, grade_granted_on, supervisor_employee_id
) values
  ('11111111-1111-4111-8111-111111111111', 'Ewa', 'Ewidencyjna', 'ewa.ewidencyjna@kropka.test',
   'other', 'civil_servant', 'appointment', 2018, 4, null,
   (select id from public.employees where email = 'oceniajacy@kropka.test')),
  ('11111111-1111-4111-8111-111111111111', 'Marek', 'Merytoryczny', 'marek.merytoryczny@kropka.test',
   'other', 'employee', 'indefinite', null, null, null,
   (select id from public.employees where email = 'oceniajacy@kropka.test')),
  -- Grade III granted on 2021-03-01: two evaluations above expectations since then give the grade by law.
  ('11111111-1111-4111-8111-111111111111', 'Stefan', 'Sprzeciwny', 'stefan.sprzeciwny@kropka.test',
   'other', 'civil_servant', 'appointment', 2018, 3, '2021-03-01',
   (select id from public.employees where email = 'oceniajacy@kropka.test'));

-- Notes of Olga Oceniająca about Marek. The first one is edited once, so it has a kept earlier version.
insert into public.notes (id, office_id, employee_id, author_account_id, kind, occurred_on, criterion_id, sign, communicated, body) values
  ('33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-111111111111',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '22222222-2222-4222-8222-000000000003', 'observation', '2026-09-14', 'communication', 'plus', false,
   'Przekazał zespołowi ustalenia ze spotkania.'),
  ('33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-111111111111',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '22222222-2222-4222-8222-000000000003', 'ongoing_conversation', '2026-10-05', null, 'plus', true,
   'Rozmowa o planie na kwartał, uzgodnione priorytety.'),
  ('33333333-3333-4333-8333-000000000003', '11111111-1111-4111-8111-111111111111',
   (select id from public.employees where email = 'marek.merytoryczny@kropka.test'),
   '22222222-2222-4222-8222-000000000003', 'workload_fact', '2026-10-20', null, null, false,
   'Przejął obsługę dwóch dodatkowych spraw na czas urlopu współpracownika.');
update public.notes
   set body = 'Przekazał zespołowi ustalenia ze spotkania i zadbał o notatkę z działań.'
 where id = '33333333-3333-4333-8333-000000000001';

-- SMTP of the demo office: the Mailpit of the local Supabase (smtp_port in config.toml), no password needed.
update public.office_settings
   set smtp_host = '127.0.0.1', smtp_port = 55425, smtp_from = 'oceny@kropka.test'
 where office_id = '11111111-1111-4111-8111-111111111111';
