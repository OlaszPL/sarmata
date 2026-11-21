import { type RegulationDocument, calendarDate } from '@sarmata/domain';
import { officialCases, officialRegulations } from '@sarmata/regulations';
import {
  type LocalRegulationVersion,
  type RegulationDraftRepository,
  type StoredRegulationVersion,
  RepositoryError,
} from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { ServiceError } from '../errors';
import { createRegulationEditorService } from './regulation-editor-service';

const [officialOrNothing] = officialRegulations;
if (officialOrNothing === undefined) throw new Error('The official regulation catalog is empty');
const official: RegulationDocument = officialOrNothing;
const OFFICIAL_ROW = 'row-official';
const today = calendarDate('2026-11-21');

function setup(options: { denyWrites?: boolean; publishFailure?: RepositoryError } = {}) {
  const rows = new Map<string, LocalRegulationVersion>();
  let counter = 0;
  const stored: StoredRegulationVersion = {
    rowId: OFFICIAL_ROW,
    code: official.id,
    isOfficial: true,
    document: official,
  };
  const published = () => [...rows.values()].filter((row) => row.status === 'published');
  const drafts: RegulationDraftRepository = {
    listLocal: () => Promise.resolve([...rows.values()]),
    createDraft: ({ code, basedOn, document }) => {
      counter += 1;
      const row: LocalRegulationVersion = {
        id: `row-${String(counter)}`,
        code,
        status: 'draft',
        basedOn,
        effectiveFrom: document.effectiveFrom,
        publishedAt: null,
        acceptedFailingCases: null,
        document,
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    },
    updateDraft: (id, document) => {
      const row = rows.get(id);
      if (row?.status !== 'draft' || options.denyWrites === true) {
        return Promise.resolve(null);
      }
      const next = { ...row, document, effectiveFrom: document.effectiveFrom };
      rows.set(id, next);
      return Promise.resolve(next);
    },
    publish: (id, document, accepted) => {
      if (options.publishFailure !== undefined) return Promise.reject(options.publishFailure);
      const row = rows.get(id);
      if (row?.status !== 'draft') return Promise.resolve(null);
      if (published().some((other) => other.effectiveFrom === document.effectiveFrom)) {
        return Promise.reject(
          new RepositoryError('publish', { message: 'duplicate', code: '23505' }),
        );
      }
      const next: LocalRegulationVersion = {
        ...row,
        status: 'published',
        document,
        effectiveFrom: document.effectiveFrom,
        publishedAt: '2026-11-21T10:00:00Z',
        acceptedFailingCases: accepted === undefined ? null : [...accepted],
      };
      rows.set(id, next);
      return Promise.resolve(next);
    },
    deleteDraft: (id) => Promise.resolve(rows.delete(id)),
  };
  const service = createRegulationEditorService({
    versions: {
      listInForceCandidates: () => Promise.resolve([stored, ...published().map(toStored)]),
    },
    drafts,
    officialCases,
    today: () => today,
  });
  return { service, rows };
}

const toStored = (row: LocalRegulationVersion): StoredRegulationVersion => ({
  rowId: row.id,
  code: row.code,
  isOfficial: false,
  document: row.document,
});

const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(ServiceError);
  await expect(promise).rejects.toMatchObject({ code });
};

/** The document with the evaluation deadline cut from 24 to 12 months, as a plain JSON object. */
function twelveMonths(document: RegulationDocument): unknown {
  const draft = JSON.parse(JSON.stringify(document)) as RegulationDocument;
  const rule = draft.deadlines.evaluationDeadline;
  if (rule?.strategy !== 'monthsFromEvent') throw new Error('unexpected strategy');
  rule.months = 12;
  return draft;
}

