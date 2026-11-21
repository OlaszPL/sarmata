-- Domain terms: GLOSSARY.md. Every domain table has office_id (ADR 0001).

-- The evaluated employee has no account. Evaluator is an account role, who they evaluate comes from the evaluation (docs/funkcjonalnosci.md).
create type public.office_role as enum ('admin', 'hr', 'evaluator');

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
comment on table public.offices is 'Office (urząd): employer of evaluated staff, owner of all domain data.';

-- One account belongs to one office, so the JWT carries an unambiguous office_id.
create table public.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  office_id uuid not null references public.offices (id) on delete cascade,
  role public.office_role not null,
  created_at timestamptz not null default now()
);
create index memberships_office_id_idx on public.memberships (office_id);
comment on table public.memberships is 'Membership (członkostwo): an account assigned to an office with a role.';

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (office_id, email)
);
create index employees_office_id_idx on public.employees (office_id);
comment on table public.employees is 'Employee (pracownik): a person from HR records, may exist without an account.';
