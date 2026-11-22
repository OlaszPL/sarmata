import { ServiceError } from '@sarmata/services';
import { type FormState, type FormValues, runService } from '@/lib/form-action';
import { serviceErrorMessage } from '@/lib/service-errors';

const ruleMessages: Record<string, string> = {
  no_rejected_objection: 'Odwołanie można zapisać tylko po nieuwzględnionym sprzeciwie.',
  already_recorded: 'Ten wpis jest już zapisany w rejestrze.',
  date_before_outcome:
    'Data wniesienia odwołania nie może być wcześniejsza niż rozstrzygnięcie sprzeciwu.',
  not_civil_servant: 'Stopień służbowy można przyznać tylko urzędnikowi służby cywilnej.',
  grade_not_higher: 'Nowy stopień musi być wyższy niż obecny stopień pracownika.',
  date_before_previous_grant:
    'Data przyznania nie może być wcześniejsza niż data poprzedniego stopnia.',
  evaluation_required: 'Wybierz ocenę tego pracownika, na której opiera się przyznanie stopnia.',
};

/** Message of a service error for the register forms: `hr_entry_rejected` names the broken rule. */
export function registerErrorMessage(code: string, details?: unknown): string {
  if (code === 'hr_entry_rejected' && typeof details === 'object' && details !== null) {
    const rule = (details as { rule?: unknown }).rule;
    const message =
      typeof rule === 'string' && Object.hasOwn(ruleMessages, rule)
        ? ruleMessages[rule]
        : undefined;
    if (message !== undefined) return message;
  }
  return serviceErrorMessage(code, details);
}

/** `runService` with the rule messages of register entries. Values stay in the state for the form. */
export async function runRegisterService<T>(
  fn: () => Promise<T>,
  values: FormValues,
): Promise<{ ok: true; value: T } | { ok: false; state: FormState }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'hr_entry_rejected') {
      return {
        ok: false,
        state: {
          values,
          fieldErrors: {},
          formError: registerErrorMessage(error.code, error.details),
        },
      };
    }
    return runService(
      () => {
        throw error;
      },
      undefined,
      values,
    );
  }
}
