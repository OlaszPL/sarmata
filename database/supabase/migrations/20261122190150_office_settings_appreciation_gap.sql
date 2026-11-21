-- After how many days without an appreciation the evaluator gets the overdue signal (appreciation_moments,
-- B7). The admin changes it like the other settings, the existing policies apply.
alter table public.office_settings
  add column appreciation_gap_days smallint not null default 30
    check (appreciation_gap_days between 1 and 365);
comment on column public.office_settings.appreciation_gap_days is 'Days without an appreciation after which the evaluator gets the overdue signal.';

grant select (appreciation_gap_days) on public.office_settings to authenticated;
grant update (appreciation_gap_days) on public.office_settings to authenticated;
