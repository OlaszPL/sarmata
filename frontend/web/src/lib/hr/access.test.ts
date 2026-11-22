import { describe, expect, it } from 'vitest';
import type { OfficeRole } from '@sarmata/services';
import { type HrArea, type HrAccess, hrAccess } from './access';

const areas: HrArea[] = [
  'tasks',
  'schedule',
  'statistics',
  'evaluatorReport',
  'register',
  'import',
  'tree',
];

const expected: Record<OfficeRole, Record<HrArea, HrAccess>> = {
  hr: {
    tasks: 'write',
    schedule: 'write',
    statistics: 'write',
    evaluatorReport: 'write',
    register: 'write',
    import: 'write',
    tree: 'write',
  },
  admin: {
    tasks: 'none',
    schedule: 'read',
    statistics: 'read',
    evaluatorReport: 'none',
    register: 'none',
    import: 'none',
    tree: 'none',
  },
  evaluator: {
    tasks: 'none',
    schedule: 'none',
    statistics: 'none',
    evaluatorReport: 'none',
    register: 'none',
    import: 'none',
    tree: 'none',
  },
};

describe('hrAccess', () => {
  for (const role of Object.keys(expected) as OfficeRole[]) {
    for (const area of areas) {
      it(`${role} on ${area} is ${expected[role][area]}`, () => {
        expect(hrAccess(role, area)).toBe(expected[role][area]);
      });
    }
  }
});
