-- Office regulation drafts (edytor reguł). An office admin clones a version into a draft, edits it and
-- publishes it as an immutable version with an effective date. Official versions stay published.
-- RLS from 20261121130100 already gives the office read access and the admin write access, so
-- access.can() is not touched here. Evaluation start on a draft is refused by the trigger below.

-- Existing rows (official versions) are published. The default switches to draft right after, because
-- the official-immutable trigger forbids the update that would backfill them.
alter table public.regulation_versions
  add column status text not null default 'published'
    constraint regulation_versions_status_check check (status in ('draft', 'published'));
alter table public.regulation_versions alter column status set default 'draft';

alter table public.regulation_versions
  add column published_at timestamptz,
  add column created_by uuid default auth.uid();

alter table public.regulation_versions
  alter column office_id set default access.current_office_id();

alter table public.regulation_versions
  add constraint regulation_versions_official_published check (not is_official or status = 'published');

-- One published version per office and effective date: the precedence rule needs a single winner.
create unique index regulation_versions_office_published_date_idx
  on public.regulation_versions (office_id, effective_from)
  where status = 'published' and office_id is not null;

comment on column public.regulation_versions.status is
  'draft (office admin edits it) or published (immutable, can pin evaluations). Official versions are always published.';

-- Rules of local versions. Official rows pass through, the official-immutable trigger guards them.
-- The name sorts before regulation_versions_official_immutable, so it fires first.
create function public.regulation_versions_local_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not old.is_official and old.status = 'published' then
      raise exception 'published regulation version % is immutable', old.code;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.is_official then
      new.status := 'published';
      return new;
    end if;
    if new.status <> 'draft' then
      raise exception 'local regulation version % must start as a draft', new.code;
    end if;
  else
    if old.is_official then
      return new;
    end if;
    if old.status = 'published' then
      raise exception 'published regulation version % is immutable', old.code;
    end if;
  end if;

  if (tg_op = 'INSERT' or new.code <> old.code) and exists (
    select 1
      from public.regulation_versions o
     where o.is_official and o.code = new.code
  ) then
    raise exception 'code % belongs to an official regulation version', new.code;
  end if;

  if tg_op = 'UPDATE' and new.status = 'published' then
    if new.effective_from < current_date then
      raise exception 'effective date % of regulation version % is in the past', new.effective_from, new.code;
    end if;
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger regulation_versions_local_rules
  before insert or update or delete on public.regulation_versions
  for each row execute function public.regulation_versions_local_rules();

-- Same body as in 20261122110100_evaluations.sql plus: only published versions can pin an evaluation.
create or replace function public.evaluations_regulation_version_in_office()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.regulation_versions r
     where r.id = new.regulation_version_id
       and r.status = 'published'
       and (r.office_id is null or r.office_id = new.office_id)
  ) then
    raise exception 'regulation version must be official or belong to the office';
  end if;
  return new;
end;
$$;
