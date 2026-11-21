import type { OfficeRole } from '@sarmata/services';

/** Role names shown in the UI (docs/funkcjonalnosci.md: oceniający, kadry, admin). */
export const roleLabels: Record<OfficeRole, string> = {
  admin: 'Administrator',
  hr: 'Kadry',
  evaluator: 'Oceniający',
};
