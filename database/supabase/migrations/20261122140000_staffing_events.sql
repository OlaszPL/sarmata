-- Staffing situations (sytuacje kadrowe): objection and interruption transitions, the decision on an
-- objection, corrections of a locked sheet, change of evaluator and archived evaluations.
-- Rules: docs/funkcjonalnosci.md. Roles: hr files objections, interrupts, decides objections and changes
-- the evaluator, only the admin corrects a locked sheet, hr and evaluators enter archived evaluations.

-- The transition table gains the rows added to evaluationTransitions in @sarmata/domain (B2 Task 1):
-- objection after delivery and an interruption from every stage that has not ended.
create or replace function public.evaluation_transitions()
returns table (
  from_status public.evaluation_status,
  to_status public.evaluation_status,
  event_kind public.evaluation_event_kind,
  lock_sheet boolean
)
language sql
immutable
set search_path = ''
as $$
  values
    ('criteria'::public.evaluation_status, 'criteria_awaiting_signature'::public.evaluation_status,
     'part_one_approved'::public.evaluation_event_kind, false),
    ('criteria_awaiting_signature', 'period', 'part_one_signed', false),
    ('period', 'interview', 'evaluation_interview_held', false),
    ('interview', 'drafted', 'sheet_approved', true),
    ('drafted', 'delivered', 'acquainted', false),
    ('drafted', 'delivered', 'signature_refused', false),
    ('delivered', 'closed', 'closed', false),
    ('delivered', 'objection', 'objection_filed', false),
    ('criteria', 'interrupted', 'interrupted', false),
    ('criteria_awaiting_signature', 'interrupted', 'interrupted', false),
    ('period', 'interrupted', 'interrupted', false),
    ('interview', 'interrupted', 'interrupted', false),
    ('drafted', 'interrupted', 'interrupted', false),
    ('delivered', 'interrupted', 'interrupted', false),
    ('objection', 'interrupted', 'interrupted', false)
$$;

-- Clients record only side events directly (absence, term change, position change). The events written
-- by the RPCs below come from them alone, next to the transition events and the sheet hash keys.
create or replace function public.evaluation_events_client_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.kind in (select t.event_kind from public.evaluation_transitions() t) then
    raise exception 'transition events are recorded only through apply_evaluation_transition';
  end if;
  if new.kind in ('objection_outcome', 'correction', 'evaluator_changed') then
    raise exception 'this event is recorded only through its RPC';
  end if;
  if new.payload ? 'sheetVersion' or new.payload ? 'sheetSha256' then
    raise exception 'sheet version and hash are recorded only through apply_evaluation_transition';
  end if;
  return new;
end;
$$;

-- apply_evaluation_transition as before, plus a role rule: objection and interruption are registered
-- by hr only (an evaluator may write the evaluation, but these two are a human resources decision).
create or replace function public.apply_evaluation_transition(
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
security definer
set search_path = ''
as $$
declare
  evaluation_office_id uuid;
  sheet record;
  -- The sheet keys are the transition's own record, never the caller's.
  event_payload jsonb := coalesce(p_payload, '{}'::jsonb) - 'sheetVersion' - 'sheetSha256';
  event_id uuid;
begin
  -- A missing evaluation and one the caller may not write look the same: no oracle across offices.
  select e.office_id into evaluation_office_id
    from public.evaluations e
   where e.id = p_evaluation_id;
  if not found
     or not coalesce(access.can('update', 'evaluation', evaluation_office_id, p_evaluation_id), false) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if p_event_kind in ('objection_filed', 'interrupted')
     and access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.evaluation_transitions() t
     where t.from_status = p_expected_status
       and t.to_status = p_next_status
       and t.event_kind = p_event_kind
       and t.lock_sheet = p_lock_sheet
  ) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- The row lock serializes concurrent transitions: the loser re-checks the status and finds none.
  update public.evaluations
     set status = p_next_status
   where id = p_evaluation_id
     and status = p_expected_status;
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

