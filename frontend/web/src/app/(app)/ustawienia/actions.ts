'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { servicesFor } from '@sarmata/services';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { adminOnlyState } from '@/lib/settings/admin-guard';
import {
  needsRetentionConfirmation,
  officeSettingsFieldMap,
  officeSettingsFormSchema,
  remapFieldErrors,
} from '@/lib/settings/office-settings-form';
import { createSupabase } from '@/lib/supabase';

export type OfficeSettingsState = FormState & {
  /** What the nightly run would delete with the typed retention, shown with the confirmation checkbox. */
  retention?: { notes: number; aiRuns: number };
};

const CONFIRM_RETENTION = 'Potwierdź usunięcie starszych notatek albo zostaw dłuższy okres';

/**
 * Saves the office settings. A shorter notes retention first shows the warning with the counts,
 * the save goes through once the admin ticks the confirmation.
 */
export async function saveOfficeSettings(
  previous: OfficeSettingsState,
  formData: FormData,
): Promise<OfficeSettingsState> {
  const denied = await adminOnlyState(formData);
  if (denied) return denied;

  const parsed = parseForm(officeSettingsFormSchema, formData);
  if ('state' in parsed) {
    return previous.retention ? { ...parsed.state, retention: previous.retention } : parsed.state;
  }
  const values = formValues(formData);
  const patch = parsed.data;
  const services = servicesFor(await createSupabase());

  const loaded = await runService(() => services.officeSettings.get(), undefined, values);
  if (!loaded.ok) return loaded.state;
  const next = patch.notesRetentionMonths ?? loaded.value.notesRetentionMonths;
  if (
    needsRetentionConfirmation(
      loaded.value.notesRetentionMonths,
      next,
      formData.get('retentionConfirmed') === '1',
    )
  ) {
    const preview = await runService(
      () => services.officeSettings.notesRetentionPreview(next),
      undefined,
      values,
    );
    if (!preview.ok) return preview.state;
    return {
      values,
      fieldErrors: previous.retention ? { retentionConfirmed: CONFIRM_RETENTION } : {},
      retention: preview.value,
    };
  }

  const saved = await runService(() => services.officeSettings.update(patch), undefined, values);
  if (!saved.ok) {
    return {
      ...saved.state,
      fieldErrors: remapFieldErrors(saved.state.fieldErrors, officeSettingsFieldMap),
    };
  }
  redirect(`${routes.settings}?zapisano=1`);
}

const smtpPasswordSchema = z.object({
  smtpPassword: z.string().min(1, 'Wpisz hasło SMTP'),
});

/** Sets the SMTP password (Vault). The password never goes back into the form values. */
export async function saveSmtpPassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const denied = await adminOnlyState(formData);
  if (denied) return { ...denied, values: {} };

  const parsed = parseForm(smtpPasswordSchema, formData);
  if ('state' in parsed) return { ...parsed.state, values: {} };
  const services = servicesFor(await createSupabase());

  const saved = await runService(
    () => services.officeSettings.setSmtpPassword(parsed.data.smtpPassword),
    undefined,
    {},
  );
  if (!saved.ok) return saved.state;
  redirect(`${routes.settings}?haslo=1`);
}
