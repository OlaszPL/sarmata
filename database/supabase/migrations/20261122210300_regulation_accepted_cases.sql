-- An office may publish a draft whose worked examples fail (e.g. after an amendment that is not yet an
-- official version), but only with the explicit confirmation of the admin. The results the admin accepted
-- are kept with the version. Written in the same update that publishes it, immutable afterwards.
alter table public.regulation_versions add column accepted_failing_cases jsonb;

comment on column public.regulation_versions.accepted_failing_cases is
  'Results of the worked examples that failed at publication and were accepted by the admin, null when none failed.';
