-- Background jobs for backend/worker (ADR 0002): one pgmq queue, typed messages {type, payload}.
select pgmq.create('jobs');

create function public.job_queue_send(message jsonb, delay_seconds integer default 0)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select pgmq.send('jobs', message, delay_seconds)
$$;

create function public.job_queue_read(batch_size integer, visibility_timeout_seconds integer)
returns table (message_id bigint, read_count integer, enqueued_at timestamptz, message jsonb)
language sql
security definer
set search_path = ''
as $$
  select r.msg_id, r.read_ct, r.enqueued_at, r.message
    from pgmq.read('jobs', visibility_timeout_seconds, batch_size) r
$$;

create function public.job_queue_archive(message_id bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select pgmq.archive('jobs', message_id)
$$;

-- PUBLIC keeps execute on new functions (plan 2 removed only the anon and authenticated defaults).
revoke execute on function public.job_queue_send(jsonb, integer) from public, anon, authenticated;
revoke execute on function public.job_queue_read(integer, integer) from public, anon, authenticated;
revoke execute on function public.job_queue_archive(bigint) from public, anon, authenticated;
grant execute on function public.job_queue_send(jsonb, integer) to service_role;
grant execute on function public.job_queue_read(integer, integer) to service_role;
grant execute on function public.job_queue_archive(bigint) to service_role;
