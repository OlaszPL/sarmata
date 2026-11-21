-- Notes about an employee (notatki): written by evaluators and hr, with an immutable entry time and kept
-- earlier versions. Rules: docs/funkcjonalnosci.md, section Notatki.
--
-- Access goes through access.can('...', 'note', office_id, resource_id). For notes resource_id is the note
-- id. For note_versions it is note_id, not the row key: a rule about a version is a rule about its note.
create type public.note_kind as enum ('observation', 'ongoing_conversation', 'appreciation', 'workload_fact');

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null default access.current_office_id() references public.offices (id) on delete cascade,
  employee_id uuid not null,
  author_account_id uuid not null default auth.uid(),
  kind public.note_kind not null,
  occurred_on date not null,
  criterion_id text check (criterion_id ~ '^[a-z][a-z0-9-]*$'),
  -- Null for a workload fact.
  sign text check (sign in ('plus', 'minus')),
  communicated boolean not null default false,
  body text not null check (length(trim(body)) between 1 and 5000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_employee_fkey foreign key (employee_id, office_id)
    references public.employees (id, office_id) on delete cascade
);
create index notes_office_id_employee_id_occurred_on_idx
  on public.notes (office_id, employee_id, occurred_on desc);
comment on table public.notes is 'Note (notatka) about an employee. created_at is the immutable entry time.';

create table public.note_versions (
  note_id uuid not null references public.notes (id) on delete cascade,
  office_id uuid not null,
  version integer not null,
  kind public.note_kind not null,
  occurred_on date not null,
  criterion_id text,
  sign text,
  communicated boolean not null,
  body text not null,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  primary key (note_id, version)
);
comment on table public.note_versions is 'Note version (wersja notatki): the content before an edit.';

create trigger notes_stamp_author
  before insert on public.notes
  for each row execute function public.stamp_author('author_account_id', 'created_at');

-- A content edit keeps the old content as a version. Security definer: clients cannot insert versions.
create function public.notes_keep_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.kind, new.occurred_on, new.criterion_id, new.sign, new.communicated, new.body)
     is distinct from (old.kind, old.occurred_on, old.criterion_id, old.sign, old.communicated, old.body) then
    insert into public.note_versions (note_id, office_id, version, kind, occurred_on, criterion_id, sign,
                                      communicated, body, valid_from, valid_to)
    values (old.id, old.office_id, old.version, old.kind, old.occurred_on, old.criterion_id, old.sign,
            old.communicated, old.body, old.updated_at, now());
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger notes_keep_history
  before update on public.notes
  for each row execute function public.notes_keep_history();

-- Per role and per note rules, called from access.can after its office check.
--   delete: nobody (retention is done by pg_cron as the owner, B9).
--   create: evaluators and hr.
--   update: the author.
--   read: the author, hr, the evaluator of an open evaluation of that employee, and in tree mode the
--         supervisors of the employee up the tree.
create function access.note_rule(action access.action, resource_id uuid)
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
           and (
             n.author_account_id = auth.uid()
             or exists (
               select 1 from public.evaluations e
                where e.employee_id = n.employee_id
                  and e.office_id = n.office_id
                  and e.evaluator_account_id = auth.uid()
                  and e.status not in ('closed', 'interrupted')
             )
             or (
               exists (
                 select 1 from public.offices o
                  where o.id = n.office_id and o.evaluation_visibility = 'tree'
               )
               and access.supervises_employee(n.employee_id)
             )
           )
      )
      -- A note this command is inserting is not in the snapshot yet (INSERT ... RETURNING).
      or not exists (select 1 from public.notes n where n.id = note_rule.resource_id)
    else false
  end
$$;

revoke execute on function access.note_rule(access.action, uuid) from public;
grant execute on function access.note_rule(access.action, uuid) to authenticated;

alter table public.notes enable row level security;
alter table public.note_versions enable row level security;
revoke all on public.notes, public.note_versions from anon, authenticated;
grant select on public.notes, public.note_versions to authenticated;
-- version and updated_at are the trigger's. The author is stamped by notes_stamp_author whatever is sent.
grant insert (id, office_id, employee_id, author_account_id, kind, occurred_on, criterion_id, sign,
              communicated, body)
  on public.notes to authenticated;
grant update (kind, occurred_on, criterion_id, sign, communicated, body) on public.notes to authenticated;

create policy "read notes" on public.notes
  for select to authenticated
  using (access.can('read', 'note', office_id, id));

create policy "create notes" on public.notes
  for insert to authenticated
  with check (access.can('create', 'note', office_id, id));

create policy "update notes" on public.notes
  for update to authenticated
  using (access.can('update', 'note', office_id, id))
  with check (access.can('update', 'note', office_id, id));

create policy "read note versions" on public.note_versions
  for select to authenticated
  using (access.can('read', 'note', office_id, note_id));
