import { type RegulationDocument, calendarDate } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import {
  type Employee,
  type OfficialRegulationWriter,
  type Repositories,
} from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { ServiceError, createServices } from './index';
import { syncOfficialRegulations } from './system';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');

function inMemoryRepositories(seed: { employees?: Employee[]; official?: RegulationDocument[] }) {
  const official = [...(seed.official ?? [])];
  const inserted: string[] = [];
  const repositories: Repositories = {
    employees: { list: () => Promise.resolve([...(seed.employees ?? [])]) },
    regulationVersions: {
      listOfficial: () => Promise.resolve([...official]),
      findOfficialById: (id) =>
        Promise.resolve(official.find((document) => document.id === id) ?? null),
    },
  };
  const writer: OfficialRegulationWriter = {
    insertOfficial: (document) => {
      official.push(document);
      inserted.push(document.id);
      return Promise.resolve();
    },
  };
  return { repositories, writer, inserted };
}

const expectServiceError = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(ServiceError);
  await expect(promise).rejects.toMatchObject({ code });
};

describe('employees.list', () => {
  it('returns the employees from the repository', async () => {
    const employee: Employee = {
      id: 'e1',
      officeId: 'o1',
      firstName: 'Ewa',
      lastName: 'Ewidencyjna',
      email: null,
      userId: null,
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
