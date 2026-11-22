import 'server-only';
import { type CalendarDate, servicesFor } from '@sarmata/services';
import { officeEmployees } from '@/lib/account';
import { createSupabase } from '@/lib/supabase';
import { type HrTask, feedsHrTasks, hrTasks } from './tasks';
import { loadViews } from './views';

/** The task list of hr, read for `/kadry` and the hr block of the dashboard. */
export async function loadHrTasks(today: CalendarDate): Promise<HrTask[]> {
  const services = servicesFor(await createSupabase());
  const [views, report, employees] = await Promise.all([
    loadViews(feedsHrTasks),
    services.statistics.schedule({ today }),
    officeEmployees(),
  ]);
  return hrTasks({ views, schedule: report.rows, employees, today });
}
