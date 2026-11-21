/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the repository object */
import { calendarDate } from '@sarmata/domain';
import {
  type Employee,
  type EmploymentRepository,
  type Evaluation,
  RepositoryError,
} from '@sarmata/repositories';
import { describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../errors';
import { createEmploymentService } from './employment-service';

const EMPLOYEE = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';

const employee = (userId: string | null): Employee => ({
  id: EMPLOYEE,
  officeId: 'o1',
  firstName: 'Lena',
  lastName: 'Odeszła',
  email: null,
  userId,
  positionTitle: null,
  orgUnit: null,
  positionKind: 'other',
  serviceStatus: 'employee',
  employmentBasis: 'indefinite',
  employmentStart: null,
  appointmentYear: null,
  grade: null,
  gradeGrantedOn: null,
  employmentEndedOn: null,
  supervisorEmployeeId: null,
});

const evaluation = (id: string, status: Evaluation['status'], employeeId: string): Evaluation =>
  ({ id, status, employeeId, evaluatorAccountId: ACCOUNT }) as Evaluation;

function setup(
  options: {
    userId?: string | null;
    led?: Evaluation[];
    employment?: Partial<EmploymentRepository>;
  } = {},
) {
  const employment: EmploymentRepository = {
    end: vi.fn(() => Promise.resolve({ interruptedEvaluationIds: ['e1'] })),
    confirmArchiveExport: vi.fn(() => Promise.resolve()),
    retentionOverview: vi.fn(() => Promise.resolve([])),
    ...options.employment,
  };
  const service = createEmploymentService({
    employment,
    employees: {
      get: () => Promise.resolve(employee(options.userId === undefined ? null : options.userId)),
    },
    evaluations: { listForOffice: () => Promise.resolve(options.led ?? []) },
  });
  return { service, employment };
}

const input = {
  employeeId: EMPLOYEE,
  endedOn: calendarDate('2026-03-15'),
  reason: 'wypowiedzenie',
};

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
}

describe('employment service', () => {
  it('end computes the purge date from the end year', async () => {
    const { service, employment } = setup();
    const result = await service.end(input);
    expect(employment.end).toHaveBeenCalledWith({
      employeeId: EMPLOYEE,
      endedOn: '2026-03-15',
      reason: 'wypowiedzenie',
      purgeDueOn: '2036-12-31',
    });
    expect(result.interruptedEvaluationIds).toEqual(['e1']);
  });

  it('end maps already_ended', async () => {
    const { service } = setup({
      employment: {
        end: () =>
          Promise.reject(
            new RepositoryError('employment.end', { message: 'x', code: 'already_ended' }),
          ),
      },
    });
    const error = await failureOf(service.end(input));
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).code).toBe('already_ended');
  });

  it('end maps a denied role to forbidden', async () => {
    const { service } = setup({
      employment: {
        end: () =>
          Promise.reject(new RepositoryError('employment.end', { message: 'x', code: '42501' })),
      },
    });
    expect(((await failureOf(service.end(input))) as ServiceError).code).toBe('forbidden');
  });

  it('end reports foreign open evaluations', async () => {
    const { service } = setup({
      userId: ACCOUNT,
      led: [
        evaluation('e1', 'period', 'other'),
        evaluation('e2', 'closed', 'other'),
        evaluation('e3', 'interrupted', 'other'),
        evaluation('e4', 'interview', 'another'),
      ],
    });
    expect((await service.end(input)).openAsEvaluator).toBe(2);
  });

  it('end with an empty reason fails validation before any call', async () => {
    const { service, employment } = setup();
    await expect(service.end({ ...input, reason: ' ' })).rejects.toThrow();
    expect(employment.end).not.toHaveBeenCalled();
  });

  it('overview passes the window through', async () => {
    const { service, employment } = setup();
    await service.overview(30);
    expect(employment.retentionOverview).toHaveBeenCalledWith(30);
  });
});
