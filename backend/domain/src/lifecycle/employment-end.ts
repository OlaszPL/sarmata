import { z } from 'zod';
import { calendarDateSchema } from '../deadlines/calendar-date';

/** Hr marks the end of an employment. The reason is kept in the event of every interrupted evaluation. */
export const endEmploymentInputSchema = z.strictObject({
  employeeId: z.uuid(),
  endedOn: calendarDateSchema,
  reason: z.string().trim().min(1),
});
export type EndEmploymentInput = z.output<typeof endEmploymentInputSchema>;
