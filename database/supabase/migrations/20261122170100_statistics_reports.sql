-- Report functions of the statistics (statystyki): schedule and punctuality, distribution of levels, DSC-OCK
-- counts, criteria ratings and the per evaluator breakdown. All are security invoker, so RLS applies as
-- everywhere, and check the role first: hr and admin read the office reports, only hr reads the evaluators.
-- Functions with a year take the facts of evaluations drafted in that year and join them with the
-- projection evaluation_results on (evaluation_id, sheet_version): a result row of a sheet version that was
-- corrected later does not match, so it is not counted until the service recomputes it.

-- Open evaluations with their deadlines. Slots: startingInterview or startingInterviewAfterNegative for the
-- starting interview, evaluationDeadline or reevaluationAfterNegative for the evaluation itself.
create function public.statistics_schedule()
returns table (
  evaluation_id uuid,
  employee_id uuid,
  first_name text,
  last_name text,
  org_unit text,
  evaluator_account_id uuid,
  evaluator_name text,
  status text,
  cycle_start date,
  starting_interview_due_on date,
  evaluation_due_on date,
  suspended boolean,
  interview_held boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not coalesce(access.current_office_role() in ('hr', 'admin'), false) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select e.id,
         e.employee_id,
         emp.first_name,
         emp.last_name,
         e.snapshot ->> 'orgUnit',
         e.evaluator_account_id,
         nullif(trim(coalesce(ev.first_name, '') || ' ' || coalesce(ev.last_name, '')), ''),
         e.status::text,
         e.cycle_start,
         (select max(d.due_on) from public.evaluation_deadlines d
           where d.evaluation_id = e.id
             and d.slot in ('startingInterview', 'startingInterviewAfterNegative')),
         (select max(d.due_on) from public.evaluation_deadlines d
           where d.evaluation_id = e.id
             and d.slot in ('evaluationDeadline', 'reevaluationAfterNegative')),
         exists (select 1 from public.evaluation_deadlines d
                  where d.evaluation_id = e.id
                    and d.slot in ('startingInterview', 'startingInterviewAfterNegative',
                                   'evaluationDeadline', 'reevaluationAfterNegative')
                    and d.suspended_since is not null),
         exists (select 1 from public.evaluation_events x
                  where x.evaluation_id = e.id and x.kind = 'evaluation_interview_held')
    from public.evaluations e
    join public.employees emp on emp.id = e.employee_id and emp.office_id = e.office_id
    left join public.employees ev on ev.user_id = e.evaluator_account_id and ev.office_id = e.office_id
   where e.status not in ('closed', 'interrupted');
end;
$$;

-- Distribution of evaluations per organisational unit, civil servant status and level.
create function public.statistics_distribution(p_year integer)
returns table (
  org_unit text,
  civil_servant boolean,
  level_code text,
  evaluations bigint,
  negative bigint,
  second_negative bigint,
  with_conclusions bigint,
  grade_requests bigint,
  grade_by_law bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not coalesce(access.current_office_role() in ('hr', 'admin'), false) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select f.org_unit,
         f.civil_servant,
         r.level_code,
         count(*),
         count(*) filter (where r.outcome = 'negative'),
         count(*) filter (where r.second_consecutive_negative),
         count(*) filter (
           where nullif(trim(f.content #>> '{partTwo,developmentConclusions}'), '') is not null),
         count(*) filter (
           where f.civil_servant
             and f.content #> '{partTwo,gradeRequest}' is not null
             and f.content #> '{partTwo,gradeRequest}' <> 'null'::jsonb),
         count(*) filter (where extract(year from r.grade_by_law_due_on) = p_year)
    from public.statistics_evaluation_facts f
    join public.evaluation_results r
      on r.evaluation_id = f.evaluation_id and r.sheet_version = f.sheet_version
   where extract(year from f.drafted_on) = p_year
   group by f.org_unit, f.civil_servant, r.level_code;
end;
$$;

-- The counts behind the DSC-OCK questions that SQL can answer without the sheet levels.
-- Employees are counted as of 31 December of the year. Objections are counted from the event log, not from
-- the facts, because an evaluation sent back for redraft drops out of the facts. An objection belongs to the
-- year of the last sheet approval before it. Its result is the first objection_outcome recorded after the filing.
create function public.statistics_dsc_ock_counts(p_year integer)
returns table (
  indefinite_employees bigint,
  civil_servants bigint,
  objections_upheld bigint,
  objections_rejected bigint,
  objections_pending bigint,
  labour_court_appeals bigint,
  grades_on_request bigint
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
  )
  select (select count(*) from staff
           where staff.service_status = 'employee' and staff.employment_basis = 'indefinite'),
         (select count(*) from staff where staff.service_status = 'civil_servant'),
         (select count(*) from objections
           where drafted_year = p_year and outcome in ('changed', 'redraft')),
         (select count(*) from objections where drafted_year = p_year and outcome = 'rejected'),
         (select count(*) from objections where drafted_year = p_year and outcome is null),
         (select count(*) from public.evaluation_events x
           where x.kind = 'labour_court_appeal' and extract(year from x.occurred_on) = p_year),
         (select count(*) from public.grade_grants g
           where g.basis = 'on_request' and extract(year from g.granted_on) = p_year);
end;
$$;

-- Partial ratings per criterion and points, for the development needs.
create function public.statistics_criteria(p_year integer)
returns table (criterion_id text, points integer, ratings bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not coalesce(access.current_office_role() in ('hr', 'admin'), false) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select kv.key, kv.value::integer, count(*)
    from public.statistics_evaluation_facts f
    join public.evaluation_results r
      on r.evaluation_id = f.evaluation_id and r.sheet_version = f.sheet_version
    cross join lateral jsonb_each_text(f.content #> '{partTwo,ratings}') as kv
   where extract(year from f.drafted_on) = p_year
   group by kv.key, kv.value::integer;
end;
$$;

-- Evaluations per evaluator and level, with the sum of partial points and their number. hr only: the admin
-- gets 42501. Evaluators without an employee record have a null name.
create function public.statistics_evaluators(p_year integer)
returns table (
  evaluator_account_id uuid,
  evaluator_name text,
  level_code text,
  evaluations bigint,
  points_sum bigint,
  ratings bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select f.evaluator_account_id,
         nullif(trim(coalesce(ev.first_name, '') || ' ' || coalesce(ev.last_name, '')), ''),
         r.level_code,
         count(*),
         coalesce(sum(p.points), 0)::bigint,
         coalesce(sum(p.ratings), 0)::bigint
    from public.statistics_evaluation_facts f
    join public.evaluation_results r
      on r.evaluation_id = f.evaluation_id and r.sheet_version = f.sheet_version
    left join public.employees ev on ev.user_id = f.evaluator_account_id and ev.office_id = f.office_id
    cross join lateral (
      select coalesce(sum(kv.value::integer), 0) as points, count(*) as ratings
        from jsonb_each_text(f.content #> '{partTwo,ratings}') as kv
    ) p
   where extract(year from f.drafted_on) = p_year
   group by f.evaluator_account_id, ev.first_name, ev.last_name, r.level_code;
end;
$$;

revoke execute on function public.statistics_schedule() from public;
revoke execute on function public.statistics_distribution(integer) from public;
revoke execute on function public.statistics_dsc_ock_counts(integer) from public;
revoke execute on function public.statistics_criteria(integer) from public;
revoke execute on function public.statistics_evaluators(integer) from public;
grant execute on function public.statistics_schedule() to authenticated;
grant execute on function public.statistics_distribution(integer) to authenticated;
grant execute on function public.statistics_dsc_ock_counts(integer) to authenticated;
grant execute on function public.statistics_criteria(integer) to authenticated;
grant execute on function public.statistics_evaluators(integer) to authenticated;
