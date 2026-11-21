-- Ending an employment (ustanie zatrudnienia), the confirmation of the archive download and the overview
-- of the retention deadlines. hr only. Rules: docs/funkcjonalnosci.md, Usuwanie danych pracownika.

-- One transaction: the end date, the retention register row, the end of the account access and the
-- interruption of every evaluation of the employee that is still open (status other than closed and
-- interrupted) with an `interrupted` event whose payload is { reason: 'employment_ended', note }.
-- Closed evaluations stay closed. Returns the ids of the interrupted evaluations.
-- p_purge_due_on is the last day of retention, computed by retentionEndsOn in @sarmata/domain
-- (the trigger of employee_retention refuses a shorter period).
-- Errors: 42501 (not hr, other office, no such employee), P0001 already_ended, 22023 empty reason.
create function public.end_employment(
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

-- hr confirms that the archive of the employee was downloaded. Only a signal for the retention overview:
-- anonymization does not wait for it. P0001 not_ended when the employment has not ended.
create function public.confirm_archive_export(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_office uuid;
begin
  select e.office_id into employee_office
    from public.employees e
   where e.id = p_employee_id;
  if not found
     or employee_office is distinct from access.current_office_id()
     or access.current_office_role() is distinct from 'hr' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  update public.employee_retention
     set archive_exported_at = now(),
         archive_exported_by = auth.uid()
   where employee_id = p_employee_id;
  if not found then
    raise exception 'not_ended' using errcode = 'P0001';
  end if;
end;
$$;

-- Former employees whose retention ends within p_within_days days (or has ended) and who are not
-- anonymized yet, for the hr screen. Security invoker: RLS limits it to the office and to hr.
create function public.retention_overview(p_within_days integer default 90)
returns table (employee_id uuid, purge_due_on date, archive_exported_at timestamptz)
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
  select r.employee_id, r.retained_until, r.archive_exported_at
    from public.employee_retention r
    join public.employees e on e.id = r.employee_id and e.office_id = r.office_id
   where e.anonymized_at is null
     and r.retained_until < current_date + greatest(p_within_days, 0)
   order by r.retained_until, r.employee_id;
end;
$$;

revoke execute on function public.end_employment(uuid, date, text, date) from public, anon;
revoke execute on function public.confirm_archive_export(uuid) from public, anon;
revoke execute on function public.retention_overview(integer) from public, anon;
grant execute on function public.end_employment(uuid, date, text, date) to authenticated;
grant execute on function public.confirm_archive_export(uuid) to authenticated;
grant execute on function public.retention_overview(integer) to authenticated;
