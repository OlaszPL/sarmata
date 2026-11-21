-- Starts an evaluation in one transaction: the evaluation, sheet version 1 (draft) and the `created` event.
-- Security invoker: RLS and the client rules of the evaluation tables apply to the caller as usual.
create function public.start_evaluation(
  p_employee_id uuid,
  p_evaluator_account_id uuid,
  p_regulation_version_id uuid,
  p_sheet_id text,
  p_cycle_start date,
  p_after_negative boolean,
  p_previous_evaluation_id uuid,
  p_previous_acquainted_on date,
  p_snapshot jsonb,
  p_content jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  evaluation_id uuid;
  evaluation_office_id uuid := access.current_office_id();
begin
  insert into public.evaluations (
    office_id, employee_id, evaluator_account_id, regulation_version_id, sheet_id, cycle_start,
    after_negative, previous_evaluation_id, snapshot
  )
  values (
    evaluation_office_id, p_employee_id, p_evaluator_account_id, p_regulation_version_id, p_sheet_id,
    p_cycle_start, p_after_negative, p_previous_evaluation_id, p_snapshot
  )
  returning id into evaluation_id;

  insert into public.evaluation_sheets (office_id, evaluation_id, version, content, state)
  values (evaluation_office_id, evaluation_id, 1, p_content, 'draft');

  insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload)
  values (
    evaluation_office_id, evaluation_id, 'created', p_cycle_start,
    jsonb_build_object('previousAcquaintedOn', p_previous_acquainted_on)
  );

  return evaluation_id;
end;
$$;

revoke execute on function public.start_evaluation(
  uuid, uuid, uuid, text, date, boolean, uuid, date, jsonb, jsonb
) from public;
grant execute on function public.start_evaluation(
  uuid, uuid, uuid, text, date, boolean, uuid, date, jsonb, jsonb
) to authenticated;
