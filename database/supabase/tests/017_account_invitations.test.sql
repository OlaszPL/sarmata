begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into public.offices (id, name) values
  ('a1717171-0000-4000-8000-000000000001', 'Urząd A'),
  ('b1717171-0000-4000-8000-000000000002', 'Urząd B');
insert into auth.users (id, email) values
  ('a1717171-1111-4000-8000-000000000001', 'admin@a17.test'),
  ('a1717171-1111-4000-8000-000000000002', 'hr@a17.test'),
  ('b1717171-1111-4000-8000-000000000001', 'admin@b17.test');
insert into public.memberships (user_id, office_id, role) values
  ('a1717171-1111-4000-8000-000000000001', 'a1717171-0000-4000-8000-000000000001', 'admin'),
  ('a1717171-1111-4000-8000-000000000002', 'a1717171-0000-4000-8000-000000000001', 'hr'),
  ('b1717171-1111-4000-8000-000000000001', 'b1717171-0000-4000-8000-000000000002', 'admin');
-- An invitation of office B and one of office A that already carries a temporary password (as the worker leaves it).
insert into public.account_invitations (id, office_id, email, role, first_name, last_name, requested_by) values
  ('b1717171-2222-4000-8000-000000000001', 'b1717171-0000-4000-8000-000000000002', 'obcy@b17.test', 'hr', 'Obca', 'Osoba',
   'b1717171-1111-4000-8000-000000000001');
insert into public.account_invitations (
  id, office_id, email, role, first_name, last_name, requested_by,
  status, mode, finished_at, temporary_password, temporary_password_set
) values (
  'a1717171-2222-4000-8000-000000000001', 'a1717171-0000-4000-8000-000000000001', 'bezpoczty@a17.test', 'evaluator', 'Basia', 'Bezpoczty',
  'a1717171-1111-4000-8000-000000000001', 'sent', 'temporary_password', now(), 'Tymczasowe-Haslo-1', true
);

-- Inserts made as the owner enqueue a job too (the seed rows above), so the check below counts only a new one.
select is(
  (select count(*)::integer from pgmq.read('jobs', 0, 100) r
    where r.message ->> 'type' = 'accounts.invite'
      and r.message -> 'payload' ->> 'invitationId' = 'a1717171-2222-4000-8000-000000000001'),
  1,
  'the insert trigger queues accounts.invite with the invitation id'
);
select is(
  (select r.message::text from pgmq.read('jobs', 0, 100) r
    where r.message ->> 'type' = 'accounts.invite'
      and r.message -> 'payload' ->> 'invitationId' = 'b1717171-2222-4000-8000-000000000001'),
  '{"type": "accounts.invite", "payload": {"invitationId": "b1717171-2222-4000-8000-000000000001"}}',
  'the job message holds the id only, no e-mail address'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1717171-1111-4000-8000-000000000001","role":"authenticated","office_id":"a1717171-0000-4000-8000-000000000001","office_role":"admin"}';

select lives_ok(
  $$insert into public.account_invitations (email, role, first_name, last_name)
    values ('nowy@a17.test', 'evaluator', 'Nina', 'Nowa')$$,
  'admin requests an invitation'
);
select results_eq(
  $$select office_id, requested_by, status::text, mode::text, temporary_password_set
      from public.account_invitations where email = 'nowy@a17.test'$$,
  $$values ('a1717171-0000-4000-8000-000000000001'::uuid, auth.uid(), 'pending', null::text, false)$$,
  'the request takes the office and the requester from the token and starts pending'
);
select is(
  (select count(*)::integer from public.account_invitations),
  2,
  'admin sees the invitations of the own office only'
);
select throws_ok(
  $$insert into public.account_invitations (email, role, first_name, last_name, office_id)
    values ('x@b17.test', 'hr', 'X', 'Y', 'b1717171-0000-4000-8000-000000000002')$$,
  '42501',
  null,
  'admin cannot request an invitation for another office'
);
select throws_ok(
  $$insert into public.account_invitations (email, role, first_name, last_name)
    values ('Duze@A17.test', 'hr', 'X', 'Y')$$,
  '23514',
  null,
  'the e-mail must be normalized'
);
select throws_ok(
  $$insert into public.account_invitations (email, role, first_name, last_name, status)
    values ('ok@a17.test', 'hr', 'X', 'Y', 'sent')$$,
  '42501',
  null,
  'the result columns are not writable for accounts'
);
select throws_ok(
  $$update public.account_invitations set status = 'failed' where email = 'nowy@a17.test'$$,
  '42501',
  null,
  'nor updatable'
);
select throws_ok(
  $$select temporary_password from public.account_invitations$$,
  '42501',
  null,
  'the temporary password column cannot be read through the API'
);
select is(
  (select temporary_password_set from public.account_invitations where id = 'a1717171-2222-4000-8000-000000000001'),
  true,
  'but the flag that one waits can'
);

-- Taking the password shows it once.
select is(
  public.take_invitation_password('a1717171-2222-4000-8000-000000000001'),
  'Tymczasowe-Haslo-1',
  'admin takes the temporary password'
);
select is(
  public.take_invitation_password('a1717171-2222-4000-8000-000000000001'),
  null,
  'the second take returns nothing'
);
select is(
  (select temporary_password_set from public.account_invitations where id = 'a1717171-2222-4000-8000-000000000001'),
  false,
  'and the flag is cleared'
);
select is(
  public.take_invitation_password('b1717171-2222-4000-8000-000000000001'),
  null,
  'an invitation of another office has nothing to take'
);

-- hr is not an admin.
set local request.jwt.claims = '{"sub":"a1717171-1111-4000-8000-000000000002","role":"authenticated","office_id":"a1717171-0000-4000-8000-000000000001","office_role":"hr"}';
select throws_ok(
  $$insert into public.account_invitations (email, role, first_name, last_name)
    values ('hr-prosi@a17.test', 'evaluator', 'X', 'Y')$$,
  '42501',
  null,
  'hr cannot request an invitation'
);
select is_empty(
  $$select 1 from public.account_invitations$$,
  'hr sees no invitations'
);

-- The job of the request made as the admin (the queue functions are not open to accounts).
reset role;
select is(
  (select count(*)::integer from pgmq.read('jobs', 0, 100) r
    where r.message -> 'payload' ->> 'invitationId' = (select i.id::text from public.account_invitations i where i.email = 'nowy@a17.test')),
  1,
  'requesting as the admin queues the job as well'
);

select * from finish();
rollback;
