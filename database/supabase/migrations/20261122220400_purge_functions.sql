-- The two system steps of the data lifecycle and a preview for the admin. System functions follow the
-- pattern of 20261122160400_close_unobjected_evaluations.sql: security definer, empty search_path, execute
-- only for the service role (the worker). Called through the queue by 20261122220500_retention_schedule.sql.

-- Step one: the content of notes and AI runs expires after office_settings.notes_retention_months.
-- Notes older than that go with their versions. A finished AI run (done or failed) of that age keeps its
-- metadata (kind, who, when, status, prompt version, references) and loses input, output and failure
-- message, together with the text of its fragment decisions. Queued and running runs stay. Shortening the
-- period works backwards: the next call removes everything older than the new one. Idempotent.
create function public.purge_expired_content(p_today date)
returns table (notes integer, ai_runs integer, decisions integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notes integer;
  v_runs integer;
  v_decisions integer;
begin
  with removed as (
    delete from public.notes n
     using public.office_settings s
     where s.office_id = n.office_id
       and n.created_at::date < (p_today - make_interval(months => s.notes_retention_months))::date
    returning 1
  )
  select count(*)::integer into v_notes from removed;

  with cleared as (
    update public.ai_runs r
       set input = null,
           output = null,
           failure_message = null,
           content_deleted_at = now()
      from public.office_settings s
     where s.office_id = r.office_id
       and r.content_deleted_at is null
       and r.status in ('done', 'failed')
       and r.requested_at::date < (p_today - make_interval(months => s.notes_retention_months))::date
    returning 1
  )
  select count(*)::integer into v_runs from cleared;

  with cleared as (
    update public.ai_fragment_decisions d
       set final_text = null,
           content_deleted_at = coalesce(d.content_deleted_at, now())
      from public.ai_runs r
      join public.office_settings s on s.office_id = r.office_id
     where r.id = d.run_id
       and r.office_id = d.office_id
       and d.final_text is not null
       and r.requested_at::date < (p_today - make_interval(months => s.notes_retention_months))::date
    returning 1
  )
  select count(*)::integer into v_decisions from cleared;

  return query select v_notes, v_runs, v_decisions;
end;
$$;

-- How many notes and finished AI runs the next purge would remove if the period were p_months. For the
-- admin warning when the period is shortened. Security definer: an admin does not read notes, but may
-- know how many there are. The office comes from the JWT.
create function public.notes_retention_preview(p_months integer)
returns table (notes integer, ai_runs integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_office uuid := access.current_office_id();
  boundary date;
begin
  if current_office is null
     or not coalesce(access.current_office_role() in ('admin', 'hr'), false) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if p_months is null or p_months not between 1 and 120 then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  boundary := (current_date - make_interval(months => p_months))::date;

  return query
  select (select count(*)::integer from public.notes n
           where n.office_id = current_office and n.created_at::date < boundary),
         (select count(*)::integer from public.ai_runs r
           where r.office_id = current_office
             and r.content_deleted_at is null
             and r.status in ('done', 'failed')
             and r.requested_at::date < boundary);
end;
$$;

-- Step two: anonymization of one employee after the retention period. Everything in one transaction.
--   not_due        the employee has no retention row or the period lasts until p_today or later
--   facts_mismatch p_facts does not cover the counted evaluations of the employee (a statistics fact for
--                  every evaluation with a locked current sheet and status drafted, delivered, closed or
--                  objection) or names an evaluation that is not theirs
-- p_facts is an array of RetainedEvaluationFacts of @sarmata/domain (camelCase keys), computed in
-- TypeScript because the level of an evaluation is a rule of the regulation document, not of SQL.
-- Removes: evaluations with their sheets, deadlines, results, notifications and AI runs, the event log
-- (through the transaction marker, see 20261122220200_lifecycle_marker.sql), the grade grants (kept as
-- retained_grade_grants), all notes and the content of the remaining AI runs of the employee, the personal
-- fields of the record and the Auth account. Keeps: the id, the supervisor tree, the end date, the
-- retention row, the year of the start of employment, the archived evaluations and the retained facts. A second call changes nothing.
create function public.anonymize_employee(p_employee_id uuid, p_today date, p_facts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee record;
  due_until date;
begin
  select e.office_id, e.user_id, e.anonymized_at into employee
    from public.employees e
   where e.id = p_employee_id
     for update;
  if not found then
    raise exception 'not_due' using errcode = 'P0001';
  end if;
  if employee.anonymized_at is not null then
    return;
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
    objection, labour_court_appeal_year, evaluator_account_id
  )
  select f."evaluationId", employee.office_id, f."sheetId", f.year, f."orgUnit", f."civilServant",
         f."levelCode", f.outcome, f.mean, f."secondConsecutiveNegative", f."gradeByLawDueYear",
         f."withConclusions", f."gradeRequested", f.ratings, f.objection, f."labourCourtAppealYear",
         f."evaluatorAccountId"
    from jsonb_to_recordset(coalesce(p_facts, '[]'::jsonb)) as f(
      "evaluationId" uuid, "sheetId" text, year integer, "orgUnit" text, "civilServant" boolean,
      "levelCode" text, outcome text, mean numeric, "secondConsecutiveNegative" boolean,
      "gradeByLawDueYear" integer, "withConclusions" boolean, "gradeRequested" boolean, ratings jsonb,
      objection text, "labourCourtAppealYear" integer, "evaluatorAccountId" uuid
    )
  on conflict (evaluation_id) do nothing;

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

revoke execute on function public.purge_expired_content(date) from public, anon, authenticated;
revoke execute on function public.anonymize_employee(uuid, date, jsonb) from public, anon, authenticated;
revoke execute on function public.notes_retention_preview(integer) from public, anon;
grant execute on function public.purge_expired_content(date) to service_role;
grant execute on function public.anonymize_employee(uuid, date, jsonb) to service_role;
grant execute on function public.notes_retention_preview(integer) to authenticated;
