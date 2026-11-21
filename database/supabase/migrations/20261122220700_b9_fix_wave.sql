-- B9 fix wave (final review): objections and labour court appeals kept as their own rows, the end of an
-- employment writable only through end_employment, a future end date refused, notifications for ended
-- accounts skipped and the comment of memberships.ended_on corrected.

-- 1. Retained objections and appeals. The live DSC-OCK report counts one row per objection_filed event
-- (in the year of the last sheet_approved before it) and one per labour_court_appeal event. An evaluation
-- fact cannot carry that: an interrupted evaluation has no fact, a redraft cycle files a second objection.
-- So anonymize_employee copies the events into these rows before it deletes them.
create table public.retained_dsc_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  kind text not null check (kind in ('objection', 'labour_court_appeal')),
  -- objection: year of the last sheet approval before the filing. labour_court_appeal: year of the event.
  year smallint not null,
  -- objection only: outcome of the first decision after the filing, null while it is pending.
  outcome text,
  retained_at timestamptz not null default now()
);
create index retained_dsc_events_office_id_year_idx on public.retained_dsc_events (office_id, kind, year);
comment on table public.retained_dsc_events is
  'Objections and labour court appeals of anonymized employees: counts for the DSC-OCK report, without a person.';

alter table public.retained_dsc_events enable row level security;
revoke all on public.retained_dsc_events from anon, authenticated;
grant select on public.retained_dsc_events to authenticated;
create policy "hr and admin read retained dsc events" on public.retained_dsc_events
  for select to authenticated
  using (
    access.can('read', 'employee', office_id, id)
    and access.current_office_role() in ('hr', 'admin')
  );

-- Rows kept before this change: one objection or appeal per evaluation fact, the best that is known.
insert into public.retained_dsc_events (office_id, kind, year, outcome)
select t.office_id, 'objection', t.year,
       case when t.objection = 'pending' then null else t.objection end
  from public.retained_evaluation_facts t
 where t.objection <> 'none';
insert into public.retained_dsc_events (office_id, kind, year)
select t.office_id, 'labour_court_appeal', t.labour_court_appeal_year
  from public.retained_evaluation_facts t
 where t.labour_court_appeal_year is not null;

alter table public.retained_evaluation_facts
  drop column objection,
  drop column labour_court_appeal_year;

