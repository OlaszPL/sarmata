-- Daily collection at 5:00 UTC, which is 6:00 or 7:00 in Warsaw. The day is the Warsaw date.
select cron.schedule(
  'notifications-daily',
  '0 5 * * *',
  $$select public.collect_notifications((now() at time zone 'Europe/Warsaw')::date)$$
);
