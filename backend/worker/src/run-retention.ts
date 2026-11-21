import { calendarDate, calendarDateSchema } from '@sarmata/domain';
import { createServiceClient } from '@sarmata/repositories';
import { createSystemServices } from '@sarmata/services/system';
import { workerConfigFromEnv } from './config';

// Runs the data retention by hand (pnpm retention:run [-- --day YYYY-MM-DD]). For demos and manual tests:
// pg_cron queues the job at 5:30 UTC. A later --day shows the anonymization of an employee whose retention
// ends in the future. Prints the report as JSON.

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
const report = await createSystemServices(client).retention.run(day);
console.log(JSON.stringify({ day, ...report }));
