-- Supabase Auth hook: adds office_id and role from the membership to the JWT (ADR 0004).
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb := event -> 'claims';
  membership record;
begin
  select c.office_id, c.role
    into membership
    from public.memberships c
   where c.user_id = (event ->> 'user_id')::uuid;

  if found then
    claims := claims || jsonb_build_object('office_id', membership.office_id, 'office_role', membership.role);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on table public.memberships to supabase_auth_admin;

-- Single access decision point: every RLS policy asks access.can(action, resource, office_id).
-- For now it only enforces office isolation. Per role and per resource rules (e.g. notes: author and HR)
-- belong here, not in policies. The row's office_id comes from the policy, so there is no lookup.
create schema access;
grant usage on schema access to authenticated;

-- The only place that knows where the signed-in account's office comes from (claim set by the hook).
create function access.current_office_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'office_id', '')::uuid
$$;

create function access.can(action text, resource text, office_id uuid)
returns boolean
language sql
stable
as $$
  select office_id is not null and office_id = access.current_office_id()
$$;
grant execute on function access.can(text, text, uuid) to authenticated;

alter table public.offices enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;

revoke all on public.offices, public.memberships, public.employees from anon;
grant select on public.offices, public.memberships to authenticated;
grant select, insert, update, delete on public.employees to authenticated;

create policy "auth hook reads memberships" on public.memberships
  for select to supabase_auth_admin
  using (true);

create policy "read office" on public.offices
  for select to authenticated
  using (access.can('read', 'office', id));

create policy "read memberships" on public.memberships
  for select to authenticated
  using (access.can('read', 'membership', office_id));

create policy "read employees" on public.employees
  for select to authenticated
  using (access.can('read', 'employee', office_id));

create policy "create employees" on public.employees
  for insert to authenticated
  with check (access.can('create', 'employee', office_id));

create policy "update employees" on public.employees
  for update to authenticated
  using (access.can('update', 'employee', office_id))
  with check (access.can('update', 'employee', office_id));

create policy "delete employees" on public.employees
  for delete to authenticated
  using (access.can('delete', 'employee', office_id));
