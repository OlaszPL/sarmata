-- Employee profile (position, service status, grade, supervisor tree) and fuzzy matching. Domain terms: GLOSSARY.md.
create type public.position_kind as enum ('office_head', 'manages_people', 'other');
create type public.service_status as enum ('civil_servant', 'employee');
create type public.employment_basis as enum ('indefinite', 'appointment', 'fixed_term');

alter table public.employees
  add column position_title text,
  add column org_unit text,
  add column position_kind public.position_kind not null default 'other',
  add column service_status public.service_status not null default 'employee',
  add column employment_basis public.employment_basis not null default 'indefinite',
  add column employment_start date,
  add column appointment_year smallint check (appointment_year between 1990 and 2100),
  add column grade smallint check (grade between 1 and 9),
  add column grade_granted_on date,
  add column employment_ended_on date,
  add column supervisor_employee_id uuid,
  -- Grade and appointment data exist only for civil servants.
  add constraint employees_civil_servant_only check (
    service_status = 'civil_servant'
    or (grade is null and appointment_year is null and grade_granted_on is null)
  ),
  add constraint employees_not_own_supervisor check (supervisor_employee_id <> id),
  -- Target for the supervisor foreign key and for evaluations: a row is referenced together with its office.
  add constraint employees_id_office_id_key unique (id, office_id),
  add constraint employees_supervisor_fkey foreign key (supervisor_employee_id, office_id)
    references public.employees (id, office_id);

comment on column public.employees.supervisor_employee_id is 'Direct supervisor (przełożony) of the same office, forms the office tree.';

create index employees_office_id_supervisor_idx on public.employees (office_id, supervisor_employee_id);
create index employees_name_trgm_idx on public.employees
  using gin (lower(first_name || ' ' || last_name) extensions.gin_trgm_ops);

create function public.employees_no_supervisor_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ancestor uuid := new.supervisor_employee_id;
begin
  -- Walk up the tree: the new supervisor chain must not contain the employee.
  while ancestor is not null loop
    if ancestor = new.id then
      raise exception 'supervisor cycle';
    end if;
    select e.supervisor_employee_id into ancestor from public.employees e where e.id = ancestor;
  end loop;
  return new;
end;
$$;

create trigger employees_no_supervisor_cycle
  before insert or update of supervisor_employee_id on public.employees
  for each row execute function public.employees_no_supervisor_cycle();

-- Who may see evaluations: the whole office or only the supervisor tree (read by later evaluation policies).
alter table public.offices
  add column evaluation_visibility text not null default 'office'
    check (evaluation_visibility in ('office', 'tree'));

-- Suggests existing employees for a typed-in name. Invoker: RLS limits the search to the caller's office.
create function public.find_similar_employees(search text, max_results integer default 5)
returns table (
  id uuid,
  first_name text,
  last_name text,
  position_title text,
  org_unit text,
  score real
)
language sql
stable
set search_path = ''
as $$
  select e.id, e.first_name, e.last_name, e.position_title, e.org_unit,
         extensions.similarity(lower(e.first_name || ' ' || e.last_name), lower(search)) as score
    from public.employees e
   where lower(e.first_name || ' ' || e.last_name) operator(extensions.%) lower(search)
     and extensions.similarity(lower(e.first_name || ' ' || e.last_name), lower(search)) >= 0.3
   order by score desc, e.last_name, e.first_name
   limit max_results
$$;

revoke execute on function public.find_similar_employees(text, integer) from public;
grant execute on function public.find_similar_employees(text, integer) to authenticated;
