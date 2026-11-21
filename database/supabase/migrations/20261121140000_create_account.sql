-- One place that creates a login account (ADR 0004, SQL lives in the database): the demo seed and
-- the installer's first admin both call it, so the auth.users and auth.identities columns Supabase
-- Auth expects are written the same way everywhere.
--
-- Creates the auth user with a bcrypt password and its e-mail identity. With an office it also
-- adds the membership and the employee record of the account: an existing employee of the office
-- with the same e-mail and no account gets linked instead of duplicated.
create function access.create_account(
  email text,
  password text,
  office_id uuid default null,
  role public.office_role default null,
  first_name text default null,
  last_name text default null,
  account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  new_user uuid := coalesce(account_id, gen_random_uuid());
  normalized text := lower(trim(email));
begin
  if (office_id is null) <> (role is null) then
    raise exception 'office_id and role go together';
  end if;
  if office_id is not null and (first_name is null or last_name is null) then
    raise exception 'an office account needs the first and last name of its employee';
  end if;
  if length(password) < 12 then
    raise exception 'password must have at least 12 characters';
  end if;

  -- Empty strings, not nulls, in the token columns: Supabase Auth scans them into Go strings.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', new_user, 'authenticated', 'authenticated', normalized,
    extensions.crypt(create_account.password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), new_user, new_user::text,
    jsonb_build_object('sub', new_user::text, 'email', normalized, 'email_verified', true),
    'email', now(), now(), now()
  );

  if office_id is not null then
    insert into public.memberships (user_id, office_id, role)
    values (new_user, create_account.office_id, create_account.role);

    insert into public.employees as e (office_id, first_name, last_name, email, user_id)
    values (create_account.office_id, create_account.first_name, create_account.last_name, normalized, new_user)
    on conflict (office_id, lower(email)) do update
      set user_id = excluded.user_id
      where e.user_id is null;
    if not found then
      raise exception 'employee % already has an account', normalized;
    end if;
  end if;

  return new_user;
end;
$$;

comment on function access.create_account(text, text, uuid, public.office_role, text, text, uuid) is
  'Creates a login account, optionally with its office membership and employee record. Server side only.';

-- Only trusted server-side callers: migrations and seeds (postgres) and the worker (service_role).
revoke execute on function access.create_account(text, text, uuid, public.office_role, text, text, uuid) from public, anon, authenticated;
grant execute on function access.create_account(text, text, uuid, public.office_role, text, text, uuid) to service_role;
