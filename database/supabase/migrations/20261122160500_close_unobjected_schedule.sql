-- Daily at 5:10 UTC, after the notification collection. The job goes through the queue, so the worker
-- retries it and logs it. The day is the Warsaw date.
select cron.schedule(
  'close-unobjected-daily',
  '10 5 * * *',
  $$select public.job_queue_send(jsonb_build_object(
      'type', 'evaluations.close_unobjected',
      'payload', jsonb_build_object('day', (now() at time zone 'Europe/Warsaw')::date::text)))$$
);
