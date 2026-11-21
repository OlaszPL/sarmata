-- Data lifecycle (cykl życia danych), part one: the retention register of former employees and the end of
-- their access. Rules: docs/funkcjonalnosci.md (Retencja, Usuwanie danych pracownika), domain terms: GLOSSARY.md.

alter table public.employees add column anonymized_at timestamptz;
comment on column public.employees.anonymized_at is 'Set when the record was anonymized after the retention period (anonimizacja pracownika).';

-- Retention register: one row per employee whose employment ended. retained_until is the last day the
-- records are kept (end of the calendar year of the end plus 10 years, art. 94 pkt 9b KP, computed by
-- retentionEndsOn in @sarmata/domain). Anonymization is due the day after. The row stays after anonymization.
create table public.employee_retention (
  employee_id uuid primary key,
  office_id uuid not null,
  retained_until date not null,
  archive_exported_at timestamptz,
  archive_exported_by uuid,
  created_at timestamptz not null default now(),
  constraint employee_retention_employee_fkey foreign key (employee_id, office_id)
    references public.employees (id, office_id)
);
create index employee_retention_office_id_retained_until_idx
  on public.employee_retention (office_id, retained_until);
comment on table public.employee_retention is
  'Retention register (rejestr retencji): when the records of a former employee may be anonymized, and whether hr downloaded the archive.';

-- SQL only guards the rule that @sarmata/domain computes (retentionEndsOn): the stored date is never earlier
-- than 31 December of the end year plus ten.
create function public.employee_retention_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended_on date;
begin
  select e.employment_ended_on into ended_on
    from public.employees e
   where e.id = new.employee_id;
  if ended_on is null
     or new.retained_until < make_date(extract(year from ended_on)::integer + 10, 12, 31) then
    raise exception 'retention period is shorter than ten years from the end of the year of the employment end'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger employee_retention_guard
  before insert or update of retained_until on public.employee_retention
  for each row execute function public.employee_retention_guard();

alter table public.employee_retention enable row level security;
revoke all on public.employee_retention from anon, authenticated;
grant select on public.employee_retention to authenticated;

-- hr only: the role check sits in the policy, access.can only knows the office.
create policy "hr reads employee retention" on public.employee_retention
  for select to authenticated
  using (
    access.can('read', 'employee', office_id, employee_id)
    and access.current_office_role() = 'hr'
  );

revoke execute on function public.employee_retention_guard() from public, anon, authenticated;
