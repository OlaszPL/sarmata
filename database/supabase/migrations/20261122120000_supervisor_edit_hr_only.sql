-- Only hr and admin set or change the supervisor (przełożony) of an employee. Paths without a JWT office role
-- (seed, service role, owner) have current_office_role() null and pass.
create function public.employees_supervisor_hr_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_role public.office_role := access.current_office_role();
begin
  if tg_op = 'INSERT' then
    if new.supervisor_employee_id is null then
      return new;
    end if;
  elsif new.supervisor_employee_id is not distinct from old.supervisor_employee_id then
    return new;
  end if;

  if caller_role is not null and caller_role not in ('hr', 'admin') then
    raise exception 'supervisor change requires hr or admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger employees_supervisor_hr_only
  before insert or update on public.employees
  for each row execute function public.employees_supervisor_hr_only();
