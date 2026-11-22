/**
 * Attaches a service failure to the form control it is about, so the error summary can link to it.
 * Codes without a control of their own return nothing, their message stays the form error.
 */
export function fieldErrorsOf(
  code: string,
  details: unknown,
  formError: string,
): Record<string, string> {
  if (code === 'objection_late') return { filedOn: formError };
  if (code === 'invalid_evaluator') return { accountId: formError };
  if (code === 'term_change_invalid' && Array.isArray(details)) {
    if (details.includes('term_change_too_early')) return { noticeOn: formError };
    if (details.includes('term_change_reason_unknown')) return { reason: formError };
  }
  return {};
}
