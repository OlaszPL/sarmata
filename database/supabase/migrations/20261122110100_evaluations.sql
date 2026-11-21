-- Evaluations (oceny okresowe): the evaluation, versioned sheet content, an append-only event log and
-- computed deadlines. Domain terms: GLOSSARY.md. Rules: docs/funkcjonalnosci.md, ADR 0007.
--
-- Access, as everywhere, goes through access.can(action, resource, office_id, resource_id).
-- For evaluations resource_id is the evaluation id. For the child tables (evaluation_sheets,
-- evaluation_events, evaluation_deadlines) resource_id is evaluation_id, not the row id: every rule
-- about a child row is a rule about its evaluation (who evaluates it, who may see it).

-- sha256 of the sheet content in the event log (ADR 0007). Supabase ships it, this keeps the dependency explicit.
create extension if not exists pgcrypto with schema extensions;

create type public.evaluation_status as enum (
  'criteria', 'criteria_awaiting_signature', 'period', 'interview', 'drafted', 'delivered', 'closed',
  'objection', 'interrupted'
);

create type public.evaluation_event_kind as enum (
  'created', 'part_one_approved', 'part_one_signed', 'evaluation_interview_held', 'sheet_approved',
  'acquainted', 'signature_refused', 'closed', 'objection_filed', 'objection_outcome', 'absence',
  'term_changed', 'evaluator_changed', 'position_changed', 'correction', 'interrupted'
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  employee_id uuid not null,
  evaluator_account_id uuid not null,
  regulation_version_id uuid not null references public.regulation_versions (id),
  sheet_id text not null check (sheet_id ~ '^[A-Z]$'),
  status public.evaluation_status not null default 'criteria',
  cycle_start date not null,
  after_negative boolean not null default false,
  previous_evaluation_id uuid,
  snapshot jsonb not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Target for the child tables: a row is referenced together with its office.
  constraint evaluations_id_office_id_key unique (id, office_id),
  constraint evaluations_employee_fkey foreign key (employee_id, office_id)
    references public.employees (id, office_id),
  constraint evaluations_evaluator_fkey foreign key (evaluator_account_id, office_id)
    references public.memberships (user_id, office_id),
  constraint evaluations_previous_fkey foreign key (previous_evaluation_id, office_id)
    references public.evaluations (id, office_id)
);
-- Leads with office_id, so it also serves the RLS index condition.
create index evaluations_office_id_employee_id_idx on public.evaluations (office_id, employee_id);
comment on table public.evaluations is 'Evaluation (ocena okresowa) of one employee for one cycle.';
comment on column public.evaluations.snapshot is 'Employee data as of the day the evaluation was created.';

create table public.evaluation_sheets (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null,
  evaluation_id uuid not null,
  version integer not null check (version >= 1),
  content jsonb not null,
  state text not null check (state in ('draft', 'locked', 'superseded', 'cancelled')),
  reason text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint evaluation_sheets_evaluation_id_version_key unique (evaluation_id, version),
  constraint evaluation_sheets_evaluation_fkey foreign key (evaluation_id, office_id)
    references public.evaluations (id, office_id) on delete cascade
);
comment on table public.evaluation_sheets is 'Evaluation sheet version (wersja arkusza): content validated by @sarmata/domain.';

create table public.evaluation_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null,
  evaluation_id uuid not null,
  kind public.evaluation_event_kind not null,
  occurred_on date not null,
  payload jsonb not null default '{}',
  recorded_by uuid not null default auth.uid(),
  recorded_at timestamptz not null default now(),
  -- No cascade: the log outlives nothing it describes (append-only, ADR 0007).
  constraint evaluation_events_evaluation_fkey foreign key (evaluation_id, office_id)
    references public.evaluations (id, office_id)
);
create index evaluation_events_evaluation_id_idx on public.evaluation_events (evaluation_id, recorded_at);
comment on table public.evaluation_events is 'Evaluation event (zdarzenie oceny): append-only log, the record of approvals.';

