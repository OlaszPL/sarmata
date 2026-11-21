-- AI runs (przebiegi AI): one table is both the AI usage log and the state of the job. The ai service
-- (user JWT) builds the input snapshot through RLS and inserts a queued run, the trigger sends ai.run to
-- pgmq, the worker (service role) claims the run and writes the result. ADR 0008. Rules:
-- docs/funkcjonalnosci.md, sections AI przy treści oceny, Usługi AI, Moduł HR partnera.
--
-- Access goes through access.can('...', 'ai_run', office_id, resource_id). For ai_runs resource_id is the
-- run id, for ai_fragment_decisions it is run_id: a rule about a decision is a rule about its run.
create type public.ai_run_kind as enum (
  'sheet_draft', 'quality_check', 'sensitive_data', 'conversation_prep', 'criteria_proposals',
  'appreciation_moments', 'hr_signals', 'procedure_question'
);
create type public.ai_run_status as enum ('queued', 'running', 'done', 'failed');

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default access.current_office_id() references public.offices (id) on delete cascade,
  kind public.ai_run_kind not null,
  requested_by uuid not null default auth.uid(),
  employee_id uuid,
  evaluation_id uuid references public.evaluations (id) on delete cascade,
  -- Content columns: nulled by the retention job together with the notes (B9).
  input jsonb,
  input_refs jsonb not null default '{}',
  status public.ai_run_status not null default 'queued',
  output jsonb,
  prompt_version text,
  failure_reason text,
  failure_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  content_deleted_at timestamptz,
  constraint ai_runs_id_office_id_key unique (id, office_id),
  constraint ai_runs_employee_fkey foreign key (employee_id, office_id)
    references public.employees (id, office_id) on delete cascade,
  -- A done run has its output unless retention removed it. Other runs have none.
  constraint ai_runs_output_check check (
    (status = 'done' and (output is not null or content_deleted_at is not null))
    or (status <> 'done' and output is null)
  ),
  constraint ai_runs_input_check check (input is not null or content_deleted_at is not null)
);
create index ai_runs_office_id_employee_id_kind_idx
  on public.ai_runs (office_id, employee_id, kind, requested_at desc);
create index ai_runs_office_id_requested_by_idx
  on public.ai_runs (office_id, requested_by, requested_at desc);
comment on table public.ai_runs is
  'AI run (przebieg AI): AI usage log entry and job state. Retention (B9) nulls the content (input, output, '
  'failure_message) together with the notes and sets content_deleted_at. The metadata stays: kind, '
  'requested_by, requested_at, employee_id, evaluation_id, status, prompt_version, failure_reason, input_refs.';
comment on column public.ai_runs.input_refs is 'Ids and versions of the inputs (notes, sheet, regulation), never content.';

create trigger ai_runs_stamp_requester
  before insert on public.ai_runs
  for each row execute function public.stamp_author('requested_by', 'requested_at');

-- A queued run goes to the worker. A run inserted with a result (seed) sends nothing.
create function public.ai_runs_enqueue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'queued' then
    perform pgmq.send(
      'jobs',
      jsonb_build_object('type', 'ai.run', 'payload', jsonb_build_object('runId', new.id))
    );
  end if;
  return null;
end;
$$;

create trigger ai_runs_enqueue
  after insert on public.ai_runs
  for each row execute function public.ai_runs_enqueue();

-- Decision of a user about one fragment of a run output (accepted, edited, rejected). Appended only, the
-- latest decision about a fragment wins.
create table public.ai_fragment_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  office_id uuid not null default access.current_office_id(),
  fragment text not null check (fragment ~ '^[a-zA-Z][a-zA-Z0-9_.-]*$'),
  decision text not null check (decision in ('accepted', 'edited', 'rejected')),
  -- Content: nulled by the retention job (B9).
  final_text text,
  content_deleted_at timestamptz,
  decided_by uuid not null default auth.uid(),
  decided_at timestamptz not null default now(),
  constraint ai_fragment_decisions_run_fkey foreign key (run_id, office_id)
    references public.ai_runs (id, office_id) on delete cascade,
  constraint ai_fragment_decisions_text_check check (
    (decision = 'edited' and (final_text is not null or content_deleted_at is not null))
    or (decision <> 'edited' and final_text is null)
  )
);
create index ai_fragment_decisions_run_id_idx on public.ai_fragment_decisions (run_id, decided_at);
comment on table public.ai_fragment_decisions is 'Decision about an AI fragment (decyzja o fragmencie AI). The latest per fragment wins.';

create trigger ai_fragment_decisions_stamp_author
  before insert on public.ai_fragment_decisions
  for each row execute function public.stamp_author('decided_by', 'decided_at');