-- anonymize_employee as in 20261122220400_purge_functions.sql with three changes: the facts no longer carry
-- objections and appeals, the events become retained_dsc_events before the log is deleted, and the employee
-- must have an employment end date.
create or replace function public.anonymize_employee(p_employee_id uuid, p_today date, p_facts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee record;
  due_until date;
begin
  select e.office_id, e.user_id, e.anonymized_at, e.employment_ended_on into employee
    from public.employees e
   where e.id = p_employee_id
     for update;
  if not found then
    raise exception 'not_due' using errcode = 'P0001';
  end if;
  if employee.anonymized_at is not null then
    return;
  end if;
  if employee.employment_ended_on is null then
    raise exception 'not_due' using errcode = 'P0001';
  end if;

  select r.retained_until into due_until
    from public.employee_retention r
   where r.employee_id = p_employee_id;
  if not found or due_until >= p_today then
    raise exception 'not_due' using errcode = 'P0001';
  end if;

  if exists (
       select 1
         from public.statistics_evaluation_facts f
        where f.employee_id = p_employee_id
          and f.evaluation_id not in (
            select (x ->> 'evaluationId')::uuid from jsonb_array_elements(coalesce(p_facts, '[]'::jsonb)) x)
     )
     or exists (
       select 1
         from jsonb_array_elements(coalesce(p_facts, '[]'::jsonb)) x
        where not exists (
          select 1
            from public.evaluations ev
           where ev.id = (x ->> 'evaluationId')::uuid
             and ev.employee_id = p_employee_id)
     ) then
    raise exception 'facts_mismatch' using errcode = 'P0001';
  end if;

  insert into lifecycle.purge_marker (txid) values (txid_current()) on conflict do nothing;

  insert into public.retained_evaluation_facts (
    evaluation_id, office_id, sheet_id, year, org_unit, civil_servant, level_code, outcome, mean,
    second_consecutive_negative, grade_by_law_due_year, with_conclusions, grade_requested, ratings,
    evaluator_account_id
  )
  select f."evaluationId", employee.office_id, f."sheetId", f.year, f."orgUnit", f."civilServant",
         f."levelCode", f.outcome, f.mean, f."secondConsecutiveNegative", f."gradeByLawDueYear",
         f."withConclusions", f."gradeRequested", f.ratings, f."evaluatorAccountId"
    from jsonb_to_recordset(coalesce(p_facts, '[]'::jsonb)) as f(
      "evaluationId" uuid, "sheetId" text, year integer, "orgUnit" text, "civilServant" boolean,
      "levelCode" text, outcome text, mean numeric, "secondConsecutiveNegative" boolean,
      "gradeByLawDueYear" integer, "withConclusions" boolean, "gradeRequested" boolean, ratings jsonb,
      "evaluatorAccountId" uuid
    )
  on conflict (evaluation_id) do nothing;

  -- One row per objection_filed event of every evaluation of the employee, counted or not, with the same
  -- year and outcome the live statistics_dsc_ock_counts derives. An objection without an earlier approval
  -- never counts live, so it is not kept.
  insert into public.retained_dsc_events (office_id, kind, year, outcome)
  select employee.office_id, 'objection', o.drafted_year::smallint, o.outcome
    from (
      select (select d.payload ->> 'outcome'
                from public.evaluation_events d
               where d.evaluation_id = f.evaluation_id
                 and d.kind = 'objection_outcome'
                 and (d.occurred_on, d.recorded_at) > (f.occurred_on, f.recorded_at)
               order by d.occurred_on, d.recorded_at
               limit 1) as outcome,
             (select extract(year from a.occurred_on)
                from public.evaluation_events a
               where a.evaluation_id = f.evaluation_id
                 and a.kind = 'sheet_approved'
                 and (a.occurred_on, a.recorded_at) <= (f.occurred_on, f.recorded_at)
               order by a.occurred_on desc, a.recorded_at desc
               limit 1) as drafted_year
        from public.evaluation_events f
       where f.kind = 'objection_filed'
         and f.evaluation_id in (select e.id from public.evaluations e where e.employee_id = p_employee_id)
    ) o
   where o.drafted_year is not null;
  insert into public.retained_dsc_events (office_id, kind, year)
  select employee.office_id, 'labour_court_appeal', extract(year from x.occurred_on)::smallint
    from public.evaluation_events x
   where x.kind = 'labour_court_appeal'
     and x.evaluation_id in (select e.id from public.evaluations e where e.employee_id = p_employee_id);

  insert into public.retained_grade_grants (id, office_id, basis, granted_year, new_grade)
  select g.id, g.office_id, g.basis, extract(year from g.granted_on)::smallint, g.new_grade
    from public.grade_grants g
   where g.employee_id = p_employee_id
  on conflict (id) do nothing;

  -- No cascade reaches these two: the log and the register outlive nothing they describe.
  delete from public.evaluation_events ev
   where ev.evaluation_id in (select e.id from public.evaluations e where e.employee_id = p_employee_id);
  delete from public.grade_grants g
   where g.employee_id = p_employee_id
      or g.evaluation_id in (select e.id from public.evaluations e where e.employee_id = p_employee_id);

  -- Sheets, deadlines, notifications, results and the AI runs of these evaluations cascade.
  delete from public.evaluations e where e.employee_id = p_employee_id;

  delete from public.notes n where n.employee_id = p_employee_id;
  update public.ai_fragment_decisions d
     set final_text = null,
         content_deleted_at = coalesce(d.content_deleted_at, now())
    from public.ai_runs r
   where r.id = d.run_id
     and r.office_id = d.office_id
     and r.employee_id = p_employee_id
     and d.final_text is not null;
  update public.ai_runs r
     set input = null,
         output = null,
         failure_message = null,
         content_deleted_at = coalesce(r.content_deleted_at, now())
   where r.employee_id = p_employee_id
     and r.content_deleted_at is null;

  update public.employees
     set first_name = 'Anonimizowany',
         last_name = 'pracownik',
         email = null,
         position_title = null,
         org_unit = null,
         -- Only the year stays (1 January): the yearly counts of employees compare it with 31 December.
         employment_start = case when employment_start is null then null
                            else make_date(extract(year from employment_start)::integer, 1, 1) end,
         grade_granted_on = null,
         appointment_year = null,
         grade = null,
         anonymized_at = now()
   where id = p_employee_id;

  -- The login account goes: the membership follows (cascade), the employee link is cleared by its key.
  if employee.user_id is not null then
    delete from auth.users u where u.id = employee.user_id;
  end if;

  delete from lifecycle.purge_marker m where m.txid = txid_current();
end;
$$;

revoke execute on function public.anonymize_employee(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.anonymize_employee(uuid, date, jsonb) to service_role;

-- statistics_dsc_ock_counts as in 20261122220600_statistics_with_retained_facts.sql, the retained branches
-- of the objections and the appeals read retained_dsc_events.
create or replace function public.statistics_dsc_ock_counts(p_year integer)
returns table (
  indefinite_employees bigint,
  civil_servants bigint,
  objections_upheld bigint,
  objections_rejected bigint,
  objections_pending bigint,
  labour_court_appeals bigint,
  grades_on_request bigint,
  grades_by_law bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  year_end date := make_date(p_year, 12, 31);
begin
  if not coalesce(access.current_office_role() in ('hr', 'admin'), false) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  with staff as (
    -- Anonymized employees keep the year of the start (employment_start is the 1 January of it) and the
    -- end date, so every year counts them as before.
    select emp.service_status, emp.employment_basis
      from public.employees emp
     where (emp.employment_start is null or emp.employment_start <= year_end)
       and (emp.employment_ended_on is null or emp.employment_ended_on > year_end)
  ),
  objections as (
    select (select o.payload ->> 'outcome'
              from public.evaluation_events o
             where o.evaluation_id = f.evaluation_id
               and o.kind = 'objection_outcome'
               and (o.occurred_on, o.recorded_at) > (f.occurred_on, f.recorded_at)
             order by o.occurred_on, o.recorded_at
             limit 1) as outcome,
           (select extract(year from a.occurred_on)
              from public.evaluation_events a
             where a.evaluation_id = f.evaluation_id
               and a.kind = 'sheet_approved'
               and (a.occurred_on, a.recorded_at) <= (f.occurred_on, f.recorded_at)
             order by a.occurred_on desc, a.recorded_at desc
             limit 1) as drafted_year
      from public.evaluation_events f
     where f.kind = 'objection_filed'
    union all
    -- The objections of anonymized employees, one row each, kept from their events.
    select t.outcome, t.year
      from public.retained_dsc_events t
     where t.kind = 'objection'
  )
  select (select count(*) from staff
           where staff.service_status = 'employee' and staff.employment_basis = 'indefinite'),
         (select count(*) from staff where staff.service_status = 'civil_servant'),
         (select count(*) from objections
           where drafted_year = p_year and outcome in ('changed', 'redraft')),
         (select count(*) from objections where drafted_year = p_year and outcome = 'rejected'),
         (select count(*) from objections where drafted_year = p_year and outcome is null),
         (select count(*) from public.evaluation_events x
           where x.kind = 'labour_court_appeal' and extract(year from x.occurred_on) = p_year)
         + (select count(*) from public.retained_dsc_events t
             where t.kind = 'labour_court_appeal' and t.year = p_year),
         (select count(*) from public.grade_grants g
           where g.basis = 'on_request' and extract(year from g.granted_on) = p_year)
         + (select count(*) from public.retained_grade_grants g
             where g.basis = 'on_request' and g.granted_year = p_year),
         (select count(*) from public.grade_grants g
           where g.basis = 'by_law' and extract(year from g.granted_on) = p_year)
         + (select count(*) from public.retained_grade_grants g
             where g.basis = 'by_law' and g.granted_year = p_year);
end;
$$;

-- 2. The employment end is set only by end_employment (a security definer function, which runs as its
-- owner) or by a system path (service role, migrations). A signed-in client, hr included, cannot change it
-- through the employee row: that would leave the retention register and the membership out of step.
create function public.employees_guard_employment_end()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'employment end can only be changed by end_employment' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger employees_guard_employment_end
  before update of employment_ended_on on public.employees
  for each row
  when (old.employment_ended_on is distinct from new.employment_ended_on)
  execute function public.employees_guard_employment_end();

-- 3. end_employment as in 20261122220100_end_employment.sql: the end date cannot lie in the future (the
-- evaluations would be interrupted today with events dated later, and the access would go on until then).
create or replace function public.end_employment(
  p_employee_id uuid,
  p_ended_on date,
  p_reason text,
  p_purge_due_on date
)
returns table (interrupted_evaluation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee record;
  open_evaluation record;
begin
  select e.office_id, e.employment_ended_on, e.user_id into employee
    from public.employees e
   where e.id = p_employee_id
     for update;
  if not found
     or employee.office_id is distinct from access.current_office_id()
     or access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if employee.employment_ended_on is not null then
    raise exception 'already_ended' using errcode = 'P0001';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'empty reason' using errcode = '22023';
  end if;
  if p_ended_on is null or p_ended_on > current_date then
    raise exception 'future_end' using errcode = '22023';
  end if;

  update public.employees set employment_ended_on = p_ended_on where id = p_employee_id;

  insert into public.employee_retention (employee_id, office_id, retained_until)
  values (p_employee_id, employee.office_id, p_purge_due_on);

  -- The account loses the office from the end date on. The membership row stays until anonymization.
  if employee.user_id is not null then
    update public.memberships set ended_on = p_ended_on where user_id = employee.user_id;
  end if;

  -- apply_evaluation_transition checks access.can from the JWT of hr, which this call keeps.
  for open_evaluation in
    select ev.id, ev.status
      from public.evaluations ev
     where ev.employee_id = p_employee_id
       and ev.office_id = employee.office_id
       and ev.status not in ('closed', 'interrupted')
     order by ev.created_at, ev.id
  loop
    perform public.apply_evaluation_transition(
      open_evaluation.id, open_evaluation.status, 'interrupted', 'interrupted', p_ended_on,
      jsonb_build_object('reason', 'employment_ended', 'note', p_reason), false
    );
    interrupted_evaluation_id := open_evaluation.id;
    return next;
  end loop;
end;
$$;

revoke execute on function public.end_employment(uuid, date, text, date) from public, anon;
grant execute on function public.end_employment(uuid, date, text, date) to authenticated;

-- 4. No notification for an account whose membership has ended (a departed evaluator or hr person).
-- A trigger instead of a copy of collect_notifications: the generator and its digests stay as they are,
-- a skipped row is simply not created and so is not counted or digested.
create function public.notifications_skip_ended_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.memberships m
     where m.user_id = new.account_id
       and m.ended_on is not null
       and m.ended_on <= current_date
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger notifications_skip_ended_accounts
  before insert on public.notifications
  for each row execute function public.notifications_skip_ended_accounts();

revoke execute on function public.notifications_skip_ended_accounts() from public, anon, authenticated;

-- 5. Comment of memberships.ended_on: the hook and the evaluator trigger test ended_on > current_date, so
-- the access ends on that day.
comment on column public.memberships.ended_on is
  'First day without access: set when the employment of the account ends. From that day the JWT carries no office.';
