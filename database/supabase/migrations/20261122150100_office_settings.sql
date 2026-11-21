-- Office settings (ustawienia urzędu): one row per office, created with the office. Read by every member,
-- changed by the office admin only (access.can). The SMTP password never lives here: only the id of its
-- Vault secret, which no client may read. Rules: docs/funkcjonalnosci.md.
create table public.office_settings (
  office_id uuid primary key references public.offices (id) on delete cascade,
  ai_enabled boolean not null default true,
  notes_retention_months smallint not null default 36
    check (notes_retention_months between 1 and 120),
  reminder_lead_days smallint[] not null default '{14,3}'
    check (
      cardinality(reminder_lead_days) between 1 and 5
      and 0 < all (reminder_lead_days)
      and 90 >= all (reminder_lead_days)
    ),
  smtp_host text,
  smtp_port integer check (smtp_port between 1 and 65535),
  smtp_user text,
  smtp_from text,
  smtp_password_secret_id uuid,
  smtp_password_set boolean generated always as (smtp_password_secret_id is not null) stored
);
comment on table public.office_settings is 'Office settings (ustawienia urzędu): AI switch, notes retention, reminder lead days, SMTP.';
comment on column public.office_settings.smtp_password_secret_id is 'Id of the Vault secret with the SMTP password. Not readable by clients.';

create function public.create_office_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.office_settings (office_id) values (new.id);
  return new;
end;
$$;

create trigger offices_create_settings
  after insert on public.offices
  for each row execute function public.create_office_settings();

insert into public.office_settings (office_id)
select o.id from public.offices o
on conflict do nothing;

alter table public.office_settings enable row level security;
revoke all on public.office_settings from anon, authenticated;
grant select (office_id, ai_enabled, notes_retention_months, reminder_lead_days, smtp_host, smtp_port,
              smtp_user, smtp_from, smtp_password_set)
  on public.office_settings to authenticated;
grant update (ai_enabled, notes_retention_months, reminder_lead_days, smtp_host, smtp_port, smtp_user, smtp_from)
  on public.office_settings to authenticated;
grant update (evaluation_visibility) on public.offices to authenticated;

create policy "read office settings" on public.office_settings
  for select to authenticated
  using (access.can('read', 'office_settings', office_id, office_id));

create policy "update office settings" on public.office_settings
  for update to authenticated
  using (access.can('update', 'office_settings', office_id, office_id))
  with check (access.can('update', 'office_settings', office_id, office_id));

create policy "update office" on public.offices
  for update to authenticated
  using (access.can('update', 'office', id, id))
  with check (access.can('update', 'office', id, id));

-- The only way to set the SMTP password: admin only, stored in Supabase Vault. The client never gets the
-- secret id. The worker that sends mail reads the secret with the service client (B4).
create function public.set_smtp_password(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_office uuid := access.current_office_id();
  secret_id uuid;
begin
  if current_office is null or access.current_office_role() is distinct from 'admin' then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if p_password is null or length(p_password) = 0 then
    raise exception 'empty password' using errcode = '22023';
  end if;

  select s.smtp_password_secret_id into secret_id
    from public.office_settings s
   where s.office_id = current_office
     for update;

  if secret_id is null then
    secret_id := vault.create_secret(p_password, 'smtp_password_' || current_office);
    update public.office_settings set smtp_password_secret_id = secret_id where office_id = current_office;
  else
    perform vault.update_secret(secret_id, p_password);
  end if;
end;
$$;

revoke execute on function public.set_smtp_password(text) from public;
grant execute on function public.set_smtp_password(text) to authenticated;
