-- Regulation versions (wersje przepisów, ADR 0006). Official versions come from @sarmata/regulations
-- through regulations.syncOfficial() and are global reference data with office_id null (ADR 0001 exception).
-- Local versions are office clones edited by the office admin.
create table public.regulation_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  office_id uuid references public.offices (id) on delete cascade,
  is_official boolean not null,
  based_on uuid references public.regulation_versions (id),
  effective_from date not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  constraint regulation_versions_official_is_global check (is_official = (office_id is null)),
  constraint regulation_versions_document_code check (document ->> 'id' = code),
  constraint regulation_versions_document_effective_from
    check (document ->> 'effectiveFrom' = to_char(effective_from, 'YYYY-MM-DD')),
  constraint regulation_versions_code_unique unique nulls not distinct (office_id, code)
);
create index regulation_versions_office_id_idx on public.regulation_versions (office_id);
comment on table public.regulation_versions is
  'Regulation version (wersja przepisów): rules document validated by the zod schema in @sarmata/domain.';

-- Official versions are immutable for everyone, including service_role and postgres:
-- a change of the law is a new version, never an edit (ADR 0006).
create function public.prevent_official_regulation_version_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_official then
    raise exception 'official regulation version % is immutable', old.code;
  end if;
  if tg_op = 'UPDATE' and new.is_official then
    raise exception 'local regulation version % cannot become official', old.code;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger regulation_versions_official_immutable
  before update or delete on public.regulation_versions
  for each row execute function public.prevent_official_regulation_version_change();

-- Role of the signed-in account in its office (claim set by the JWT hook). Like current_office_id():
-- no SET search_path, so it stays inlinable.
create function access.current_office_role()
returns public.office_role
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'office_role', '')::public.office_role
$$;

-- Single access decision point, extended for regulation versions. Still one expression over the arguments
-- and JWT claims, without table lookups, so the planner inlines it into policies (plan 2 rule).
create or replace function access.can(action access.action, resource access.resource, office_id uuid, resource_id uuid)
returns boolean
language sql
stable
as $$
  select case
    -- Official versions (office_id null): global reference data, read by every account that belongs to an office.
    when resource = 'regulation_version' and office_id is null then
      action = 'read' and access.current_office_id() is not null
    -- Local versions: the office reads them, only the office admin changes them (docs/funkcjonalnosci.md, rule editor).
    when resource = 'regulation_version' and action <> 'read' then
      office_id = access.current_office_id() and access.current_office_role() = 'admin'
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;

revoke execute on function access.current_office_role() from public;
grant execute on function access.current_office_role() to authenticated;

alter table public.regulation_versions enable row level security;
-- Later migrations start without Data API grants (plan 2), so this is the complete surface.
grant select, insert, update, delete on public.regulation_versions to authenticated;

create policy "read regulation versions" on public.regulation_versions
  for select to authenticated
  using (access.can('read', 'regulation_version', office_id, id));

create policy "create regulation versions" on public.regulation_versions
  for insert to authenticated
  with check (access.can('create', 'regulation_version', office_id, id));

create policy "update regulation versions" on public.regulation_versions
  for update to authenticated
  using (access.can('update', 'regulation_version', office_id, id))
  with check (access.can('update', 'regulation_version', office_id, id));

create policy "delete regulation versions" on public.regulation_versions
  for delete to authenticated
  using (access.can('delete', 'regulation_version', office_id, id));