-- Who reads private data about an employee (notes, AI results about the employee): hr, the evaluator of
-- an open evaluation of the employee and, in tree mode, the supervisors up the tree. One definition of
-- the audience for notes and AI results.
create function access.reads_employee_private_data(employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(access.current_office_role() = 'hr', false)
    or exists (
      select 1 from public.evaluations e
       where e.employee_id = reads_employee_private_data.employee_id
         and e.office_id = access.current_office_id()
         and e.evaluator_account_id = auth.uid()
         and e.status not in ('closed', 'interrupted')
    )
    or (
      exists (
        select 1 from public.offices o
         where o.id = access.current_office_id() and o.evaluation_visibility = 'tree'
      )
      and access.supervises_employee(reads_employee_private_data.employee_id)
    )
$$;

-- The note rule from 20261122150200_notes.sql, the read branch now asks access.reads_employee_private_data.
create or replace function access.note_rule(action access.action, resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when note_rule.action = 'delete' then false
    when note_rule.action = 'create' then
      coalesce(access.current_office_role() in ('evaluator', 'hr'), false)
    when note_rule.action = 'update' then
      exists (
        select 1 from public.notes n
         where n.id = note_rule.resource_id
           and n.office_id = access.current_office_id()
           and n.author_account_id = auth.uid()
      )
    when note_rule.action = 'read' then
      coalesce(access.current_office_role() = 'hr', false)
      or exists (
        select 1 from public.notes n
         where n.id = note_rule.resource_id
           and n.office_id = access.current_office_id()
           and (n.author_account_id = auth.uid() or access.reads_employee_private_data(n.employee_id))
      )
      -- A note this command is inserting is not in the snapshot yet (INSERT ... RETURNING).
      or not exists (select 1 from public.notes n where n.id = note_rule.resource_id)
    else false
  end
$$;

-- Per role and per run rules, called from access.can after its office check.
--   delete: nobody (retention is done by pg_cron as the owner, B9).
--   create: evaluators and hr, while the office has AI switched on.
--   read: the requester, or anybody who reads private data about the employee of the run.
--   update (a fragment decision, resource_id is run_id): a reader with the evaluator or hr role, on a done run.
create function access.ai_run_rule(action access.action, resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when ai_run_rule.action = 'delete' then false
    when ai_run_rule.action = 'create' then
      coalesce(access.current_office_role() in ('evaluator', 'hr'), false)
      and coalesce(
        (select s.ai_enabled from public.office_settings s where s.office_id = access.current_office_id()),
        false
      )
    when ai_run_rule.action = 'read' then
      exists (
        select 1 from public.ai_runs r
         where r.id = ai_run_rule.resource_id
           and r.office_id = access.current_office_id()
           and (r.requested_by = auth.uid()
                or (r.employee_id is not null and access.reads_employee_private_data(r.employee_id)))
      )
      -- A run this command is inserting is not in the snapshot yet (INSERT ... RETURNING).
      or not exists (select 1 from public.ai_runs r where r.id = ai_run_rule.resource_id)
    when ai_run_rule.action = 'update' then
      coalesce(access.current_office_role() in ('evaluator', 'hr'), false)
      and exists (
        select 1 from public.ai_runs r
         where r.id = ai_run_rule.resource_id
           and r.office_id = access.current_office_id()
           and r.status = 'done'
           and (r.requested_by = auth.uid()
                or (r.employee_id is not null and access.reads_employee_private_data(r.employee_id)))
      )
    else false
  end
$$;

revoke execute on function access.reads_employee_private_data(uuid) from public;
revoke execute on function access.ai_run_rule(access.action, uuid) from public;
grant execute on function access.reads_employee_private_data(uuid) to authenticated;
grant execute on function access.ai_run_rule(access.action, uuid) to authenticated;

alter table public.ai_runs enable row level security;
alter table public.ai_fragment_decisions enable row level security;
revoke all on public.ai_runs, public.ai_fragment_decisions from anon, authenticated;
-- The result columns (status, output, prompt_version, failure_*, times) are written by the worker only.
grant select on public.ai_runs, public.ai_fragment_decisions to authenticated;
grant insert (kind, employee_id, evaluation_id, input, input_refs) on public.ai_runs to authenticated;
grant insert (run_id, fragment, decision, final_text) on public.ai_fragment_decisions to authenticated;

create policy "read ai runs" on public.ai_runs
  for select to authenticated
  using (access.can('read', 'ai_run', office_id, id));

create policy "create ai runs" on public.ai_runs
  for insert to authenticated
  with check (access.can('create', 'ai_run', office_id, id));

create policy "read ai fragment decisions" on public.ai_fragment_decisions
  for select to authenticated
  using (access.can('read', 'ai_run', office_id, run_id));

create policy "create ai fragment decisions" on public.ai_fragment_decisions
  for insert to authenticated
  with check (access.can('update', 'ai_run', office_id, run_id));
