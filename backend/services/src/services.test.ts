import { type RegulationDocument, calendarDate } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import {
  type Employee,
  type NewEmployee,
  type OfficialRegulationWriter,
  type Repositories,
  type StoredRegulationVersion,
} from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ServiceError, createServices } from './index';
import { syncOfficialRegulations } from './system';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');

const unavailable = (): never => {
  throw new Error('Evaluation repository is not used in these tests');
};

function inMemoryRepositories(seed: {
  employees?: Employee[];
  official?: RegulationDocument[];
  local?: StoredRegulationVersion[];
}) {
  const official = [...(seed.official ?? [])];
  const inserted: string[] = [];
  const candidates = (): StoredRegulationVersion[] => [
    ...official.map((document) => ({
      rowId: `row-${document.id}`,
      code: document.id,
      isOfficial: true,
      document,
    })),
    ...(seed.local ?? []),
  ];
  const created: Employee[] = [];
  const repositories: Repositories = {
    employees: {
      list: () => Promise.resolve([...(seed.employees ?? [])]),
      get: (id) => Promise.resolve((seed.employees ?? []).find((e) => e.id === id) ?? null),
      create: (input: NewEmployee) => {
        const employee: Employee = {
          id: 'new',
          officeId: 'o1',
          userId: null,
          employmentEndedOn: null,
          anonymizedAt: null,
          ...input,
        };
        created.push(employee);
        return Promise.resolve(employee);
      },
      update: (id, patch) => {
        const current = (seed.employees ?? []).find((e) => e.id === id);
        if (current === undefined) return Promise.reject(new Error('missing'));
        return Promise.resolve({ ...current, lastName: patch.lastName ?? current.lastName });
      },
      findSimilar: () => Promise.resolve([]),
    },
    regulationVersions: {
      listOfficial: () => Promise.resolve([...official]),
      findOfficialById: (id) =>
        Promise.resolve(official.find((document) => document.id === id) ?? null),
      findOfficialRowId: (id) =>
        Promise.resolve(official.some((document) => document.id === id) ? `row-${id}` : null),
      listInForceCandidates: () => Promise.resolve(candidates()),
      findByCode: (code) => Promise.resolve(candidates().find((v) => v.code === code) ?? null),
    },
    evaluations: {
      create: unavailable,
      get: unavailable,
      listForOffice: unavailable,
      latestForEmployee: unavailable,
      saveDraft: unavailable,
      applyTransition: unavailable,
      saveDeadlines: unavailable,
      recordEvent: unavailable,
      applyObjectionOutcome: unavailable,
      correctSheet: unavailable,
      changeEvaluator: unavailable,
      history: unavailable,
    },
    archivedEvaluations: { create: unavailable, listForEmployee: unavailable },
    sheetVersions: { listForEvaluation: unavailable },
  };
  const writer: OfficialRegulationWriter = {
    insertOfficial: (document) => {
      official.push(document);
      inserted.push(document.id);
      return Promise.resolve();
    },
  };
  return { repositories, writer, inserted, created };
}

const expectServiceError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(ServiceError);
  await expect(promise).rejects.toMatchObject({ code });
};

const profile = {
  positionTitle: null,
  orgUnit: null,
  positionKind: 'other',
  serviceStatus: 'employee',
  employmentBasis: 'indefinite',
  employmentStart: null,
  appointmentYear: null,
  grade: null,
  gradeGrantedOn: null,
  supervisorEmployeeId: null,
} as const;

