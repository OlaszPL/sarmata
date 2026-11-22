'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  type RegulationIssue,
  ServiceError,
  type ServiceErrorCode,
  calendarDate,
  servicesFor,
} from '@sarmata/services';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { pluralPl } from '@/lib/format';
import {
  applyRegulationEdits,
  issuePathLabel,
  regulationIssueErrors,
  regulationIssueMessage,
} from '@/lib/regulations/regulation-form';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { adminOnlyState } from '@/lib/settings/admin-guard';
import { createSupabase } from '@/lib/supabase';

export type RegulationFormState = FormState;

const versionUrl = (id: string, flag: string) =>
  `${routes.settingsRules}?wersja=${encodeURIComponent(id)}&${flag}=1`;

/** Runs a call and hands back the listed service errors as values, so their details stay readable. */
async function catching<T>(
  codes: readonly ServiceErrorCode[],
  fn: () => Promise<T>,
): Promise<{ value: T } | { rejected: ServiceError }> {
  try {
    return { value: await fn() };
  } catch (error) {
    if (error instanceof ServiceError && codes.includes(error.code)) return { rejected: error };
    throw error;
  }
}

function issuesOf(details: unknown): RegulationIssue[] {
  const issues = (details as { issues?: unknown } | null | undefined)?.issues;
  if (!Array.isArray(issues)) return [];
  return issues.filter(
    (issue): issue is RegulationIssue =>
      typeof issue === 'object' &&
      issue !== null &&
      Array.isArray((issue as RegulationIssue).path) &&
      typeof (issue as RegulationIssue).message === 'string',
  );
}

function failingCount(details: unknown): number {
  const cases = (details as { cases?: unknown } | null | undefined)?.cases;
  if (!Array.isArray(cases)) return 0;
  return cases.filter((item) => (item as { status?: unknown } | null)?.status !== 'passed').length;
}

const cloneSchema = z.object({
  sourceId: z.string().trim().min(1, 'Wybierz wersję'),
  name: z
    .string()
    .trim()
    .min(1, 'Wpisz nazwę wersji')
    .max(200, 'Nazwa wersji może mieć najwyżej 200 znaków'),
});

/** Clones a published version into a new draft and opens it. */
export async function cloneVersion(
  _previous: RegulationFormState,
  formData: FormData,
): Promise<RegulationFormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;
  const parsed = parseForm(cloneSchema, formData);
  if ('state' in parsed) return parsed.state;
  const values = formValues(formData);
  const editor = servicesFor(await createSupabase()).regulationEditor;

  const result = await runService(
    () => catching(['regulation_invalid'], () => editor.clone(parsed.data)),
    undefined,
    values,
  );
  if (!result.ok) return result.state;
  if ('rejected' in result.value) {
    const issues = issuesOf(result.value.rejected.details);
    const nameIssue = issues.find((issue) => issue.path[0] === 'name');
    return {
      values,
      fieldErrors: nameIssue
        ? { name: regulationIssueMessage(null, nameIssue.message, 'Wpisz inną nazwę wersji') }
        : {},
      formError: serviceErrorMessage('regulation_invalid'),
    };
  }
  redirect(versionUrl(result.value.value.id, 'utworzono'));
}

/**
 * Writes the posted parameters into the draft and runs the worked examples. Schema issues come back
 * on the fields, the typed values stay. The page reads the case results of the saved draft.
 */
export async function saveParameters(
  _previous: RegulationFormState,
  formData: FormData,
): Promise<RegulationFormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;
  const values = formValues(formData);
  const versionId = typeof values.versionId === 'string' ? values.versionId : '';
  const editor = servicesFor(await createSupabase()).regulationEditor;

  const loaded = await runService(() => editor.get(versionId), undefined, values);
  if (!loaded.ok) return loaded.state;
  if (loaded.value === null) {
    return { values, fieldErrors: {}, formError: serviceErrorMessage('not_found') };
  }
  const { document } = loaded.value;
  const saved = await runService(
    () =>
      catching(['regulation_invalid'], () =>
        editor.saveDraft(versionId, applyRegulationEdits(document, values)),
      ),
    undefined,
    values,
  );
  if (!saved.ok) return saved.state;
  const outcome = saved.value;
  if ('value' in outcome && outcome.value.saved) redirect(versionUrl(versionId, 'zapisano'));

  const issues = 'rejected' in outcome ? issuesOf(outcome.rejected.details) : outcome.value.issues;
  const { fieldErrors, outside } = regulationIssueErrors(document, issues);
  if (outside.length > 0) {
    return {
      values,
      fieldErrors,
      formError: `Wersja zawiera błędy poza tym formularzem: ${outside.join(', ')}.`,
    };
  }
  if (Object.keys(fieldErrors).length === 0) {
    return { values, fieldErrors, formError: serviceErrorMessage('regulation_invalid') };
  }
  return { values, fieldErrors };
}

