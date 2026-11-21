begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

set local role service_role;

select isnt(
  public.job_queue_send('{"type":"test.read","payload":{}}'::jsonb),
  null,
  'the service role enqueues a job'
);

select results_eq(
  $$select message ->> 'type' from public.job_queue_read(100, 30) where message ->> 'type' = 'test.read'$$,
  $$values ('test.read')$$,
  'the service role reads the job'
);

select ok(
  (with sent as (select public.job_queue_send('{"type":"test.archive","payload":{}}'::jsonb) as id)
   select public.job_queue_archive(id) from sent),
  'the service role archives a job'
);

reset role;
set local role authenticated;

select throws_ok(
  $$select public.job_queue_send('{"type":"test.denied","payload":{}}'::jsonb)$$,
  '42501',
  null,
  'an account cannot use the job queue'
);

select * from finish();
rollback;
