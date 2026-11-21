/** First office and its admin, created by the installer (docs/funkcjonalnosci.md, konta i logowanie). */
export interface BootstrapAccount {
  readonly officeName: string;
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

export const sqlLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** Idempotent: does nothing when an admin membership exists. */
export function renderBootstrapSql(account: BootstrapAccount): string {
  const values: string[] = [
    account.officeName,
    account.email,
    account.password,
    account.firstName,
    account.lastName,
  ];
  let tag = '$bootstrap$';
  // The body is dollar-quoted, so no value may contain the tag.
  while (values.some((value) => value.includes(tag))) tag = `$${tag.slice(1, -1)}_x$`;
  const email = `lower(${sqlLiteral(account.email)})`;
  return `-- First office and admin account, created once by the installer.
do ${tag}
declare
  new_office uuid;
  new_user uuid := gen_random_uuid();
begin
  if exists (select 1 from public.memberships where role = 'admin') then
    raise notice 'office already initialised, skipping';
    return;
  end if;

  insert into public.offices (name) values (${sqlLiteral(account.officeName)}) returning id into new_office;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', new_user, 'authenticated', 'authenticated', ${email},
    extensions.crypt(${sqlLiteral(account.password)}, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), new_user, new_user::text,
    jsonb_build_object('sub', new_user::text, 'email', ${email}, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.memberships (user_id, office_id, role) values (new_user, new_office, 'admin');

  insert into public.employees (office_id, first_name, last_name, email, user_id)
  values (new_office, ${sqlLiteral(account.firstName)}, ${sqlLiteral(account.lastName)}, ${email}, new_user);
end
${tag};
`;
}
