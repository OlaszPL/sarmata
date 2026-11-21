-- Automatic closing of delivered evaluations whose objection window is over (zamknięcie automatyczne).
-- An evaluation in 'delivered' with an unsuspended 'objection' deadline before p_today goes to 'closed'
-- with a 'closed' event whose payload is {"automatic": true}.
--
-- The function does the transition itself and does not call apply_evaluation_transition, for three reasons:
-- that function decides through access.can from the JWT of an account and the system has no account,
-- it needs no sheet lock for this transition, and it stays one transaction per evaluation here.
-- It still checks the transition against public.evaluation_transitions(), the source apply_evaluation_transition
-- reads. The author of the event is the system account 00000000-0000-0000-0000-000000000000:
-- stamp_author keeps a supplied author when there is no JWT, and recorded_by has no foreign key.
create function public.close_unobjected_evaluations(p_today date)
returns table (evaluation_id uuid, office_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  due record;
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
      insert into public.evaluation_events (office_id, evaluation_id, kind, occurred_on, payload, recorded_by)
      values (due.eval_office_id, due.eval_id, 'closed', p_today, '{"automatic": true}'::jsonb,
              '00000000-0000-0000-0000-000000000000');
      evaluation_id := due.eval_id;
      office_id := due.eval_office_id;
      return next;
    end if;
  end loop;
end;
$$;

revoke execute on function public.close_unobjected_evaluations(date) from public, anon, authenticated;
grant execute on function public.close_unobjected_evaluations(date) to service_role;