-- Decision on an objection (sprzeciw), hr only, from status objection only.
--   rejected: the locked sheet stays, status closed.
--   changed:  the locked sheet becomes superseded, p_new_content is the new locked version, status closed.
--   redraft:  the locked sheet becomes cancelled, a draft copy of it is added, status interview.
-- Always one objection_outcome event: p_payload plus outcome, sheetVersion and sheetSha256 (the sheet in
-- force after the decision for changed, the sheet decided on for rejected and redraft). Returns the event id.
-- Security definer like the transition: the sheet and status writes are not open to authenticated.
create function public.apply_objection_outcome(
  p_evaluation_id uuid,
  p_outcome text,
  p_occurred_on date,
  p_payload jsonb,
  p_new_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation record;
  current_sheet record;
  decided_sheet record;
  new_version integer;
  event_id uuid;
begin
  select e.office_id, e.status into evaluation
    from public.evaluations e
   where e.id = p_evaluation_id
     for update;
  if not found
     or evaluation.office_id is distinct from access.current_office_id()
     or access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if evaluation.status <> 'objection' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_outcome not in ('rejected', 'changed', 'redraft') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;

  select s.id, s.version, s.content, s.state into current_sheet
    from public.evaluation_sheets s
   where s.evaluation_id = p_evaluation_id
     and s.state in ('draft', 'locked')
   order by s.version desc
   limit 1
     for update;
  if current_sheet.id is null or current_sheet.state <> 'locked' then
    raise exception 'no locked sheet to decide on' using errcode = 'P0001';
  end if;
  decided_sheet := current_sheet;

  select max(s.version) + 1 into new_version
    from public.evaluation_sheets s
   where s.evaluation_id = p_evaluation_id;

  if p_outcome = 'changed' then
    if p_new_content is null then
      raise exception 'changed outcome needs new content' using errcode = '22023';
    end if;
    update public.evaluation_sheets set state = 'superseded' where id = current_sheet.id;
    insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state, reason)
    values (evaluation.office_id, p_evaluation_id, new_version, p_new_content, 'locked',
            p_payload ->> 'reason')
    returning id, version, content, state into decided_sheet;
    update public.evaluations set status = 'closed' where id = p_evaluation_id;
  elsif p_outcome = 'redraft' then
    update public.evaluation_sheets set state = 'cancelled' where id = current_sheet.id;
    insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state)
    values (evaluation.office_id, p_evaluation_id, new_version, current_sheet.content, 'draft');
    update public.evaluations set status = 'interview' where id = p_evaluation_id;
  else
    update public.evaluations set status = 'closed' where id = p_evaluation_id;
  end if;

  insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload)
  values (
    evaluation.office_id, p_evaluation_id, 'objection_outcome', p_occurred_on,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
      'outcome', p_outcome,
      'sheetVersion', decided_sheet.version,
      'sheetSha256', encode(extensions.digest(decided_sheet.content::text, 'sha256'), 'hex')
    )
  )
  returning id into event_id;

  return event_id;
end;
$$;