const publishSchema = z.object({
  versionId: z.string().min(1),
  effectiveFrom: z
    .string()
    .trim()
    .transform((raw, context) => {
      if (raw === '') {
        context.addIssue({ code: 'custom', message: 'Wpisz datę wejścia w życie' });
        return z.NEVER;
      }
      try {
        return calendarDate(raw);
      } catch {
        context.addIssue({ code: 'custom', message: 'Wpisz poprawną datę wejścia w życie' });
        return z.NEVER;
      }
    }),
  confirmPublish: z.literal('1', { error: 'Potwierdź publikację' }),
  acceptFailingCases: z.string(),
});

/** Publishes a draft from the given date. Failing worked examples need the explicit acceptance. */
export async function publishVersion(
  _previous: RegulationFormState,
  formData: FormData,
): Promise<RegulationFormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;
  const parsed = parseForm(publishSchema, formData);
  if ('state' in parsed) return parsed.state;
  const values = formValues(formData);
  const { versionId, effectiveFrom, acceptFailingCases } = parsed.data;
  const editor = servicesFor(await createSupabase()).regulationEditor;

  const result = await runService(
    () =>
      catching(['regulation_invalid', 'regulation_cases_failed'], () =>
        editor.publish(versionId, {
          effectiveFrom,
          acceptFailingCases: acceptFailingCases === '1',
        }),
      ),
    undefined,
    values,
  );
  if (!result.ok) return result.state;
  if ('value' in result.value) redirect(versionUrl(versionId, 'opublikowano'));

  const error = result.value.rejected;
  if (error.code === 'regulation_cases_failed') {
    const count = failingCount(error.details);
    const cases = pluralPl(
      count,
      'przypadek testowy nie przechodzi',
      'przypadki testowe nie przechodzą',
      'przypadków testowych nie przechodzi',
    );
    return {
      values,
      fieldErrors: {},
      formError: `${count} ${cases}. Zaznacz akceptację, jeśli to zamierzone.`,
    };
  }
  const fieldErrors: Record<string, string> = {};
  const outside: string[] = [];
  for (const issue of issuesOf(error.details)) {
    if (issue.path[0] === 'effectiveFrom') {
      if (!('effectiveFrom' in fieldErrors)) {
        fieldErrors.effectiveFrom = regulationIssueMessage(
          null,
          issue.message,
          'Wybierz inną datę wejścia w życie',
        );
      }
    } else {
      const label = issuePathLabel(issue.path);
      if (!outside.includes(label)) outside.push(label);
    }
  }
  if (outside.length === 0 && fieldErrors.effectiveFrom) return { values, fieldErrors };
  return {
    values,
    fieldErrors,
    formError:
      outside.length > 0
        ? `Wersja zawiera błędy: ${outside.join(', ')}. Popraw parametry i zapisz szkic.`
        : serviceErrorMessage('regulation_invalid'),
  };
}

const deleteSchema = z.object({
  versionId: z.string().min(1),
  confirmDelete: z.literal('1', { error: 'Potwierdź usunięcie szkicu' }),
});

/** Deletes a draft. Published versions stay, the service refuses them. */
export async function deleteDraft(
  _previous: RegulationFormState,
  formData: FormData,
): Promise<RegulationFormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;
  const parsed = parseForm(deleteSchema, formData);
  if ('state' in parsed) return parsed.state;
  const values = formValues(formData);
  const editor = servicesFor(await createSupabase()).regulationEditor;

  const result = await runService(
    () => editor.deleteDraft(parsed.data.versionId),
    undefined,
    values,
  );
  if (!result.ok) return result.state;
  redirect(`${routes.settingsRules}?usunieto=1`);
}
