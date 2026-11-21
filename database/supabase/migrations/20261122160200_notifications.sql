-- Notifications (powiadomienia): the inbox of reminders and tasks of one account, the daily collector
-- that fills it, the log of digest e-mails and the helpers the worker needs to send them.
-- Domain terms: GLOSSARY.md. Rules: docs/funkcjonalnosci.md (Powiadomienia i e-maile).

create type public.notification_kind as enum (
  'deadline_reminder', 'deadline_overdue', 'objection_decision', 'grade_by_law'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  account_id uuid not null,
  kind public.notification_kind not null,
  evaluation_id uuid not null,
  slot text not null,
  due_on date not null,
  -- Only for reminders: the lead time (days before the deadline) this reminder stands for.
  lead_days smallint,
  -- The day the collector ran.
  created_on date not null,
  -- Tasks (everything but reminders) end as resolved when their deadline stops applying.
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_resolved_check check ((status = 'resolved') = (resolved_at is not null)),
  constraint notifications_account_fkey foreign key (account_id, office_id)
    references public.memberships (user_id, office_id) on delete cascade,
  constraint notifications_evaluation_fkey foreign key (evaluation_id, office_id)
    references public.evaluations (id, office_id) on delete cascade,
  -- Idempotency of the collector: the same fact never creates a second row.
  constraint notifications_once unique nulls not distinct (account_id, kind, evaluation_id, slot, due_on, lead_days)
);
create index notifications_inbox_idx on public.notifications (office_id, account_id, status, read_at);
comment on table public.notifications is 'Notification (powiadomienie): a reminder or task in the inbox of one account.';

create table public.notification_digests (
  account_id uuid not null,
  office_id uuid not null,
  day date not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (account_id, day),
  constraint notification_digests_account_fkey foreign key (account_id, office_id)
    references public.memberships (user_id, office_id) on delete cascade
);
comment on table public.notification_digests is 'Digest e-mail log (dziennik wysyłek): one row per account and day.';

alter table public.notifications enable row level security;
alter table public.notification_digests enable row level security;

-- Clients read their own inbox and mark rows read. No insert and no delete, and status and resolved_at
-- change only in the collector (security definer). notification_digests has no grants for clients.
revoke all on public.notifications, public.notification_digests from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "read own notifications" on public.notifications
  for select to authenticated
  using (access.can('read', 'notification', office_id, account_id));

create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (access.can('update', 'notification', office_id, account_id))
  with check (access.can('update', 'notification', office_id, account_id));

-- The daily collector. First it resolves the tasks whose deadline stopped applying, then it inserts the
-- notifications the stored deadlines call for (idempotent through notifications_once), then it logs one
-- digest per account with new entries and queues one send job for it. The deadlines are not computed
-- again here: the evaluation service stores them (evaluation_deadlines).
create function public.collect_notifications(p_today date)
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
                  when 'deadline_overdue' then e.status not in ('closed', 'interrupted')
                  when 'objection_decision' then e.status = 'objection'
                  else true
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

-- Facts for one digest e-mail. Zero rows when the account has no digest row for the day.
create function public.notification_digest_facts(p_account_id uuid, p_day date)
returns table (office_id uuid, email text, status text, unread_count integer, nearest_due_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select g.office_id,
         u.email::text,
         g.status,
         (select count(*)::integer
            from public.notifications n
           where n.account_id = g.account_id and n.status = 'open' and n.read_at is null),
         (select min(n.due_on)
            from public.notifications n
           where n.account_id = g.account_id and n.status = 'open' and n.read_at is null
             and n.due_on >= p_day)
    from public.notification_digests g
    left join auth.users u on u.id = g.account_id
   where g.account_id = p_account_id
     and g.day = p_day
$$;

create function public.record_digest_result(p_account_id uuid, p_day date, p_status text, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_digests g
     set status = p_status,
         attempts = g.attempts + 1,
         last_error = p_error,
         sent_at = case when p_status = 'sent' then now() else g.sent_at end
   where g.account_id = p_account_id
     and g.day = p_day
$$;

-- SMTP settings of an office with the password from Vault. A row only when host, port and sender are set.
create function public.office_smtp_settings(p_office_id uuid)
returns table (host text, port integer, username text, sender text, sender_name text, password text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_from, o.name, ds.decrypted_secret::text
    from public.office_settings s
    join public.offices o on o.id = s.office_id
    left join vault.decrypted_secrets ds on ds.id = s.smtp_password_secret_id
   where s.office_id = p_office_id
     and s.smtp_host is not null
     and s.smtp_port is not null
     and s.smtp_from is not null
$$;

revoke execute on function public.collect_notifications(date) from public, anon, authenticated;
revoke execute on function public.notification_digest_facts(uuid, date) from public, anon, authenticated;
revoke execute on function public.record_digest_result(uuid, date, text, text) from public, anon, authenticated;
revoke execute on function public.office_smtp_settings(uuid) from public, anon, authenticated;
grant execute on function public.collect_notifications(date) to service_role;
grant execute on function public.notification_digest_facts(uuid, date) to service_role;
grant execute on function public.record_digest_result(uuid, date, text, text) to service_role;
grant execute on function public.office_smtp_settings(uuid) to service_role;
