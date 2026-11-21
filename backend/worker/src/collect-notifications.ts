import { calendarDate, calendarDateSchema } from '@sarmata/domain';
import { createNotificationDeliveryStore, createServiceClient } from '@sarmata/repositories';
import { workerConfigFromEnv } from './config';

// Runs the daily notification collection by hand (pnpm notifications:collect [-- --day YYYY-MM-DD]).
// For demos and manual tests: pg_cron collects at 5:00 UTC. Prints the report as JSON.

function warsawToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return calendarDate(parts);
}

function requestedDay() {
  const index = process.argv.indexOf('--day');
  if (index === -1) return warsawToday();
  return calendarDateSchema.parse(process.argv[index + 1]);
}

const config = workerConfigFromEnv(process.env);
const client = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });
const day = requestedDay();
const report = await createNotificationDeliveryStore(client).collect(day);
console.log(JSON.stringify({ day, ...report }));