create table public.evaluation_deadlines (
  evaluation_id uuid not null,
  office_id uuid not null,
  slot text not null,
  window_start date,
  due_on date,
  suspended_since date,
  computed_at timestamptz not null default now(),
  primary key (evaluation_id, slot),
  constraint evaluation_deadlines_evaluation_fkey foreign key (evaluation_id, office_id)
    references public.evaluations (id, office_id) on delete cascade
);
comment on table public.evaluation_deadlines is 'Deadline (termin) of an evaluation, recomputed from its events.';

-- True when the signed-in account is a supervisor of the employee anywhere up the tree.
-- Security definer: reads the tree regardless of employee RLS. Bounded at 50 levels.
create function access.supervises_employee(employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain (supervisor_id, depth) as (
    select e.supervisor_employee_id, 1
      from public.employees e
     where e.id = supervises_employee.employee_id
       and e.office_id = access.current_office_id()
    union all
    select e.supervisor_employee_id, c.depth + 1
      from chain c
      join public.employees e on e.id = c.supervisor_id
     where c.depth < 50
  )
  select exists (
    select 1
      from chain c
      join public.employees e on e.id = c.supervisor_id
     where e.user_id = auth.uid()
  )
$$;

-- Per role and per evaluation rules, called from access.can after its office check.
-- resource_id is the evaluation id for every resource (see the header).
create function access.evaluation_rule(action access.action, resource access.resource, resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when evaluation_rule.action = 'delete' then false
    -- Evaluators and HR open evaluations, the admin does not (docs/funkcjonalnosci.md).
    when evaluation_rule.action = 'create' and evaluation_rule.resource = 'evaluation' then
      coalesce(access.current_office_role() in ('evaluator', 'hr'), false)
    -- Writing: HR, or the evaluator of this evaluation.
    when evaluation_rule.action in ('create', 'update') then
      coalesce(access.current_office_role() = 'hr', false)
      or exists (
        select 1
          from public.evaluations e
         where e.id = evaluation_rule.resource_id
           and e.office_id = access.current_office_id()
           and e.evaluator_account_id = auth.uid()
      )
    -- Reading depends on offices.evaluation_visibility: 'office' lets every member read,
    -- 'tree' only HR, the admin, the evaluator and supervisors of the employee up the tree.
    when evaluation_rule.action = 'read' then
      coalesce(access.current_office_role() in ('hr', 'admin'), false)
      or exists (
        select 1
          from public.offices o
         where o.id = access.current_office_id()
           and o.evaluation_visibility = 'office'
      )
      or exists (
        select 1
          from public.evaluations e
         where e.id = evaluation_rule.resource_id
           and e.office_id = access.current_office_id()
           and (e.evaluator_account_id = auth.uid() or access.supervises_employee(e.employee_id))
      )
      -- An evaluation this command is inserting is not in the snapshot yet (INSERT ... RETURNING).
      -- Only its creator reaches this: the create rule and evaluations_set_evaluator already ran.
      or (evaluation_rule.resource = 'evaluation'
          and not exists (select 1 from public.evaluations e where e.id = evaluation_rule.resource_id))
    else false
  end
$$;

-- Single access decision point, extended for evaluations. Still one expression without table lookups:
-- the office check stays here, so it remains an index condition, and the row lookups live in
-- access.evaluation_rule. Constant resource arguments fold the CASE away when inlined into a policy.
create or replace function access.can(action access.action, resource access.resource, office_id uuid, resource_id uuid)
returns boolean
language sql
stable
as $$
  select case
    when resource = 'regulation_version' then
      -- Official versions (office_id null): global reference data, read by every account that belongs to an office.
      (office_id is null and action = 'read' and access.current_office_id() is not null)
      -- Local versions: the office reads them, only the office admin changes them (docs/funkcjonalnosci.md, rule editor).
      or (office_id = access.current_office_id()
          and (action = 'read' or access.current_office_role() = 'admin'))
    when resource in ('evaluation', 'evaluation_sheet', 'evaluation_event', 'evaluation_deadline') then
      office_id = access.current_office_id() and access.evaluation_rule(action, resource, resource_id)
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;

revoke execute on function access.supervises_employee(uuid) from public;
revoke execute on function access.evaluation_rule(access.action, access.resource, uuid) from public;
grant execute on function access.supervises_employee(uuid) to authenticated;
grant execute on function access.evaluation_rule(access.action, access.resource, uuid) to authenticated;

-- Author columns hold the signed-in account, whatever the client sends. Without a JWT subject
-- (service role, seeds) the supplied value stays. The column name is the trigger argument.
create function public.stamp_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], auth.uid()));
  end if;
  return new;
