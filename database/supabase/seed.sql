-- Demo data (fictional). Password for all accounts: Haslo-Demo-2026
insert into public.offices (id, name) values
  ('11111111-1111-4111-8111-111111111111', 'Urząd Ministerstwa Testowego w Kropce Wielkopolskiej');

do $$
declare
  account record;
begin
  for account in
    select * from (values
      ('22222222-2222-4222-8222-000000000001'::uuid, 'admin@kropka.test', 'admin'::public.office_role, 'Anna', 'Administracyjna'),
      ('22222222-2222-4222-8222-000000000002'::uuid, 'kadry@kropka.test', 'hr'::public.office_role, 'Karol', 'Kadrowy'),
      ('22222222-2222-4222-8222-000000000003'::uuid, 'oceniajacy@kropka.test', 'evaluator'::public.office_role, 'Olga', 'Oceniająca')
    ) as t(id, email, role, first_name, last_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', account.id, 'authenticated', 'authenticated', account.email,
      extensions.crypt('Haslo-Demo-2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), account.id, account.id::text,
      jsonb_build_object('sub', account.id::text, 'email', account.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    insert into public.memberships (user_id, office_id, role)
    values (account.id, '11111111-1111-4111-8111-111111111111', account.role);

    insert into public.employees (office_id, first_name, last_name, email, user_id)
    values ('11111111-1111-4111-8111-111111111111', account.first_name, account.last_name, account.email, account.id);
  end loop;
end $$;

-- Employees without accounts: evaluated employees do not use the app.
insert into public.employees (office_id, first_name, last_name, email) values
  ('11111111-1111-4111-8111-111111111111', 'Ewa', 'Ewidencyjna', 'ewa.ewidencyjna@kropka.test'),
  ('11111111-1111-4111-8111-111111111111', 'Marek', 'Merytoryczny', 'marek.merytoryczny@kropka.test');
