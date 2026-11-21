import { z } from 'zod';
import { calendarDate } from '../deadlines/calendar-date';

export const positionKindSchema = z.enum(['office_head', 'manages_people', 'other']);
export const serviceStatusSchema = z.enum(['civil_servant', 'employee']);
export const employmentBasisSchema = z.enum(['indefinite', 'appointment', 'fixed_term']);

/** Rodzaj stanowiska: decides which evaluation sheet applies (GLOSSARY.md). */
export type PositionKind = z.infer<typeof positionKindSchema>;
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type EmploymentBasis = z.infer<typeof employmentBasisSchema>;

const isoDate = z.string().transform((value, ctx) => {
  try {
    return calendarDate(value);
  } catch {
    ctx.issues.push({ code: 'custom', message: `invalid date ${value}`, input: value });
    return z.NEVER;
  }
});
const text = z.string().trim().min(1);

const nullableText = text.nullable();
const nullableDate = isoDate.nullable();
const nullableYear = z.number().int().min(1990).max(2100).nullable();
const nullableGrade = z.number().int().min(1).max(9).nullable();
const nullableId = z.uuid().nullable();

// The end of the employment is not here on purpose: only the termination flow sets it (end_employment).
// Without defaults, so that `.partial()` for a patch does not fill in values nobody sent.
const fields = {
  firstName: text,
  lastName: text,
  email: nullableText,
  positionTitle: nullableText,
  orgUnit: nullableText,
  positionKind: positionKindSchema,
  serviceStatus: serviceStatusSchema,
  employmentBasis: employmentBasisSchema,
  employmentStart: nullableDate,
  appointmentYear: nullableYear,
  grade: nullableGrade,
  gradeGrantedOn: nullableDate,
  supervisorEmployeeId: nullableId,
};

/** Employee profile as entered by HR. Omitted optional fields become `null`, the enums default to the most common value. */
export const newEmployeeSchema = z
  .strictObject({
    ...fields,
    email: fields.email.default(null),
    positionTitle: fields.positionTitle.default(null),
    orgUnit: fields.orgUnit.default(null),
    positionKind: fields.positionKind.default('other'),
    serviceStatus: fields.serviceStatus.default('employee'),
    employmentBasis: fields.employmentBasis.default('indefinite'),
    employmentStart: fields.employmentStart.default(null),
    appointmentYear: fields.appointmentYear.default(null),
    grade: fields.grade.default(null),
    gradeGrantedOn: fields.gradeGrantedOn.default(null),
    supervisorEmployeeId: fields.supervisorEmployeeId.default(null),
  })
  .superRefine((value, context) => {
    if (value.serviceStatus === 'civil_servant') return;
    for (const key of ['grade', 'appointmentYear', 'gradeGrantedOn'] as const) {
      if (value[key] !== null) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is only allowed for a civil servant`,
        });
      }
    }
  });

export const employeePatchSchema = z.strictObject(fields).partial();

export type NewEmployeeInput = z.input<typeof newEmployeeSchema>;