describe('regulation editor', () => {
  it('list shows official and local versions without documents', async () => {
    const { service } = setup();
    await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    const list = await service.list();
    expect(list.map((item) => [item.code, item.status, item.isOfficial])).toEqual([
      ['regulation-2016', 'published', true],
      ['regulation-2016-local-1', 'draft', false],
    ]);
    expect(list[0]).not.toHaveProperty('document');
    expect(list.map((item) => item.inForce)).toEqual([true, false]);
  });

  it('clone of an official version makes a draft with a graph and passing cases', async () => {
    const { service } = setup();
    const detail = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Przepisy urzędu' });
    expect(detail).toMatchObject({
      code: 'regulation-2016-local-1',
      name: 'Przepisy urzędu',
      status: 'draft',
      effectiveFrom: today,
      basedOn: OFFICIAL_ROW,
    });
    expect(detail.graph.nodes.length).toBeGreaterThan(10);
    expect(detail.check.cases.length).toBeGreaterThan(0);
    expect(detail.check.cases.every((item) => item.status === 'passed')).toBe(true);
    expect(await service.get(detail.id)).toMatchObject({ code: detail.code });
  });

  it('clone of a local version runs the official root cases', async () => {
    const { service } = setup();
    const first = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Pierwszy' });
    await service.publish(first.id, { effectiveFrom: calendarDate('2027-01-01') });
    const second = await service.clone({ sourceId: first.id, name: 'Drugi' });
    expect(second.code).toBe('regulation-2016-local-2');
    expect(second.check.cases.length).toBe(officialCases['regulation-2016']?.length);
  });

  it('clone of a draft fails not_found', async () => {
    const { service } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await expectCode(service.clone({ sourceId: draft.id, name: 'Kopia' }), 'not_found');
  });

  it('invalid document is not saved and returns paths', async () => {
    const { service, rows } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    const broken = JSON.parse(JSON.stringify(draft.document)) as RegulationDocument;
    const second = broken.overallLevel.bands[1];
    if (second === undefined) throw new Error('missing band');
    second.min = second.min + 0.5;
    const result = await service.saveDraft(draft.id, broken);
    expect(result.saved).toBe(false);
    expect(result.issues.map((issue) => issue.path.join('.'))).toContain(
      'overallLevel.bands.1.min',
    );
    expect(rows.get(draft.id)?.document).toEqual(draft.document);
  });

  it('a valid change is saved and failing cases are reported with expected and actual', async () => {
    const { service, rows } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    const result = await service.saveDraft(draft.id, twelveMonths(draft.document));
    expect(result.saved).toBe(true);
    const failed = result.cases.filter((item) => item.status === 'failed');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]).toMatchObject({
      expected: expect.anything() as unknown,
      actual: expect.anything() as unknown,
    });
    const stored = rows.get(draft.id)?.document.deadlines.evaluationDeadline;
    expect(stored).toMatchObject({ months: 12 });
  });

  it('saveDraft keeps the code and the date of the row whatever the client sends', async () => {
    const { service } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    const changed = {
      ...(draft.document as object),
      id: 'other-code',
      effectiveFrom: '2001-01-01',
    };
    const result = await service.saveDraft(draft.id, changed);
    expect(result.saved).toBe(true);
    expect((await service.get(draft.id))?.document).toMatchObject({
      id: 'regulation-2016-local-1',
      effectiveFrom: today,
    });
  });

  it('saveDraft without write access is forbidden', async () => {
    const { service } = setup({ denyWrites: true });
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await expectCode(service.saveDraft(draft.id, draft.document), 'forbidden');
  });

  it('publish refuses failing cases without the flag', async () => {
    const { service } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await service.saveDraft(draft.id, twelveMonths(draft.document));
    const attempt = service.publish(draft.id, { effectiveFrom: calendarDate('2027-01-01') });
    await expectCode(attempt, 'regulation_cases_failed');
    await expect(attempt).rejects.toMatchObject({
      details: {
        cases: expect.arrayContaining([expect.objectContaining({ status: 'failed' })]) as unknown,
      },
    });
  });

  it('publish with the flag writes the effective date into the document and stores the accepted cases', async () => {
    const { service } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await service.saveDraft(draft.id, twelveMonths(draft.document));
    const published = await service.publish(draft.id, {
      effectiveFrom: calendarDate('2027-01-01'),
      acceptFailingCases: true,
    });
    expect(published).toMatchObject({ status: 'published', effectiveFrom: '2027-01-01' });
    expect(published.document.effectiveFrom).toBe('2027-01-01');
    expect(published.acceptedFailingCases?.length).toBeGreaterThan(0);
    expect(published.acceptedFailingCases?.every((item) => item.status !== 'passed')).toBe(true);
  });

  it('publish of a clean draft stores no accepted cases', async () => {
    const { service } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    const published = await service.publish(draft.id, {
      effectiveFrom: calendarDate('2027-01-01'),
    });
    expect(published.acceptedFailingCases).toBeNull();
  });

  it('publish with a past date fails regulation_invalid', async () => {
    const { service } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    const attempt = service.publish(draft.id, { effectiveFrom: calendarDate('2026-11-20') });
    await expectCode(attempt, 'regulation_invalid');
    await expect(attempt).rejects.toMatchObject({
      details: { issues: [{ path: ['effectiveFrom'], message: expect.any(String) as unknown }] },
    });
  });

  it('a trigger refusal (P0001) maps to a regulation error and not to a raw RepositoryError', async () => {
    const past = setup({
      publishFailure: new RepositoryError('publish', {
        message: 'effective date 2026-11-20 of regulation version x is in the past',
        code: 'P0001',
      }),
    });
    const draft = await past.service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await expectCode(
      past.service.publish(draft.id, { effectiveFrom: calendarDate('2027-01-01') }),
      'regulation_invalid',
    );
    const frozen = setup({
      publishFailure: new RepositoryError('publish', {
        message: 'published regulation version x is immutable',
        code: 'P0001',
      }),
    });
    const other = await frozen.service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await expectCode(
      frozen.service.publish(other.id, { effectiveFrom: calendarDate('2027-01-01') }),
      'regulation_not_draft',
    );
  });

  it('publish on a date taken by another published version fails regulation_invalid', async () => {
    const { service } = setup();
    const first = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Pierwszy' });
    await service.publish(first.id, { effectiveFrom: calendarDate('2027-01-01') });
    const second = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Drugi' });
    await expectCode(
      service.publish(second.id, { effectiveFrom: calendarDate('2027-01-01') }),
      'regulation_invalid',
    );
  });

  it('publish of a published version fails regulation_not_draft', async () => {
    const { service } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await service.publish(draft.id, { effectiveFrom: calendarDate('2027-01-01') });
    await expectCode(
      service.publish(draft.id, { effectiveFrom: calendarDate('2027-02-01') }),
      'regulation_not_draft',
    );
    await expectCode(service.saveDraft(draft.id, draft.document), 'regulation_not_draft');
    await expectCode(service.deleteDraft(draft.id), 'regulation_not_draft');
  });

  it('deleteDraft removes a draft and unknown ids are not_found', async () => {
    const { service, rows } = setup();
    const draft = await service.clone({ sourceId: OFFICIAL_ROW, name: 'Szkic' });
    await service.deleteDraft(draft.id);
    expect(rows.size).toBe(0);
    await expectCode(service.deleteDraft('nope'), 'not_found');
    expect(await service.get('nope')).toBeNull();
  });
});
