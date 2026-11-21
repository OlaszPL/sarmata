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
  appointment_year, grade, supervisor_employee_id
) values
  ('11111111-1111-4111-8111-111111111111', 'Ewa', 'Ewidencyjna', 'ewa.ewidencyjna@kropka.test',
   'other', 'civil_servant', 'appointment', 2018, 4,
   (select id from public.employees where email = 'oceniajacy@kropka.test')),
  ('11111111-1111-4111-8111-111111111111', 'Marek', 'Merytoryczny', 'marek.merytoryczny@kropka.test',
   'other', 'employee', 'indefinite', null, null,
   (select id from public.employees where email = 'oceniajacy@kropka.test'));
