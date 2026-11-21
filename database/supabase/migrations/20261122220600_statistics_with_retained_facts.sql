-- The statistics count the facts kept after an employee was anonymized (retained_evaluation_facts,
-- retained_grade_grants) together with the live ones, so a yearly report has the same numbers before and
-- after the anonymization. Four functions change, each a create or replace of the latest body with one
-- addition. Sources: statistics_distribution and statistics_criteria and statistics_evaluators from
-- 20261122170100_statistics_reports.sql, statistics_dsc_ock_counts from
-- 20261122210100_statistics_grades_by_law.sql. Security, signatures and grants stay.

create or replace function public.statistics_distribution(p_year integer)
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
  with combined as (
    select f.org_unit as unit,
           f.civil_servant as servant,
           r.level_code as level,
           r.outcome as result,
           r.second_consecutive_negative as second,
           nullif(trim(f.content #>> '{partTwo,developmentConclusions}'), '') is not null as conclusions,
           (f.civil_servant
             and f.content #> '{partTwo,gradeRequest}' is not null
             and f.content #> '{partTwo,gradeRequest}' <> 'null'::jsonb) as requested,
           coalesce(extract(year from r.grade_by_law_due_on) = p_year, false) as by_law
      from public.statistics_evaluation_facts f
      join public.evaluation_results r
        on r.evaluation_id = f.evaluation_id and r.sheet_version = f.sheet_version
     where extract(year from f.drafted_on) = p_year
    union all
    select t.org_unit, t.civil_servant, t.level_code, t.outcome, t.second_consecutive_negative,
           t.with_conclusions, t.grade_requested, coalesce(t.grade_by_law_due_year = p_year, false)
      from public.retained_evaluation_facts t
     where t.year = p_year
  )
  select c.unit, c.servant, c.level,
         count(*),
         count(*) filter (where c.result = 'negative'),
         count(*) filter (where c.second),
         count(*) filter (where c.conclusions),
         count(*) filter (where c.requested),
         count(*) filter (where c.by_law)
    from combined c
   group by c.unit, c.servant, c.level;
end;
$$;

create or replace function public.statistics_criteria(p_year integer)
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
  with rated as (
    select kv.key as criterion, kv.value::integer as given
      from public.statistics_evaluation_facts f
      join public.evaluation_results r
        on r.evaluation_id = f.evaluation_id and r.sheet_version = f.sheet_version
      cross join lateral jsonb_each_text(f.content #> '{partTwo,ratings}') as kv
     where extract(year from f.drafted_on) = p_year
    union all
    select x ->> 'criterionId', (x ->> 'points')::integer
      from public.retained_evaluation_facts t
      cross join lateral jsonb_array_elements(t.ratings) as x
     where t.year = p_year
  )
  select d.criterion, d.given, count(*)
    from rated d
   group by d.criterion, d.given;
end;
$$;

create or replace function public.statistics_evaluators(p_year integer)
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
  with combined as (
    select f.evaluator_account_id as account, f.office_id as office, r.level_code as level,
           p.points as pts, p.ratings as cnt
      from public.statistics_evaluation_facts f
      join public.evaluation_results r
        on r.evaluation_id = f.evaluation_id and r.sheet_version = f.sheet_version
      cross join lateral (
        select coalesce(sum(kv.value::integer), 0) as points, count(*) as ratings
          from jsonb_each_text(f.content #> '{partTwo,ratings}') as kv
      ) p
     where extract(year from f.drafted_on) = p_year
    union all
    select t.evaluator_account_id, t.office_id, t.level_code, p.points, p.ratings
      from public.retained_evaluation_facts t
      cross join lateral (
        select coalesce(sum((x ->> 'points')::integer), 0) as points, count(*) as ratings
          from jsonb_array_elements(t.ratings) as x
      ) p
     where t.year = p_year
  )
  select c.account,
         nullif(trim(coalesce(ev.first_name, '') || ' ' || coalesce(ev.last_name, '')), ''),
         c.level,
         count(*),
         coalesce(sum(c.pts), 0)::bigint,
         coalesce(sum(c.cnt), 0)::bigint
    from combined c
    left join public.employees ev on ev.user_id = c.account and ev.office_id = c.office
   group by c.account, ev.first_name, ev.last_name, c.level;
end;
$$;

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
    -- The objection of an evaluation whose employee was anonymized: one per evaluation, its result or none yet.
    select case when t.objection = 'pending' then null else t.objection end, t.year
      from public.retained_evaluation_facts t
     where t.objection <> 'none'
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
         + (select count(*) from public.retained_evaluation_facts t
             where t.labour_court_appeal_year = p_year),
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
