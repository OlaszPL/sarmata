-- HR entries the DSC-OCK report needs and an evaluation does not carry: the appeal to the labour court after
-- a rejected objection (art. 83 ust. 5 ustawy) and the grant of a grade (art. 89: ust. 1 on request, ust. 2
-- by law). Both are written through RPCs for hr only. Rules: docs/funkcjonalnosci.md.

-- evaluation_events_client_rules as in 20261122140000_staffing_events.sql, with labour_court_appeal added
-- to the kinds only an RPC records.
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
  if new.kind in ('objection_outcome', 'correction', 'evaluator_changed', 'labour_court_appeal') then
    raise exception 'this event is recorded only through its RPC';
  end if;
  if new.payload ? 'sheetVersion' or new.payload ? 'sheetSha256' then
    raise exception 'sheet version and hash are recorded only through apply_evaluation_transition';
  end if;
  return new;
end;
$$;

-- Appeal to the labour court, hr only. The latest objection outcome of the evaluation must be rejected.
-- The event carries the filing date as occurred_on and an empty payload. Returns the event id.
-- Errors: 42501 (not hr, other office, no such evaluation), P0001 no_rejected_objection, already_recorded,
-- date_before_outcome.
create function public.record_labour_court_appeal(p_evaluation_id uuid, p_filed_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation_office_id uuid;
  last_outcome record;
  event_id uuid;
begin
  select e.office_id into evaluation_office_id
    from public.evaluations e
   where e.id = p_evaluation_id
     for update;
  if not found
     or evaluation_office_id is distinct from access.current_office_id()
     or access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select ev.occurred_on, ev.payload into last_outcome
    from public.evaluation_events ev
   where ev.evaluation_id = p_evaluation_id
     and ev.kind = 'objection_outcome'
   order by ev.occurred_on desc, ev.recorded_at desc
   limit 1;
  if not found or last_outcome.payload ->> 'outcome' is distinct from 'rejected' then
    raise exception 'no_rejected_objection' using errcode = 'P0001';
  end if;
  if exists (
    select 1
      from public.evaluation_events ev
     where ev.evaluation_id = p_evaluation_id
       and ev.kind = 'labour_court_appeal'
  ) then
    raise exception 'already_recorded' using errcode = 'P0001';
  end if;
  if p_filed_on < last_outcome.occurred_on then
    raise exception 'date_before_outcome' using errcode = 'P0001';
  end if;

  insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload)
  values (evaluation_office_id, p_evaluation_id, 'labour_court_appeal', p_filed_on, '{}'::jsonb)
  returning id into event_id;

  return event_id;
end;
$$;

-- Register of grade decisions. A grade belongs to the employee and may have no evaluation (a request under
-- art. 89 ust. 1), so it is a table of its own, not an evaluation event. No cascade: the row is the trace of a decision.
create table public.grade_grants (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  employee_id uuid not null,
  evaluation_id uuid,
  basis text not null check (basis in ('on_request', 'by_law')),
  granted_on date not null,
  previous_grade smallint,
  new_grade smallint not null check (new_grade between 1 and 9),
  recorded_by uuid not null default auth.uid(),
  recorded_at timestamptz not null default now(),
  constraint grade_grants_employee_fkey foreign key (employee_id, office_id)
    references public.employees (id, office_id),
  constraint grade_grants_evaluation_fkey foreign key (evaluation_id, office_id)
    references public.evaluations (id, office_id),
  constraint grade_grants_by_law_needs_evaluation check (basis = 'on_request' or evaluation_id is not null)
);
create index grade_grants_office_id_employee_id_idx on public.grade_grants (office_id, employee_id);
create unique index grade_grants_by_law_evaluation_key on public.grade_grants (evaluation_id) where basis = 'by_law';
comment on table public.grade_grants is 'Register of grade decisions (przyznanie stopnia): the source data of question 16 of the DSC-OCK report.';

create trigger grade_grants_stamp_author
  before insert on public.grade_grants
  for each row execute function public.stamp_author('recorded_by', 'recorded_at');

alter table public.grade_grants enable row level security;
grant select on public.grade_grants to authenticated;
create policy "read grade grants" on public.grade_grants
  for select to authenticated
  using (access.can('read', 'employee', office_id, employee_id));

-- Grants a grade, hr only (art. 89 ust. 1 on request, ust. 2 by law). One transaction: the register row, the
-- employee grade and date, and for by_law the removal of the gradeByLawGrant slot of the evaluation, which
-- closes the HR task. Returns the id of the register row.
-- Errors: 42501, P0001 not_civil_servant, grade_not_higher, date_before_previous_grant, evaluation_required,
-- 23505 for a second by_law grant on one evaluation.
create function public.record_grade_grant(
  p_employee_id uuid,
  p_evaluation_id uuid,
  p_basis text,
  p_granted_on date,
  p_new_grade smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee record;
  grant_id uuid;
begin
  select e.office_id, e.service_status, e.grade, e.grade_granted_on into employee
    from public.employees e
   where e.id = p_employee_id
     for update;
  if not found
     or employee.office_id is distinct from access.current_office_id()
     or access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if p_basis not in ('on_request', 'by_law') then
    raise exception 'invalid_basis' using errcode = '22023';
  end if;
  if employee.service_status is distinct from 'civil_servant' then
    raise exception 'not_civil_servant' using errcode = 'P0001';
  end if;
  if p_new_grade <= coalesce(employee.grade, 0) then
    raise exception 'grade_not_higher' using errcode = 'P0001';
  end if;
  if employee.grade_granted_on is not null and p_granted_on < employee.grade_granted_on then
    raise exception 'date_before_previous_grant' using errcode = 'P0001';
  end if;
  if (p_basis = 'by_law' or p_evaluation_id is not null)
     and not exists (
       select 1
         from public.evaluations ev
        where ev.id = p_evaluation_id
          and ev.employee_id = p_employee_id
          and ev.office_id = employee.office_id
     ) then
    raise exception 'evaluation_required' using errcode = 'P0001';
  end if;

  insert into public.grade_grants (
    office_id, employee_id, evaluation_id, basis, granted_on, previous_grade, new_grade
  )
  values (
    employee.office_id, p_employee_id, p_evaluation_id, p_basis, p_granted_on, employee.grade, p_new_grade
  )
  returning id into grant_id;

  update public.employees
     set grade = p_new_grade,
         grade_granted_on = p_granted_on
   where id = p_employee_id;

  if p_basis = 'by_law' then
    delete from public.evaluation_deadlines d
     where d.evaluation_id = p_evaluation_id
       and d.slot = 'gradeByLawGrant';
  end if;

  return grant_id;
end;
$$;

-- The evaluation service rewrites the deadline slots after every transition from a signal computed on the
-- employee snapshot. Without this guard the next transition would bring the closed grade slot back.
create function public.evaluation_deadlines_keep_grade_slot_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.grade_grants g
     where g.evaluation_id = new.evaluation_id
       and g.basis = 'by_law'
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger evaluation_deadlines_keep_grade_slot_closed
  before insert or update on public.evaluation_deadlines
  for each row
  when (new.slot = 'gradeByLawGrant')
  execute function public.evaluation_deadlines_keep_grade_slot_closed();

revoke execute on function public.record_labour_court_appeal(uuid, date) from public;
revoke execute on function public.record_grade_grant(uuid, uuid, text, date, smallint) from public;
revoke execute on function public.evaluation_deadlines_keep_grade_slot_closed() from public;
grant execute on function public.record_labour_court_appeal(uuid, date) to authenticated;
grant execute on function public.record_grade_grant(uuid, uuid, text, date, smallint) to authenticated;
