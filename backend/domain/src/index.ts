export { type CalendarDate, calendarDate } from './deadlines/calendar-date';
export { addMonths } from './deadlines/add-months';
export { type Absence } from './deadlines/absences';
export {
  type DeadlineEvent,
  type DeadlineRule,
  deadlineRuleSchema,
} from './deadlines/deadline-rule';
export {
  type DeadlineFacts,
  type DeadlineResult,
  computeDeadline,
} from './deadlines/compute-deadline';
