-- Two more office settings for the KPRM sheet templates: the default place (miejscowość) printed next to
-- dates, and an optional addressee of the objection on sheet A. When the addressee is null, the text from
-- the regulation rules (sheet A) applies. Admin edits them like the other settings.
alter table public.office_settings
  add column default_place text,
  add column objection_addressee_sheet_a text;
comment on column public.office_settings.default_place is 'Default place (miejscowość) for evaluation events. Null when not set.';
comment on column public.office_settings.objection_addressee_sheet_a is 'Office override of the objection addressee on sheet A. Null: the rules.json text applies.';

grant select (default_place, objection_addressee_sheet_a) on public.office_settings to authenticated;
grant update (default_place, objection_addressee_sheet_a) on public.office_settings to authenticated;
