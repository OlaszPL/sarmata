-- Account administration (docs/funkcjonalnosci.md, "Konta i logowanie"): the admin invites an account,
-- changes its role and ends its membership.
--
-- 1. access.add_membership: the membership and employee part of access.create_account, extracted so the
--    invitation flow (the login account is made by Supabase Auth, not by SQL) reuses it.
-- 2. public.admit_account: service role wrapper of it, called by the system service after the invitation.
-- 3. public.change_member_role and public.end_membership: admin only, run with the JWT of the admin.

-- 1. Creates the membership of an existing login account and links or creates its employee record. An ended
-- membership of the same office is reactivated (its employee record is still linked). Returns the employee id.
create function access.add_membership(
  account_id uuid,
  office_id uuid,
  role public.office_role,
  first_name text,
  last_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  account_email text;
  linked_id uuid;
  linked_ended date;
begin
  select u.email into account_email from auth.users u where u.id = add_membership.account_id;
  if account_email is null then
    raise exception 'account_missing' using errcode = 'P0001';
  end if;

  insert into public.memberships as m (user_id, office_id, role)
  values (add_membership.account_id, add_membership.office_id, add_membership.role)
  on conflict (user_id) do update
    set role = excluded.role, ended_on = null
    where m.office_id = excluded.office_id and m.ended_on is not null and m.ended_on <= current_date;
  if not found then
    raise exception 'membership_exists' using errcode = 'P0001';
  end if;

  select e.id, e.employment_ended_on into linked_id, linked_ended
    from public.employees e
   where e.user_id = add_membership.account_id and e.office_id = add_membership.office_id;
  if linked_id is not null then
    if linked_ended is not null then
      raise exception 'employment_ended' using errcode = 'P0001';
    end if;
    return linked_id;
  end if;

  if first_name is null or last_name is null then
    raise exception 'an office account needs the first and last name of its employee';
  end if;
  insert into public.employees as e (office_id, first_name, last_name, email, user_id)
  values (add_membership.office_id, add_membership.first_name, add_membership.last_name, account_email, add_membership.account_id)
  on conflict (office_id, lower(email)) do update
    set user_id = excluded.user_id
    where e.user_id is null
  returning e.id into linked_id;
  if linked_id is null then
    raise exception 'employee_has_account' using errcode = 'P0001';
  end if;
  return linked_id;
end;
$$;

revoke execute on function access.add_membership(uuid, uuid, public.office_role, text, text) from public, anon, authenticated;
grant execute on function access.add_membership(uuid, uuid, public.office_role, text, text) to service_role;

-- 2. Same name and arguments for PostgREST, which exposes only the public schema.
create function public.admit_account(
  p_account_id uuid,
  p_office_id uuid,
  p_role public.office_role,
  p_first_name text,
  p_last_name text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select access.add_membership(p_account_id, p_office_id, p_role, p_first_name, p_last_name)
$$;

revoke execute on function public.admit_account(uuid, uuid, public.office_role, text, text) from public, anon, authenticated;
grant execute on function public.admit_account(uuid, uuid, public.office_role, text, text) to service_role;

-- 3. Admin only, for accounts of the own office. The role reaches the token at its next refresh.
create function public.change_member_role(p_account_id uuid, p_role public.office_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_role public.office_role;
begin
  if access.current_office_role() is distinct from 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  select m.role into member_role
    from public.memberships m
   where m.user_id = p_account_id
     and m.office_id = access.current_office_id()
     and (m.ended_on is null or m.ended_on > current_date)
     for update;
  if not found then
    raise exception 'membership_missing' using errcode = 'P0001';
  end if;
  if member_role = 'admin' and p_role <> 'admin' and not exists (
    select 1 from public.memberships m
     where m.office_id = access.current_office_id() and m.role = 'admin'
       and m.user_id <> p_account_id and (m.ended_on is null or m.ended_on > current_date)
  ) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  update public.memberships set role = p_role where user_id = p_account_id;
end;
$$;

-- Ends the access from today (the row stays: evaluations led by the account still point at it). Returns how many
-- open evaluations the account leads, so that hr hands them over.
create function public.end_membership(p_account_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_role public.office_role;
begin
  if access.current_office_role() is distinct from 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  select m.role into member_role
    from public.memberships m
   where m.user_id = p_account_id
     and m.office_id = access.current_office_id()
     and (m.ended_on is null or m.ended_on > current_date)
     for update;
  if not found then
    raise exception 'membership_missing' using errcode = 'P0001';
  end if;
  if member_role = 'admin' and not exists (
    select 1 from public.memberships m
     where m.office_id = access.current_office_id() and m.role = 'admin'
       and m.user_id <> p_account_id and (m.ended_on is null or m.ended_on > current_date)
  ) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  update public.memberships set ended_on = current_date where user_id = p_account_id;
  return (
    select count(*)::integer from public.evaluations ev
     where ev.evaluator_account_id = p_account_id
       and ev.office_id = access.current_office_id()
       and ev.status not in ('closed', 'interrupted')
  );
end;
$$;

revoke execute on function public.change_member_role(uuid, public.office_role) from public, anon;
revoke execute on function public.end_membership(uuid) from public, anon;
grant execute on function public.change_member_role(uuid, public.office_role) to authenticated;
grant execute on function public.end_membership(uuid) to authenticated;

-- 4. access.create_account as in 20261121140000_create_account.sql, with the membership part moved into
-- access.add_membership. Behaviour and grants stay the same.
create or replace function access.create_account(
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
    perform access.add_membership(new_user, create_account.office_id, create_account.role, first_name, last_name);
  end if;

  return new_user;
end;
$$;
