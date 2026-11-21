-- DSC-OCK question 17 (art. 89 ust. 2) counts the grades granted by law in the register (grade_grants,
-- basis by_law) by the year of the grant, like question 16 does for grants on request. The computed due
-- date lost evaluations acquainted in December and counted rulings hr had not made yet (B5 review).

drop function public.statistics_dsc_ock_counts(integer);

create function public.statistics_dsc_ock_counts(p_year integer)
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
           where g.basis = 'on_request' and extract(year from g.granted_on) = p_year),
         (select count(*) from public.grade_grants g
           where g.basis = 'by_law' and extract(year from g.granted_on) = p_year);
end;
$$;

revoke execute on function public.statistics_dsc_ock_counts(integer) from public;
grant execute on function public.statistics_dsc_ock_counts(integer) to authenticated;
