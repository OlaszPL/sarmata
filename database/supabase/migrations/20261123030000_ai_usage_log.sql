-- AI usage log for the admin (docs/funkcjonalnosci.md, "Usługi AI"): the admin sees which AI runs the
-- office made, with what model and prompt version, and what the users decided about each fragment, but
-- never the content (input, output, progress text, failure message, final text of an edited fragment).
-- RLS on ai_runs keeps the admin out of the runs (access.ai_run_rule), so the log is a security definer
-- function that returns metadata columns only. access.can does not change.

alter table public.ai_runs add column model text;

comment on column public.ai_runs.model is
  'Model(s) available to the task when it ran, e.g. `bielik-4.5b-v3.0-instruct`. Usage metadata, kept by retention.';

-- Admin only (42501 otherwise). Runs of the own office, newest first, p_limit clamped to 1..500.
-- decisions: the latest decision per fragment as {fragment, decision, decidedBy, decidedAt}, ordered by
-- fragment, never final_text.
create function public.ai_usage_log(p_limit integer default 100)
returns table (
  id uuid,
  kind public.ai_run_kind,
  status public.ai_run_status,
  requested_by uuid,
  requester_first_name text,
  requester_last_name text,
  employee_id uuid,
  evaluation_id uuid,
  model text,
  prompt_version text,
  output_tokens integer,
  failure_reason text,
  requested_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  content_deleted_at timestamptz,
  decisions jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if access.current_office_role() is distinct from 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  return query
    select r.id, r.kind, r.status, r.requested_by, e.first_name, e.last_name, r.employee_id,
           r.evaluation_id, r.model, r.prompt_version, r.output_tokens, r.failure_reason,
           r.requested_at, r.started_at, r.finished_at, r.content_deleted_at,
           coalesce(
             (select jsonb_agg(
                       jsonb_build_object(
                         'fragment', latest.fragment,
                         'decision', latest.decision,
                         'decidedBy', latest.decided_by,
                         'decidedAt', latest.decided_at
                       )
                       order by latest.fragment
                     )
                from (select distinct on (d.fragment) d.fragment, d.decision, d.decided_by, d.decided_at
                        from public.ai_fragment_decisions d
                       where d.run_id = r.id and d.office_id = r.office_id
                       order by d.fragment, d.decided_at desc, d.id desc) latest),
             '[]'::jsonb
           )
      from public.ai_runs r
      left join public.employees e on e.user_id = r.requested_by and e.office_id = r.office_id
     where r.office_id = access.current_office_id()
     order by r.requested_at desc, r.id
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.ai_usage_log(integer) from public, anon;
grant execute on function public.ai_usage_log(integer) to authenticated;