describe('employees.create', () => {
  it('rejects empty last name', async () => {
    const { repositories, created } = inMemoryRepositories({});
    await expect(
      createServices({ repositories }).employees.create({ firstName: 'Ewa', lastName: '  ' }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(created).toEqual([]);
  });

  it('passes civil servant grade through', async () => {
    const { repositories, created } = inMemoryRepositories({});
    await createServices({ repositories }).employees.create({
      firstName: 'Ewa',
      lastName: 'Ewidencyjna',
      serviceStatus: 'civil_servant',
      appointmentYear: 2019,
      grade: 4,
      gradeGrantedOn: '2023-05-01',
    });
    expect(created[0]).toMatchObject({
      serviceStatus: 'civil_servant',
      grade: 4,
      gradeGrantedOn: '2023-05-01',
      positionKind: 'other',
      email: null,
    });
  });
});

describe('employees.list', () => {
  it('returns the employees from the repository', async () => {
    const employee: Employee = {
      id: 'e1',
      officeId: 'o1',
      firstName: 'Ewa',
      lastName: 'Ewidencyjna',
      email: null,
      userId: null,
      employmentEndedOn: null,
      anonymizedAt: null,
      ...profile,
    };
    const { repositories } = inMemoryRepositories({ employees: [employee] });
    expect(await createServices({ repositories }).employees.list()).toEqual([employee]);
  });
});

describe('regulations.inForceOn', () => {
  const regulation2027: RegulationDocument = {
    ...regulation2016,
    id: 'regulation-2027-test',
    effectiveFrom: calendarDate('2027-01-01'),
  };
  const { repositories } = inMemoryRepositories({ official: [regulation2016, regulation2027] });
  const services = createServices({ repositories });

  it('picks the version in force on the day', async () => {
    expect((await services.regulations.inForceOn(calendarDate('2026-11-21'))).id).toBe(
      'regulation-2016',
    );
    expect((await services.regulations.inForceOn(calendarDate('2027-01-01'))).id).toBe(
      'regulation-2027-test',
    );
  });

  it('fails before the first version', async () => {
    await expectServiceError(
      services.regulations.inForceOn(calendarDate('2016-04-22')),
      'no_regulation_in_force',
    );
  });
});

describe('regulations.forReportYear', () => {
  const { repositories } = inMemoryRepositories({ official: [regulation2016] });
  const services = createServices({ repositories });

  it('falls back to the earliest version for a year before it', async () => {
    expect((await services.regulations.forReportYear(2010)).id).toBe('regulation-2016');
    expect((await services.regulations.forReportYear(2026)).id).toBe('regulation-2016');
  });

  it('fails only when no version exists', async () => {
    const empty = createServices({
      repositories: inMemoryRepositories({ official: [] }).repositories,
    });
    await expectServiceError(empty.regulations.forReportYear(2026), 'no_regulation_in_force');
  });
});

describe('syncOfficialRegulations', () => {
  it('inserts missing official versions', async () => {
    const { repositories, writer, inserted } = inMemoryRepositories({});
    const report = await syncOfficialRegulations({
      reader: repositories.regulationVersions,
      writer,
      official: [regulation2016],
    });
    expect(report).toEqual({ inserted: ['regulation-2016'], unchanged: [] });
    expect(inserted).toEqual(['regulation-2016']);
  });

  it('leaves an equal version alone even when jsonb reordered its keys', async () => {
    const reordered = Object.fromEntries(
      Object.entries(regulation2016).reverse(),
    ) as RegulationDocument;
    const { repositories, writer, inserted } = inMemoryRepositories({ official: [reordered] });
    const report = await syncOfficialRegulations({
      reader: repositories.regulationVersions,
      writer,
      official: [regulation2016],
    });
    expect(report).toEqual({ inserted: [], unchanged: ['regulation-2016'] });
    expect(inserted).toEqual([]);
  });

  it('fails loudly and writes nothing when a stored official version differs', async () => {
    const changed: RegulationDocument = { ...regulation2016, name: 'zmieniona po cichu' };
    const added: RegulationDocument = {
      ...regulation2016,
      id: 'regulation-2027-test',
      effectiveFrom: calendarDate('2027-01-01'),
    };
    const { repositories, writer, inserted } = inMemoryRepositories({ official: [changed] });
    await expectServiceError(
      syncOfficialRegulations({
        reader: repositories.regulationVersions,
        writer,
        official: [added, regulation2016],
      }),
      'regulation_drift',
    );
    expect(inserted).toEqual([]);
  });
});

describe('deadlines.compute', () => {
  const { repositories } = inMemoryRepositories({ official: [regulation2016] });
  const services = createServices({ repositories });

  it('computes a slot of the pinned regulation version', async () => {
    const result = await services.deadlines.compute({
      regulationId: 'regulation-2016',
      slot: 'objection',
      facts: { eventDate: calendarDate('2026-11-14') },
    });
    expect(result).toMatchObject({ kind: 'due', due: '2026-11-23' });
  });

  it('fails for an unknown regulation version', async () => {
    await expectServiceError(
      services.deadlines.compute({
        regulationId: 'regulation-1999',
        slot: 'objection',
        facts: { eventDate: calendarDate('2026-11-14') },
      }),
      'unknown_regulation',
    );
  });

  it('fails when the version has no such slot', async () => {
    const deadlines = { ...regulation2016.deadlines };
    delete deadlines.objection;
    const { repositories: withoutSlot } = inMemoryRepositories({
      official: [{ ...regulation2016, deadlines }],
    });
    await expectServiceError(
      createServices({ repositories: withoutSlot }).deadlines.compute({
        regulationId: 'regulation-2016',
        slot: 'objection',
        facts: { eventDate: calendarDate('2026-11-14') },
      }),
      'missing_deadline_slot',
    );
  });
});

describe('regulations.inForceOn with office versions', () => {
  const localDocument = (effectiveFrom: string): RegulationDocument => ({
    ...regulation2016,
    id: 'regulation-2016-local-1',
    effectiveFrom: calendarDate(effectiveFrom),
  });
  const local = (effectiveFrom: string): StoredRegulationVersion => ({
    rowId: 'row-local',
    code: 'regulation-2016-local-1',
    isOfficial: false,
    document: localDocument(effectiveFrom),
  });
  const newerOfficial: RegulationDocument = {
    ...regulation2016,
    id: 'regulation-2030',
    effectiveFrom: calendarDate('2030-01-01'),
  };

  it('inForceOn prefers the office version on a tie', async () => {
    const tie: RegulationDocument = { ...newerOfficial, effectiveFrom: calendarDate('2027-01-01') };
    const { repositories } = inMemoryRepositories({
      official: [regulation2016, tie],
      local: [local('2027-01-01')],
    });
    const services = createServices({ repositories });
    expect((await services.regulations.inForceOn(calendarDate('2027-01-01'))).id).toBe(
      'regulation-2016-local-1',
    );
    expect((await services.regulations.inForceOn(calendarDate('2026-12-31'))).id).toBe(
      regulation2016.id,
    );
  });

  it('a newer official version replaces the office version', async () => {
    const { repositories } = inMemoryRepositories({
      official: [regulation2016, newerOfficial],
      local: [local('2027-01-01')],
    });
    const services = createServices({ repositories });
    expect((await services.regulations.inForceOn(calendarDate('2029-12-31'))).id).toBe(
      'regulation-2016-local-1',
    );
    expect((await services.regulations.inForceOn(calendarDate('2030-01-01'))).id).toBe(
      'regulation-2030',
    );
  });

  it('deadlines compute on an office version by its code', async () => {
    const { repositories } = inMemoryRepositories({
      official: [regulation2016],
      local: [local('2027-01-01')],
    });
    const result = await createServices({ repositories }).deadlines.compute({
      regulationId: 'regulation-2016-local-1',
      slot: 'evaluationDeadline',
      facts: { eventDate: calendarDate('2024-03-16') },
    });
    expect(result).toMatchObject({ kind: 'due' });
  });
});
