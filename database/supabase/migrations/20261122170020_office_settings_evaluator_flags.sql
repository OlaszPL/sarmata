-- Thresholds of the evaluator flags in the statistics (central tendency, leniency, strictness). Office
-- settings edited by the admin, so the report does not hide them in code. Rules: docs/funkcjonalnosci.md.
alter table public.office_settings
  add column evaluator_flag_min_evaluations smallint not null default 5
    check (evaluator_flag_min_evaluations between 1 and 1000),
  add column evaluator_flag_central_share numeric(3, 2) not null default 0.80
    check (evaluator_flag_central_share between 0.50 and 1.00),
  add column evaluator_flag_leniency_points numeric(3, 1) not null default 1.0
    check (evaluator_flag_leniency_points between 0.1 and 4.0);

comment on column public.office_settings.evaluator_flag_min_evaluations is 'Minimum number of evaluations of one evaluator in a year before any flag applies. Default 5.';
comment on column public.office_settings.evaluator_flag_central_share is 'Share of the middle level among the evaluations of one evaluator from which central tendency is flagged. Default 0.80.';
comment on column public.office_settings.evaluator_flag_leniency_points is 'Distance in mean points between an evaluator and the office from which leniency or strictness is flagged. Default 1.0.';

grant select (evaluator_flag_min_evaluations, evaluator_flag_central_share, evaluator_flag_leniency_points)
  on public.office_settings to authenticated;
grant update (evaluator_flag_min_evaluations, evaluator_flag_central_share, evaluator_flag_leniency_points)
  on public.office_settings to authenticated;
