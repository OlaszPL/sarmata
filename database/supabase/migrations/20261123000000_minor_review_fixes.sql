-- Fix wave for deferred Minor review findings.
-- 1. Automatic closing behaves like a manual close: the objection deadline is cleared (a closed evaluation
--    shows no open objection window) and the closed event carries the sheet version and hash that
--    apply_evaluation_transition adds to every transition event.
-- 2. The closing job runs at 4:50 UTC, before the notification collection at 5:00, so the overdue tasks of
--    an evaluation closed that morning are resolved on the same day.

create or replace function public.close_unobjected_evaluations(p_today date)
returns table (evaluation_id uuid, office_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  due record;
  sheet record;
  event_payload jsonb;
begin
  if not exists (
    select 1
      from public.evaluation_transitions() t
     where t.from_status = 'delivered' and t.to_status = 'closed' and t.event_kind = 'closed'
  ) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  for due in
    select e.id as eval_id, e.office_id as eval_office_id
      from public.evaluations e
      join public.evaluation_deadlines d on d.evaluation_id = e.id and d.office_id = e.office_id
     where e.status = 'delivered'
       and d.slot = 'objection'
       and d.due_on < p_today
       and d.suspended_since is null
     order by e.id
  loop
    -- Compare and set: an evaluation that changed in the meantime (an objection) is skipped.
    update public.evaluations ev
       set status = 'closed'
     where ev.id = due.eval_id
       and ev.status = 'delivered';
    if found then
      event_payload := '{"automatic": true}'::jsonb;
      select s.version, s.content into sheet
        from public.evaluation_sheets s
       where s.evaluation_id = due.eval_id
         and s.state in ('draft', 'locked')
       order by s.version desc
       limit 1;
      if found then
        event_payload := event_payload || jsonb_build_object(
          'sheetVersion', sheet.version,
          'sheetSha256', encode(extensions.digest(sheet.content::text, 'sha256'), 'hex')
        );
      end if;
      insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload, recorded_by)
      values (due.eval_office_id, due.eval_id, 'closed', p_today, event_payload,
              '00000000-0000-0000-0000-000000000000');
      update public.evaluation_deadlines d
         set due_on = null, window_start = null
       where d.evaluation_id = due.eval_id
         and d.slot = 'objection';
      evaluation_id := due.eval_id;
      office_id := due.eval_office_id;
      return next;
    end if;
  end loop;
end;
$$;

revoke execute on function public.close_unobjected_evaluations(date) from public, anon, authenticated;
grant execute on function public.close_unobjected_evaluations(date) to service_role;

select cron.unschedule('close-unobjected-daily');
select cron.schedule(
  'close-unobjected-daily',
  '50 4 * * *',
  $$select public.job_queue_send(jsonb_build_object(
      'type', 'evaluations.close_unobjected',
      'payload', jsonb_build_object('day', (now() at time zone 'Europe/Warsaw')::date::text)))$$
);

-- 3. An office admin does not run evaluations (spec), so the admin account cannot be the evaluator.
create or replace function public.evaluations_validate_evaluator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.memberships m
     where m.user_id = new.evaluator_account_id
       and m.office_id = new.office_id
       and m.role <> 'admin'
       and (m.ended_on is null or m.ended_on > current_date)
  ) then
    raise exception 'evaluator must be an active member of the office of the evaluation'
      using errcode = '23503';
  end if;
  return new;
end;
$$;
