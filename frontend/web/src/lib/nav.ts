import { type OfficeRole } from '@sarmata/services';
import { routes } from './routes';

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

const dashboard: NavItem = { href: routes.home, label: 'Pulpit' };

const evaluatorItems: readonly NavItem[] = [
  dashboard,
  { href: routes.employees, label: 'Moi pracownicy' },
  { href: routes.evaluations, label: 'Oceny' },
  { href: routes.notes, label: 'Notatki' },
];

const hrItems: readonly NavItem[] = [...evaluatorItems, { href: routes.hr, label: 'Kadry' }];

const adminItems: readonly NavItem[] = [
  dashboard,
  { href: routes.settings, label: 'Ustawienia' },
  { href: routes.aiLog, label: 'Dziennik AI' },
];

export function navForRole(role: OfficeRole): readonly NavItem[] {
  if (role === 'admin') return adminItems;
  if (role === 'hr') return hrItems;
  return evaluatorItems;
}

export function canStartEvaluation(role: OfficeRole): boolean {
  return role !== 'admin';
}