-- Correction of a locked sheet, admin only: the locked version becomes superseded and the new content is a
-- locked version with the reason. The event records the version and hash of the new one. Returns the event id.
create function public.correct_sheet(
  p_evaluation_id uuid,
  p_content jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation_office_id uuid;
  current_sheet record;
  new_sheet record;
  event_id uuid;
begin
  select e.office_id into evaluation_office_id
    from public.evaluations e
   where e.id = p_evaluation_id
     for update;
  if not found
     or evaluation_office_id is distinct from access.current_office_id()
     or access.current_office_role() is distinct from 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select s.id, s.version, s.state into current_sheet
    from public.evaluation_sheets s
   where s.evaluation_id = p_evaluation_id
     and s.state in ('draft', 'locked')
   order by s.version desc
   limit 1
     for update;
  if current_sheet.id is null or current_sheet.state <> 'locked' then
    raise exception 'no locked sheet to correct' using errcode = 'P0001';
  end if;

  update public.evaluation_sheets set state = 'superseded' where id = current_sheet.id;
  insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state, reason)
  values (evaluation_office_id, p_evaluation_id, current_sheet.version + 1, p_content, 'locked', p_reason)
  returning id, version, content into new_sheet;

  insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload)
  values (
    evaluation_office_id, p_evaluation_id, 'correction', current_date,
    jsonb_build_object(
      'reason', p_reason,
      'sheetVersion', new_sheet.version,
      'sheetSha256', encode(extensions.digest(new_sheet.content::text, 'sha256'), 'hex')
    )
  )
  returning id into event_id;

  return event_id;
end;
$$;

-- Change of evaluator, hr only. The new evaluator is a member of the same office with role evaluator or hr.
-- Event payload: { from, to, reason }. Returns the event id.
create function public.change_evaluator(
  p_evaluation_id uuid,
  p_new_evaluator_account_id uuid,
  p_occurred_on date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation record;
  event_id uuid;
begin
  select e.office_id, e.evaluator_account_id into evaluation
    from public.evaluations e
   where e.id = p_evaluation_id
     for update;
  if not found
     or evaluation.office_id is distinct from access.current_office_id()
     or access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.memberships m
     where m.user_id = p_new_evaluator_account_id
       and m.office_id = evaluation.office_id
       and m.role in ('evaluator', 'hr')
  ) then
    raise exception 'invalid_evaluator' using errcode = 'P0001';
  end if;

  update public.evaluations
     set evaluator_account_id = p_new_evaluator_account_id
   where id = p_evaluation_id;

  insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload)
  values (
    evaluation.office_id, p_evaluation_id, 'evaluator_changed', p_occurred_on,
    jsonb_build_object(
      'from', evaluation.evaluator_account_id,
      'to', p_new_evaluator_account_id,
      'reason', p_reason
    )
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke execute on function public.apply_objection_outcome(uuid, text, date, jsonb, jsonb) from public;
revoke execute on function public.correct_sheet(uuid, jsonb, text) from public;
revoke execute on function public.change_evaluator(uuid, uuid, date, text) from public;
grant execute on function public.apply_objection_outcome(uuid, text, date, jsonb, jsonb) to authenticated;
grant execute on function public.correct_sheet(uuid, jsonb, text) to authenticated;
grant execute on function public.change_evaluator(uuid, uuid, date, text) to authenticated;

-- Archived evaluations: results of evaluations made before the system, entered by hand.
create table public.archived_evaluations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  employee_id uuid not null,
  drafted_on date not null,
  acquainted_on date,
  level_code text,
  outcome text check (outcome in ('positive', 'negative')),
  ratings jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint archived_evaluations_employee_fkey foreign key (employee_id, office_id)
    references public.employees (id, office_id)
);
create index archived_evaluations_office_id_employee_id_idx on public.archived_evaluations (office_id, employee_id);
comment on table public.archived_evaluations is 'Archived evaluation (ocena archiwalna): a past result entered by hand.';

create trigger archived_evaluations_stamp_author
  before insert on public.archived_evaluations
  for each row execute function public.stamp_author('created_by', 'created_at');

-- access.can with the archived_evaluation branch: every member of the office reads, hr and evaluators
-- write. Still without table lookups (the role comes from the JWT).
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
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;

alter table public.archived_evaluations enable row level security;
grant select, insert on public.archived_evaluations to authenticated;

create policy "read archived evaluations" on public.archived_evaluations
  for select to authenticated
  using (access.can('read', 'archived_evaluation', office_id, id));

create policy "create archived evaluations" on public.archived_evaluations
  for insert to authenticated
  with check (access.can('create', 'archived_evaluation', office_id, id));