end;
$$;

create trigger evaluations_stamp_author
  before insert on public.evaluations
  for each row execute function public.stamp_author('created_by');
create trigger evaluation_sheets_stamp_author
  before insert on public.evaluation_sheets
  for each row execute function public.stamp_author('created_by');
create trigger evaluation_events_stamp_author
  before insert on public.evaluation_events
  for each row execute function public.stamp_author('recorded_by');

-- An evaluator opens evaluations only for themselves. Security definer: the service role has no
-- access to schema access.
create function public.evaluations_set_evaluator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if access.current_office_role() = 'evaluator' then
    new.evaluator_account_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger evaluations_set_evaluator
  before insert on public.evaluations
  for each row execute function public.evaluations_set_evaluator();

-- Part one is frozen once the criteria stage is over: going back to it would unfreeze part one.
create function public.evaluations_criteria_not_reopened()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'criteria' and new.status = 'criteria' then
    raise exception 'evaluation cannot return to criteria';
  end if;
  return new;
end;
$$;

create trigger evaluations_criteria_not_reopened
  before update of status on public.evaluations
  for each row execute function public.evaluations_criteria_not_reopened();

-- The log only grows, for everyone including the database owner.
create function public.evaluation_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'evaluation events are append-only';
end;
$$;

create trigger evaluation_events_append_only
  before update or delete on public.evaluation_events
  for each row execute function public.evaluation_events_append_only();

-- A locked version is what was approved (its hash is in the log). The only change left is
-- retiring it: locked to superseded or cancelled.
create function public.evaluation_sheets_locked_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state <> 'draft'
     and not (old.state = 'locked'
              and new.state in ('superseded', 'cancelled')
              and to_jsonb(new) - 'state' = to_jsonb(old) - 'state') then
    raise exception 'evaluation sheet version is locked';
  end if;
  return new;
end;
$$;

create trigger evaluation_sheets_locked_immutable
  before update on public.evaluation_sheets
  for each row execute function public.evaluation_sheets_locked_immutable();

-- After the criteria stage part one never changes: not by editing a version, not by adding one.
-- Security definer: the status is read regardless of what the caller may see. Before triggers run
-- ahead of the RLS check, so every lookup stays in the row's office: a row pointing at another
-- office's evaluation learns nothing here and fails on the foreign key.
create function public.evaluation_sheets_part_one_frozen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation_status public.evaluation_status;
  previous_part_one jsonb;
begin
  select e.status into evaluation_status
    from public.evaluations e
   where e.id = new.evaluation_id
     and e.office_id = new.office_id;

  if evaluation_status is distinct from 'criteria' then
    if tg_op = 'UPDATE' then
      previous_part_one := old.content -> 'partOne';
    else
      select s.content -> 'partOne' into previous_part_one
        from public.evaluation_sheets s
       where s.evaluation_id = new.evaluation_id
         and s.office_id = new.office_id
       order by s.version desc
       limit 1;
      if not found then
        return new;
      end if;
    end if;
    if new.content -> 'partOne' is distinct from previous_part_one then
      raise exception 'part one is locked';
    end if;
  end if;
  return new;
end;
$$;

create trigger evaluation_sheets_part_one_frozen
  before insert or update on public.evaluation_sheets
  for each row execute function public.evaluation_sheets_part_one_frozen();

alter table public.evaluations enable row level security;
alter table public.evaluation_sheets enable row level security;
alter table public.evaluation_events enable row level security;
alter table public.evaluation_deadlines enable row level security;

-- Later migrations start without Data API grants (plan 2), so this is the complete surface.
-- No delete anywhere, and the event log takes no updates either.
grant select, insert, update on public.evaluations, public.evaluation_sheets, public.evaluation_deadlines to authenticated;
grant select, insert on public.evaluation_events to authenticated;

create policy "read evaluations" on public.evaluations
  for select to authenticated
  using (access.can('read', 'evaluation', office_id, id));

