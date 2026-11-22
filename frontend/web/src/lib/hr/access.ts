import type { OfficeRole } from '@sarmata/services';

export type HrArea =
  'tasks' | 'schedule' | 'statistics' | 'evaluatorReport' | 'register' | 'import' | 'tree';

export type HrAccess = 'write' | 'read' | 'none';

const ADMIN_READ: readonly HrArea[] = ['schedule', 'statistics'];

/** What a role may do in an area of the HR panel. Mirrors the backend policies, the UI only hides what would fail. */
export function hrAccess(role: OfficeRole, area: HrArea): HrAccess {
  if (role === 'hr') return 'write';
  if (role === 'admin' && ADMIN_READ.includes(area)) return 'read';
  return 'none';
}
