-- The end of an employment ends the access of its account: no more office claims in the JWT, so no more
-- access to the office. The membership row stays until anonymization, because the evaluations the account
-- led and the employee link of the account keep pointing at it (an evaluator's name stays on the evaluations
-- he or she led). Anonymization deletes the Auth account, which removes the membership.

alter table public.memberships add column ended_on date;
comment on column public.memberships.ended_on is
  'Last day of the access: set when the employment of the account ends. From that day the JWT carries no office.';

-- custom_access_token_hook as in 20261121120200_jwt_and_rls.sql, a membership with an end date in the past
-- adds no claims.
create or replace function access.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  membership record;
begin
  select c.office_id, c.role
    into membership
    from public.memberships c
   where c.user_id = (event ->> 'user_id')::uuid
     and (c.ended_on is null or c.ended_on > current_date);

  if found then
    claims := claims || jsonb_build_object('office_id', membership.office_id, 'office_role', membership.role);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- An evaluator account must belong to the office of the evaluation, and still have access. This replaces
-- the foreign key to memberships: deleting an account at anonymization must not be blocked by the
-- evaluations it led (they stay, evaluator_account_id is then only an identifier, like recorded_by).
alter table public.evaluations drop constraint evaluations_evaluator_fkey;

-- Security definer: the memberships table is read regardless of the caller. Named to fire after
-- evaluations_set_evaluator, which may replace the supplied evaluator.
create function public.evaluations_validate_evaluator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.memberships m
     where m.user_id = new.evaluator_account_id
       and m.office_id = new.office_id
       and (m.ended_on is null or m.ended_on > current_date)
  ) then
    raise exception 'evaluator must be an active member of the office of the evaluation'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger evaluations_validate_evaluator
  before insert or update of evaluator_account_id on public.evaluations
  for each row execute function public.evaluations_validate_evaluator();

revoke execute on function public.evaluations_validate_evaluator() from public, anon, authenticated;
