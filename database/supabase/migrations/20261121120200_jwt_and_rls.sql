-- Single access decision point: every RLS policy asks access.can(action, resource, office_id, resource_id).
-- For now it only enforces office isolation. Per role and per resource rules (e.g. notes: author and HR)
-- belong here, not in policies. Row identity is part of the interface: per-resource rules
-- (docs/funkcjonalnosci.md, "Dostęp w ramach urzędu") look up author or evaluator by it.
-- Keep the office check in can() and put lookups in a second function, so can() stays inlinable.
create schema access;
grant usage on schema access to authenticated, supabase_auth_admin;

create type access.action as enum ('read', 'create', 'update', 'delete');
create type access.resource as enum ('office', 'membership', 'employee');

-- Supabase Auth hook: adds office_id and role from the membership to the JWT (ADR 0004).
create function access.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
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

-- The only place that knows where the signed-in account's office comes from (claim set by the hook).
-- No SET search_path on this and on can(): it would stop the planner from inlining them into policies. All references are schema-qualified.
create function access.current_office_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'office_id', '')::uuid
$$;

create function access.can(action access.action, resource access.resource, office_id uuid, resource_id uuid)
returns boolean
language sql
stable
as $$
  select office_id is not null and office_id = access.current_office_id()
$$;

-- Supabase default privileges give anon and authenticated ALL (TRUNCATE ignores RLS) on new public tables.
-- The grants below are the complete intended surface.
revoke execute on all functions in schema access from public;
grant execute on function access.current_office_id(), access.can(access.action, access.resource, uuid, uuid) to authenticated;
grant execute on function access.custom_access_token_hook(jsonb) to supabase_auth_admin;

alter table public.offices enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;

grant usage on schema public to supabase_auth_admin;
revoke all on public.offices, public.memberships, public.employees from anon, authenticated;
grant select on public.offices, public.memberships to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select on table public.memberships to supabase_auth_admin;

-- Tables, sequences and functions created by later migrations start without Data API access.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

create policy "auth hook reads memberships" on public.memberships
  for select to supabase_auth_admin
  using (true);

create policy "read office" on public.offices
  for select to authenticated
  using (access.can('read', 'office', id, id));

create policy "read memberships" on public.memberships
  for select to authenticated
  using (access.can('read', 'membership', office_id, user_id));

create policy "read employees" on public.employees
  for select to authenticated
  using (access.can('read', 'employee', office_id, id));

create policy "create employees" on public.employees
  for insert to authenticated
  with check (access.can('create', 'employee', office_id, id));

create policy "update employees" on public.employees
  for update to authenticated
  using (access.can('update', 'employee', office_id, id))
  with check (access.can('update', 'employee', office_id, id));

create policy "delete employees" on public.employees
  for delete to authenticated
  using (access.can('delete', 'employee', office_id, id));
