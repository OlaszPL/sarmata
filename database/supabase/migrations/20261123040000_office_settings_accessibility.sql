-- Office data for the accessibility statement of the app (art. 10 ust. 4 pkt 4, 6 and 7 of the digital
-- accessibility act of 4 April 2019): the office address, the person or unit to contact about accessibility
-- with e-mail and phone, architectural accessibility (a link or a text) and the sign language interpreter.
-- All optional: the statement falls back to its generic text when a column is null. Every member reads them,
-- only the admin writes them, like the other settings columns.
alter table public.office_settings
  add column accessibility_office_address text,
  add column accessibility_contact_name text,
  add column accessibility_contact_email text,
  add column accessibility_contact_phone text,
  add column accessibility_architecture text,
  add column accessibility_sign_language text;

comment on column public.office_settings.accessibility_office_address is 'Postal address of the office for the accessibility statement. Null when not set.';
comment on column public.office_settings.accessibility_contact_name is 'Person or unit responsible for accessibility (art. 10 ust. 4 pkt 4). Null when not set.';
comment on column public.office_settings.accessibility_contact_email is 'E-mail of the accessibility contact. Null when not set.';
comment on column public.office_settings.accessibility_contact_phone is 'Phone of the accessibility contact. Null when not set.';
comment on column public.office_settings.accessibility_architecture is 'Architectural accessibility of the office buildings, a link (http or https) or a text (art. 10 ust. 4 pkt 6). Null when not set.';
comment on column public.office_settings.accessibility_sign_language is 'Sign language interpreter information (art. 10 ust. 4 pkt 7). Null when not set.';

grant select (
  accessibility_office_address, accessibility_contact_name, accessibility_contact_email,
  accessibility_contact_phone, accessibility_architecture, accessibility_sign_language
) on public.office_settings to authenticated;
grant update (
  accessibility_office_address, accessibility_contact_name, accessibility_contact_email,
  accessibility_contact_phone, accessibility_architecture, accessibility_sign_language
) on public.office_settings to authenticated;
