// Client components import this file: only types from the services, never a value import.
import type { OfficeSettings, OfficeSettingsPatchInput } from '@sarmata/services';
import { z } from 'zod';
import type { FormValues } from '@/lib/form-action';

const rangeMessage = (min: number, max: number) =>
  `Wpisz liczbę od ${String(min).replace('.', ',')} do ${String(max).replace('.', ',')}`;

/** A text field read as a number: trims, accepts a comma as the decimal sign, checks the range. */
function parseNumber(raw: string, min: number, max: number, decimal: boolean): number | null {
  const text = raw.trim().replace(',', '.');
  if (!(decimal ? /^\d+(\.\d+)?$/ : /^\d+$/).test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

/** Required number typed in a text input. */
function numberField(
  min: number,
  max: number,
  message = rangeMessage(min, max),
  options: { decimal?: boolean } = {},
) {
  return z
    .string()
    .default('')
    .transform((raw, context) => {
      const value = parseNumber(raw, min, max, options.decimal ?? false);
      if (value === null) {
        context.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return value;
    });
}

/** Optional number: an empty field becomes `null`. */
function optionalNumberField(min: number, max: number) {
  return z
    .string()
    .default('')
    .transform((raw, context) => {
      if (raw.trim() === '') return null;
      const value = parseNumber(raw, min, max, false);
      if (value === null) {
        context.addIssue({ code: 'custom', message: rangeMessage(min, max) });
        return z.NEVER;
      }
      return value;
    });
}

/** Optional text: an empty field becomes `null`. */
const optionalText = z
  .string()
  .default('')
  .transform((raw) => {
    const text = raw.trim();
    return text === '' ? null : text;
  });

const REMINDER_MESSAGE = 'Wpisz od 1 do 5 liczb z zakresu od 1 do 90, oddzielonych przecinkami';

const reminderLeadDays = z
  .string()
  .default('')
  .transform((raw, context) => {
    const parts = raw.split(',').map((part) => part.trim());
    const days = parts.map((part) => parseNumber(part, 1, 90, false));
    if (parts.length > 5 || days.some((day) => day === null)) {
      context.addIssue({ code: 'custom', message: REMINDER_MESSAGE });
      return z.NEVER;
    }
    return days as number[];
  });

const smtpFrom = z
  .string()
  .default('')
  .transform((raw, context) => {
    const text = raw.trim();
    if (text === '') return null;
    if (!z.email().safeParse(text).success) {
      context.addIssue({ code: 'custom', message: 'Wpisz poprawny adres e-mail' });
      return z.NEVER;
    }
    return text;
  });

/** Posted office settings form, parsed into the patch the service takes (`OfficeSettingsPatchInput`). */
export const officeSettingsFormSchema = z
  .object({
    aiEnabled: z.enum(['1', '0'], { error: 'Wybierz, czy AI ma być włączone' }),
    notesRetentionMonths: numberField(1, 120),
    reminderLeadDays,
    evaluationVisibility: z.enum(['office', 'tree'], { error: 'Wybierz widoczność ocen' }),
    defaultPlace: optionalText,
    objectionAddresseeSheetA: optionalText,
    minEvaluations: numberField(1, 1000),
    centralSharePercent: numberField(50, 100),
    leniencyPoints: numberField(0.1, 4, undefined, { decimal: true }),
    appreciationGapDays: numberField(1, 365),
    smtpHost: optionalText,
    smtpPort: optionalNumberField(1, 65535),
    smtpUser: optionalText,
    smtpFrom,
  })
  .transform((form): OfficeSettingsPatchInput => ({
    aiEnabled: form.aiEnabled === '1',
    notesRetentionMonths: form.notesRetentionMonths,
    reminderLeadDays: form.reminderLeadDays,
    evaluationVisibility: form.evaluationVisibility,
    defaultPlace: form.defaultPlace,
    objectionAddresseeSheetA: form.objectionAddresseeSheetA,
    evaluatorFlags: {
      minEvaluations: form.minEvaluations,
      centralShare: form.centralSharePercent / 100,
      leniencyPoints: form.leniencyPoints,
    },
    appreciationGapDays: form.appreciationGapDays,
    smtp: {
      host: form.smtpHost,
      port: form.smtpPort,
      user: form.smtpUser,
      from: form.smtpFrom,
    },
  }));

const decimalText = (value: number) => String(value).replace('.', ',');

/** Form values of the saved settings. The SMTP password never appears, only a flag elsewhere. */
export function settingsFormValues(settings: OfficeSettings): FormValues {
  return {
    aiEnabled: settings.aiEnabled ? '1' : '0',
    notesRetentionMonths: String(settings.notesRetentionMonths),
    reminderLeadDays: settings.reminderLeadDays.join(', '),
    evaluationVisibility: settings.evaluationVisibility,
    defaultPlace: settings.defaultPlace ?? '',
    objectionAddresseeSheetA: settings.objectionAddresseeSheetA ?? '',
    minEvaluations: String(settings.evaluatorFlags.minEvaluations),
    centralSharePercent: String(Math.round(settings.evaluatorFlags.centralShare * 100)),
    leniencyPoints: decimalText(settings.evaluatorFlags.leniencyPoints),
    appreciationGapDays: String(settings.appreciationGapDays),
    smtpHost: settings.smtp.host ?? '',
    smtpPort: settings.smtp.port === null ? '' : String(settings.smtp.port),
    smtpUser: settings.smtp.user ?? '',
    smtpFrom: settings.smtp.from ?? '',
  };
}

/** Paths of a domain `ZodError` to control ids (a trailing index of a list falls on the list field). */
export const officeSettingsFieldMap: Record<string, string> = {
  notesRetentionMonths: 'notesRetentionMonths',
  reminderLeadDays: 'reminderLeadDays',
  evaluationVisibility: 'evaluationVisibility',
  defaultPlace: 'defaultPlace',
  objectionAddresseeSheetA: 'objectionAddresseeSheetA',
  appreciationGapDays: 'appreciationGapDays',
  aiEnabled: 'aiEnabled',
  'evaluatorFlags.minEvaluations': 'minEvaluations',
  'evaluatorFlags.centralShare': 'centralSharePercent',
  'evaluatorFlags.leniencyPoints': 'leniencyPoints',
  'smtp.host': 'smtpHost',
  'smtp.port': 'smtpPort',
  'smtp.user': 'smtpUser',
  'smtp.from': 'smtpFrom',
};

/** Renames the keys of field errors by `fieldMap`, dropping a numeric list index. Unknown keys stay. */
export function remapFieldErrors(
  errors: Partial<Record<string, string>>,
  fieldMap: Record<string, string>,
): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const [key, message] of Object.entries(errors)) {
    const path = key.replace(/\.\d+$/, '');
    out[fieldMap[path] ?? key] ??= message;
  }
  return out;
}

/**
 * Shortening the notes retention deletes older notes at the next nightly run, so the admin must
 * confirm the warning with the counts first.
 */
export function needsRetentionConfirmation(
  current: number,
  next: number,
  confirmed: boolean,
): boolean {
  return next < current && !confirmed;
}
