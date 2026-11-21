-- Fix wave for notifications (B4 review, Important 1 and 2).
-- 1. The grade by law task ends once a grade is recorded in grade_grants for the employee: by law on this
--    evaluation, or any grant dated on or after its acquaintance (a grant on request settles it too).
--    The evaluation service now stores the gradeByLawGrant slot only on the evaluation whose acquaintance
--    completed the qualifying run, so hr gets one task per legal fact.
-- 2. An overdue task ends when its recipient is no longer the evaluator nor an hr account.

create function public.grade_granted_since_evaluation(p_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.evaluations e
      join public.grade_grants g on g.employee_id = e.employee_id and g.office_id = e.office_id
     where e.id = p_evaluation_id
       and (
         (g.basis = 'by_law' and g.evaluation_id = e.id)
         or g.granted_on >= (
           select max(ev.occurred_on)
             from public.evaluation_events ev
            where ev.evaluation_id = e.id
              and ev.kind in ('acquainted', 'signature_refused'))
       )
  )
$$;

revoke execute on function public.grade_granted_since_evaluation(uuid) from public, anon, authenticated;

create or replace function public.collect_notifications(p_today date)
returns table (created integer, queued integer, resolved integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer;
  v_queued integer;
  v_resolved integer;
begin
  -- A task is live while a deadline of its slot with the same due_on exists, is not suspended and the
  -- evaluation has a status that kind applies to. Reminders have no task status and stay as they are.
  with ended as (
    update public.notifications n
       set status = 'resolved',
           resolved_at = now(),
           read_at = coalesce(n.read_at, now())
     where n.status = 'open'
       and n.kind in ('deadline_overdue', 'objection_decision', 'grade_by_law')
       and not exists (
         select 1
           from public.evaluation_deadlines d
           join public.evaluations e on e.id = d.evaluation_id and e.office_id = d.office_id
          where d.evaluation_id = n.evaluation_id
            and d.slot = n.slot
            and d.due_on = n.due_on
            and d.suspended_since is null
            and case n.kind
                  -- The recipient must still be the evaluator or an hr account: after a change of
                  -- evaluator the former evaluator's task ends.
                  when 'deadline_overdue' then e.status not in ('closed', 'interrupted')
                    and (n.account_id = e.evaluator_account_id
                         or exists (select 1
                                      from public.memberships m
                                     where m.user_id = n.account_id
                                       and m.office_id = n.office_id
                                       and m.role = 'hr'))
                  when 'objection_decision' then e.status = 'objection'
                  else not public.grade_granted_since_evaluation(e.id)
                end)
    returning 1
  )
  select count(*)::integer into v_resolved from ended;

  with
  -- Slots the evaluator is responsible for. Other slots (objection, appeal, grade by law) are hr tasks.
  evaluator_slots (slot) as (
    values ('startingInterview'), ('startingInterviewAfterNegative'), ('evaluationDeadline'),
           ('reevaluationAfterNegative'), ('evaluationOnPositionChange'),
           ('criteriaResetAfterPositionChange')
  ),
  -- Stored deadlines that are set and not suspended.
  live as (
    select d.office_id, d.evaluation_id, d.slot, d.due_on, e.status, e.evaluator_account_id
      from public.evaluation_deadlines d
      join public.evaluations e on e.id = d.evaluation_id and e.office_id = d.office_id
     where d.due_on is not null
       and d.suspended_since is null
  ),
  candidates as (
    -- Reminder: the nearest configured lead that still covers the remaining days (a skipped day
    -- sends one reminder, not all missed ones).
    select l.office_id, l.evaluator_account_id as account_id,
           'deadline_reminder'::public.notification_kind as kind,
           l.evaluation_id, l.slot, l.due_on, lead.days as lead_days
      from live l
      join evaluator_slots es on es.slot = l.slot
      join public.office_settings s on s.office_id = l.office_id
      cross join lateral (
        select min(x)::smallint as days
          from unnest(s.reminder_lead_days) as x
         where x >= l.due_on - p_today
      ) lead
     where l.status not in ('closed', 'interrupted')
       and l.due_on >= p_today
       and lead.days is not null
    union
    -- Overdue: the evaluator and every hr account of the office (union keeps one row per account).
    select l.office_id, l.evaluator_account_id, 'deadline_overdue', l.evaluation_id, l.slot, l.due_on, null::smallint
      from live l
      join evaluator_slots es on es.slot = l.slot
     where l.status not in ('closed', 'interrupted')
       and l.due_on < p_today
    union
    select l.office_id, m.user_id, 'deadline_overdue', l.evaluation_id, l.slot, l.due_on, null::smallint
      from live l
      join evaluator_slots es on es.slot = l.slot
      join public.memberships m on m.office_id = l.office_id and m.role = 'hr'
     where l.status not in ('closed', 'interrupted')
       and l.due_on < p_today
    union
    select l.office_id, m.user_id, 'objection_decision', l.evaluation_id, l.slot, l.due_on, null::smallint
      from live l
      join public.memberships m on m.office_id = l.office_id and m.role = 'hr'
     where l.slot = 'objectionDecision'
       and l.status = 'objection'
    union
    select l.office_id, m.user_id, 'grade_by_law', l.evaluation_id, l.slot, l.due_on, null::smallint
      from live l
      join public.memberships m on m.office_id = l.office_id and m.role = 'hr'
     where l.slot = 'gradeByLawGrant'
       and not public.grade_granted_since_evaluation(l.evaluation_id)
  ),
  inserted as (
    insert into public.notifications (office_id, account_id, kind, evaluation_id, slot, due_on, lead_days, created_on)
    select c.office_id, c.account_id, c.kind, c.evaluation_id, c.slot, c.due_on, c.lead_days, p_today
      from candidates c
    on conflict on constraint notifications_once do nothing
    returning 1
  )
  select count(*)::integer into v_created from inserted;

  -- Digest rows first, so a crash in the middle never queues a second job for an account and day.
  with new_digests as (
    insert into public.notification_digests (account_id, office_id, day)
    select distinct n.account_id, n.office_id, p_today
      from public.notifications n
     where n.created_on = p_today
    on conflict do nothing
    returning account_id
  )
  select count(public.job_queue_send(jsonb_build_object(
           'type', 'notifications.send_digest',
           'payload', jsonb_build_object('accountId', d.account_id, 'day', p_today))))::integer
    into v_queued
    from new_digests d;

  return query select v_created, v_queued, v_resolved;
end;
$$;
