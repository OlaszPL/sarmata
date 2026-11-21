-- Daily at 5:30 UTC, after the notification collection and the closing of unobjected evaluations. The job
-- goes through the queue, so the worker retries it and logs it. The day is the Warsaw date. The type is
-- RETENTION_JOB_TYPE of @sarmata/domain.
select cron.schedule(
  'retention-daily',
  '30 5 * * *',
  $$select public.job_queue_send(jsonb_build_object(
      'type', 'retention.run',
      'payload', jsonb_build_object('day', (now() at time zone 'Europe/Warsaw')::date::text)))$$
);
