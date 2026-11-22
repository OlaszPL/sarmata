import type { FormState } from '@/lib/form-action';

export interface SummaryItems {
  linked: { fieldId: string; message: string }[];
  unlinked: string[];
}

/**
 * Splits field errors for the error summary. Errors of known fields become links in the order of
 * `fields` (the order on the page), errors of any other key have no control to link to.
 */
export function summaryItems(
  fieldErrors: FormState['fieldErrors'],
  fields: readonly string[],
): SummaryItems {
  const linked: SummaryItems['linked'] = [];
  for (const fieldId of fields) {
    const message = fieldErrors[fieldId];
    if (message) linked.push({ fieldId, message });
  }
  const unlinked: string[] = [];
  for (const [key, message] of Object.entries(fieldErrors)) {
    if (message && !fields.includes(key)) unlinked.push(message);
  }
  return { linked, unlinked };
}
