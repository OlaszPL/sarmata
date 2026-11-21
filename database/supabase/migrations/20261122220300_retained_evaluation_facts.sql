-- What the statistics keep after an employee is anonymized (fakty zachowane): the facts of every counted
-- evaluation and of every grade grant, without a person. Written only by anonymize_employee. The reports
-- of 20261122220600_statistics_with_retained_facts.sql add them to the live facts.

create table public.retained_evaluation_facts (
  -- No foreign key: the evaluation is deleted when its employee is anonymized.
  evaluation_id uuid primary key,
  office_id uuid not null references public.offices (id) on delete cascade,
  sheet_id text not null check (sheet_id ~ '^[A-Z]$'),
  -- Year of the sheet approval.
  year smallint not null,
  org_unit text,
  civil_servant boolean not null,
  level_code text,
  outcome text check (outcome in ('positive', 'negative')),
  mean numeric,
  second_consecutive_negative boolean not null,
  grade_by_law_due_year smallint,
  with_conclusions boolean not null,
  grade_requested boolean not null,
  -- [{ criterionId, points }], the partial ratings, no text.
  ratings jsonb not null,
  objection text not null check (objection in ('none', 'pending', 'rejected', 'changed', 'redraft')),
  labour_court_appeal_year smallint,
  evaluator_account_id uuid not null,
  retained_at timestamptz not null default now()
);
create index retained_evaluation_facts_office_id_year_idx on public.retained_evaluation_facts (office_id, year);
comment on table public.retained_evaluation_facts is
  'Retained facts (fakty zachowane): data of an evaluation without a person, the source of statistics after the sheets are deleted.';

-- Grade grants of an anonymized employee: only what the DSC-OCK questions 16 and 17 count.
create table public.retained_grade_grants (
  id uuid primary key,
  office_id uuid not null references public.offices (id) on delete cascade,
  basis text not null check (basis in ('on_request', 'by_law')),
  granted_year smallint not null,
  new_grade smallint not null check (new_grade between 1 and 9),
  retained_at timestamptz not null default now()
);
create index retained_grade_grants_office_id_idx on public.retained_grade_grants (office_id, granted_year);
comment on table public.retained_grade_grants is
  'Grade grants (przyznania stopnia) of anonymized employees: counts for the DSC-OCK report, without a person.';

alter table public.retained_evaluation_facts enable row level security;
alter table public.retained_grade_grants enable row level security;
revoke all on public.retained_evaluation_facts, public.retained_grade_grants from anon, authenticated;
grant select on public.retained_evaluation_facts, public.retained_grade_grants to authenticated;

-- hr and admin read them, like the reports. No write grants: only the system function writes.
create policy "hr and admin read retained facts" on public.retained_evaluation_facts
  for select to authenticated
  using (
    access.can('read', 'employee', office_id, evaluation_id)
    and access.current_office_role() in ('hr', 'admin')
  );
create policy "hr and admin read retained grade grants" on public.retained_grade_grants
  for select to authenticated
  using (
    access.can('read', 'employee', office_id, id)
    and access.current_office_role() in ('hr', 'admin')
  );
