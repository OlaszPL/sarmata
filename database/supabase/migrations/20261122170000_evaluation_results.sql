-- Statistics foundation (statystyki): the facts of evaluations with a locked sheet and the projection of
-- their results. Level and outcome are computed in @sarmata/domain (scoreSheet), so SQL has nothing to
-- group by. The statistics service recomputes the projection before each report and saves it here.

-- One row per evaluation whose current sheet version (the highest of draft and locked) is locked.
-- An evaluation sent back to redraft has a draft as the current version, so it drops out until approved again.
create view public.statistics_evaluation_facts
with (security_invoker = true)
as
select e.id as evaluation_id,
       e.office_id,
       e.employee_id,
       e.evaluator_account_id,
       e.regulation_version_id,
       e.sheet_id,
       s.version as sheet_version,
       s.content,
       e.snapshot ->> 'orgUnit' as org_unit,
       coalesce(e.snapshot ->> 'serviceStatus' = 'civil_servant', false) as civil_servant,
       (e.snapshot ->> 'gradeGrantedOn')::date as grade_granted_on,
       (select max(ev.occurred_on)
          from public.evaluation_events ev
         where ev.evaluation_id = e.id and ev.kind = 'sheet_approved') as drafted_on,
       (select max(ev.occurred_on)
          from public.evaluation_events ev
         where ev.evaluation_id = e.id and ev.kind in ('acquainted', 'signature_refused')) as acquainted_on
  from public.evaluations e
  join lateral (
    select cur.version, cur.content, cur.state
      from public.evaluation_sheets cur
     where cur.evaluation_id = e.id
       and cur.state in ('draft', 'locked')
     order by cur.version desc
     limit 1
  ) s on s.state = 'locked'
 where e.status in ('drafted', 'delivered', 'closed', 'objection');
comment on view public.statistics_evaluation_facts is 'Facts of evaluations with a locked current sheet, input of the statistics reports.';
grant select on public.statistics_evaluation_facts to authenticated;

create table public.evaluation_results (
  evaluation_id uuid primary key,
  office_id uuid not null,
  sheet_version integer not null,
  level_code text,
  outcome text check (outcome in ('positive', 'negative')),
  mean numeric,
  second_consecutive_negative boolean not null,
  grade_by_law_due_on date,
  computed_at timestamptz not null default now(),
  constraint evaluation_results_evaluation_fkey foreign key (evaluation_id, office_id)
    references public.evaluations (id, office_id) on delete cascade
);
create index evaluation_results_office_id_idx on public.evaluation_results (office_id);
comment on table public.evaluation_results is 'Projection of evaluation results (wynik oceny) computed in @sarmata/domain, not a source of truth.';

alter table public.evaluation_results enable row level security;
grant select on public.evaluation_results to authenticated;
create policy "read evaluation results" on public.evaluation_results
  for select to authenticated
  using (access.can('read', 'evaluation', office_id, evaluation_id));

-- Saves recomputed results. hr and admin only. Rows of evaluations outside the caller's office are skipped.
-- Input: [{ evaluation_id, sheet_version, level_code, outcome, mean, second_consecutive_negative, grade_by_law_due_on }].
-- Returns the number of saved rows.
create function public.save_evaluation_results(p_results jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved integer;
begin
  if access.current_office_id() is null
     or not coalesce(access.current_office_role() in ('hr', 'admin'), false) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  with input as (
    select r.*
      from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as r(
        evaluation_id uuid,
        sheet_version integer,
        level_code text,
        outcome text,
        mean numeric,
        second_consecutive_negative boolean,
        grade_by_law_due_on date
      )
  ),
  upserted as (
    insert into public.evaluation_results (
      evaluation_id, office_id, sheet_version, level_code, outcome, mean,
      second_consecutive_negative, grade_by_law_due_on, computed_at
    )
    select i.evaluation_id, e.office_id, i.sheet_version, i.level_code, i.outcome, i.mean,
           coalesce(i.second_consecutive_negative, false), i.grade_by_law_due_on, now()
      from input i
      join public.evaluations e
        on e.id = i.evaluation_id
       and e.office_id = access.current_office_id()
    on conflict (evaluation_id) do update
      set sheet_version = excluded.sheet_version,
          level_code = excluded.level_code,
          outcome = excluded.outcome,
          mean = excluded.mean,
          second_consecutive_negative = excluded.second_consecutive_negative,
          grade_by_law_due_on = excluded.grade_by_law_due_on,
          computed_at = excluded.computed_at
    returning 1
  )
  select count(*) into saved from upserted;
  return saved;
end;
$$;

revoke execute on function public.save_evaluation_results(jsonb) from public;
grant execute on function public.save_evaluation_results(jsonb) to authenticated;
