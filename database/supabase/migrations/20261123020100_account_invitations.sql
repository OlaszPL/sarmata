-- Account invitations through the worker (docs/funkcjonalnosci.md, "Konta i logowanie"). The invitation needs the
-- Supabase service client (Auth admin), which the web app never holds. So the admin (user JWT) inserts a request,
-- the trigger sends accounts.invite to pgmq, the worker (service role) invites the account and writes the result
-- into the same row, which the frontend polls. Same pattern as ai_runs (ADR 0008).
--
-- Access goes through access.can('...', 'account_invitation', office_id, id): admin of the own office only.
create type public.account_invitation_status as enum ('pending', 'sent', 'failed');
create type public.account_invitation_mode as enum ('invitation', 'temporary_password', 'existing_account');

create table public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default access.current_office_id() references public.offices (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  role public.office_role not null,
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  requested_by uuid not null default auth.uid(),
  requested_at timestamptz not null default now(),
  status public.account_invitation_status not null default 'pending',
  mode public.account_invitation_mode,
  account_id uuid,
  employee_id uuid,
  -- Set by the worker when the invitation e-mail could not be sent. Never readable through the API:
  -- the admin takes it once with public.take_invitation_password. The flag tells that one is waiting.
  temporary_password text,
  temporary_password_set boolean not null default false,
  error_code text,
  error text,
  finished_at timestamptz,
  constraint account_invitations_result_check check (
    (status = 'pending' and mode is null and error_code is null and finished_at is null)
    or (status = 'sent' and mode is not null and error_code is null and finished_at is not null)
    or (status = 'failed' and mode is null and error_code is not null and finished_at is not null)
  ),
  constraint account_invitations_password_check check (
    temporary_password is null or (status = 'sent' and mode = 'temporary_password' and temporary_password_set)
  )
);
create index account_invitations_office_id_requested_at_idx
  on public.account_invitations (office_id, requested_at desc);
comment on table public.account_invitations is
  'Request to invite an account (zaproszenie konta) and its result. The worker writes the result columns. '
  'temporary_password is shown to the admin once (public.take_invitation_password) and then nulled.';

create trigger account_invitations_stamp_requester
  before insert on public.account_invitations
  for each row execute function public.stamp_author('requested_by', 'requested_at');

create function public.account_invitations_enqueue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pgmq.send(
    'jobs',
    jsonb_build_object('type', 'accounts.invite', 'payload', jsonb_build_object('invitationId', new.id))
  );
  return null;
end;
$$;

create trigger account_invitations_enqueue
  after insert on public.account_invitations
  for each row execute function public.account_invitations_enqueue();

-- access.can with the account_invitation branch, on top of the version from 20261122190200_access_can_ai_run.sql
-- (copied unchanged otherwise). Admin of the own office: read and create. Nobody updates or deletes through the API.
create or replace function access.can(action access.action, resource access.resource, office_id uuid, resource_id uuid)
returns boolean
language sql
stable
as $$
  select case
    when resource = 'regulation_version' then
      (office_id is null and action = 'read' and access.current_office_id() is not null)
      or (office_id = access.current_office_id()
          and (action = 'read' or access.current_office_role() = 'admin'))
    when resource in ('evaluation', 'evaluation_sheet', 'evaluation_event', 'evaluation_deadline') then
      office_id = access.current_office_id() and access.evaluation_rule(action, resource, resource_id)
    when resource = 'archived_evaluation' then
      office_id = access.current_office_id()
      and (action = 'read'
           or (action = 'create' and coalesce(access.current_office_role() in ('hr', 'evaluator'), false)))
    when resource in ('office', 'office_settings') then
      office_id = access.current_office_id()
      and (action = 'read'
           or (action = 'update' and coalesce(access.current_office_role() = 'admin', false)))
    when resource = 'note' then
      office_id = access.current_office_id() and access.note_rule(action, resource_id)
    when resource = 'notification' then
      office_id = access.current_office_id() and resource_id = auth.uid() and action in ('read', 'update')
    when resource = 'ai_run' then
      office_id = access.current_office_id() and access.ai_run_rule(action, resource_id)
    when resource = 'account_invitation' then
      office_id = access.current_office_id()
      and action in ('read', 'create')
      and coalesce(access.current_office_role() = 'admin', false)
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;

alter table public.account_invitations enable row level security;
revoke all on public.account_invitations from anon, authenticated;
-- Column grants keep temporary_password out of reach of the API. The result columns are written by the worker only.
grant select (
  id, office_id, email, role, first_name, last_name, requested_by, requested_at, status, mode,
  account_id, employee_id, temporary_password_set, error_code, error, finished_at
) on public.account_invitations to authenticated;
grant insert (email, role, first_name, last_name) on public.account_invitations to authenticated;

create policy "read account invitations" on public.account_invitations
  for select to authenticated
  using (access.can('read', 'account_invitation', office_id, id));

create policy "create account invitations" on public.account_invitations
  for insert to authenticated
  with check (access.can('create', 'account_invitation', office_id, id));

-- Returns the temporary password of an invitation of the own office and removes it, so it is shown once. Admin only.
-- Null when there is none (already taken, or the invitation was sent by e-mail).
create function public.take_invitation_password(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  if access.current_office_role() is distinct from 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  select i.temporary_password into secret
    from public.account_invitations i
   where i.id = p_invitation_id and i.office_id = access.current_office_id()
     for update;
  if secret is not null then
    update public.account_invitations
       set temporary_password = null, temporary_password_set = false
     where id = p_invitation_id;
  end if;
  return secret;
end;
$$;

revoke execute on function public.take_invitation_password(uuid) from public, anon;
grant execute on function public.take_invitation_password(uuid) to authenticated;
