-- Progress of a running AI run (ADR 0008): the worker streams the model answer and writes what it
-- has so far at most about once per second, the frontend polls services.ai.get (or listens to the
-- row). New nullable columns only, access rules (access.can) do not change: the table grant for
-- select covers them, and only the worker (service role) writes them.
alter table public.ai_runs
  add column partial_text text,
  add column partial_output jsonb,
  add column output_tokens integer check (output_tokens >= 0),
  add column progress_updated_at timestamptz;

comment on column public.ai_runs.partial_text is
  'Raw text of the model call in progress (JSON being written). Content: only while running, nulled when the run finishes.';
comment on column public.ai_runs.partial_output is
  'Finished part of the output while running (aiPartialOutputSchemas in @sarmata/domain). Content: nulled when the run finishes, the output column holds the result.';
comment on column public.ai_runs.output_tokens is
  'Output tokens of every model call of the run. Kept after the run as usage metadata.';
comment on column public.ai_runs.progress_updated_at is
  'Last progress write. Also the heartbeat of the worker: a running run counts as stale only when this is old too.';