create policy "create evaluations" on public.evaluations
  for insert to authenticated
  with check (access.can('create', 'evaluation', office_id, id));

create policy "update evaluations" on public.evaluations
  for update to authenticated
  using (access.can('update', 'evaluation', office_id, id))
  with check (access.can('update', 'evaluation', office_id, id));

create policy "read evaluation sheets" on public.evaluation_sheets
  for select to authenticated
  using (access.can('read', 'evaluation_sheet', office_id, evaluation_id));

create policy "create evaluation sheets" on public.evaluation_sheets
  for insert to authenticated
  with check (access.can('create', 'evaluation_sheet', office_id, evaluation_id));

create policy "update evaluation sheets" on public.evaluation_sheets
  for update to authenticated
  using (access.can('update', 'evaluation_sheet', office_id, evaluation_id))
  with check (access.can('update', 'evaluation_sheet', office_id, evaluation_id));

create policy "read evaluation events" on public.evaluation_events
  for select to authenticated
  using (access.can('read', 'evaluation_event', office_id, evaluation_id));

create policy "create evaluation events" on public.evaluation_events
  for insert to authenticated
  with check (access.can('create', 'evaluation_event', office_id, evaluation_id));

create policy "read evaluation deadlines" on public.evaluation_deadlines
  for select to authenticated
  using (access.can('read', 'evaluation_deadline', office_id, evaluation_id));

create policy "create evaluation deadlines" on public.evaluation_deadlines
  for insert to authenticated
  with check (access.can('create', 'evaluation_deadline', office_id, evaluation_id));

create policy "update evaluation deadlines" on public.evaluation_deadlines
  for update to authenticated
  using (access.can('update', 'evaluation_deadline', office_id, evaluation_id))
  with check (access.can('update', 'evaluation_deadline', office_id, evaluation_id));

-- One transition, atomically: status (compare and set), optional lock of the current sheet version,
-- and the event. The event payload carries the sheet version and the sha256 of its content, the record
-- of what was approved (ADR 0007). Security invoker: RLS decides, a caller who may not update the
-- evaluation gets stale_status like a lost race.
create function public.apply_evaluation_transition(
  p_evaluation_id uuid,
  p_expected_status public.evaluation_status,
  p_next_status public.evaluation_status,
  p_event_kind public.evaluation_event_kind,
  p_occurred_on date,
  p_payload jsonb,
  p_lock_sheet boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  evaluation_office_id uuid;
  sheet record;
  event_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  event_id uuid;
begin
  -- The row lock serializes concurrent transitions: the loser re-checks the status and finds none.
  update public.evaluations
     set status = p_next_status
   where id = p_evaluation_id
     and status = p_expected_status
  returning office_id into evaluation_office_id;
  if not found then
    raise exception 'stale_status' using errcode = 'P0001';
  end if;

  select s.id, s.version, s.state, s.content into sheet
    from public.evaluation_sheets s
   where s.evaluation_id = p_evaluation_id
     and s.state in ('draft', 'locked')
   order by s.version desc
   limit 1
     for update;

  if p_lock_sheet then
    if sheet.id is null or sheet.state <> 'draft' then
      raise exception 'no draft sheet to lock' using errcode = 'P0001';
    end if;
    update public.evaluation_sheets set state = 'locked' where id = sheet.id;
  end if;

  if sheet.id is not null then
    event_payload := event_payload || jsonb_build_object(
      'sheetVersion', sheet.version,
      'sheetSha256', encode(extensions.digest(sheet.content::text, 'sha256'), 'hex')
    );
  end if;

  insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload)
  values (evaluation_office_id, p_evaluation_id, p_event_kind, p_occurred_on, event_payload)
  returning id into event_id;

  return event_id;
end;
$$;

revoke execute on function public.apply_evaluation_transition(
  uuid, public.evaluation_status, public.evaluation_status, public.evaluation_event_kind, date, jsonb, boolean
) from public;
grant execute on function public.apply_evaluation_transition(
  uuid, public.evaluation_status, public.evaluation_status, public.evaluation_event_kind, date, jsonb, boolean
) to authenticated;
