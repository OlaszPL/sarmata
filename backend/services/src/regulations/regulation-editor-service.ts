import {
  type CalendarDate,
  type RegulationCase,
  type RegulationCaseResult,
  type RegulationDocument,
  type RegulationGraph,
  RegulationDocumentError,
  calendarDate,
  parseRegulationDocument,
  regulationDocumentSchema,
  regulationGraph,
  runRegulationCases,
} from '@sarmata/domain';
import {
  type LocalRegulationVersion,
  type RegulationDraftRepository,
  type RegulationVersionRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';

export interface RegulationIssue {
  path: (string | number)[];
  message: string;
}

/** What the editor shows next to a document: schema problems and the result of every worked example. */
export interface RegulationCheck {
  issues: RegulationIssue[];
  cases: RegulationCaseResult[];
}

export interface RegulationVersionSummary {
  /** Row id: the key for `get`, `clone`, `saveDraft`, `publish` and `deleteDraft`. */
  id: string;
  /** Document id, e.g. `regulation-2016` or `regulation-2016-local-1`. */
  code: string;
  name: string;
  isOfficial: boolean;
  status: 'draft' | 'published';
  effectiveFrom: string;
  /** Row id of the version this one was cloned from. */
  basedOn: string | null;
  publishedAt: string | null;
}

export interface RegulationVersionDetail extends RegulationVersionSummary {
  document: RegulationDocument;
  graph: RegulationGraph;
  check: RegulationCheck;
  /** Failing examples the admin accepted at publication, null when none failed. */
  acceptedFailingCases: RegulationCaseResult[] | null;
}

export interface PublishInput {
  effectiveFrom: CalendarDate;
  /** Publish although some worked examples fail. The failing results are stored with the version. */
  acceptFailingCases?: boolean;
}

export interface RegulationEditorService {
  /** Official and local versions of the office, without documents. */
  list(): Promise<RegulationVersionSummary[]>;
  get(id: string): Promise<RegulationVersionDetail | null>;
  /** Clones an official or a published local version into a new draft. */
  clone(input: { sourceId: string; name: string }): Promise<RegulationVersionDetail>;
  /** Writes the draft when the document is valid, always returns the check. */
  saveDraft(id: string, document: unknown): Promise<RegulationCheck & { saved: boolean }>;
  publish(id: string, input: PublishInput): Promise<RegulationVersionDetail>;
  deleteDraft(id: string): Promise<void>;
}

export interface RegulationEditorDependencies {
  readonly versions: Pick<RegulationVersionRepository, 'listInForceCandidates'>;
  readonly drafts: RegulationDraftRepository;
  /** Worked examples of the official versions, keyed by document id. */
  readonly officialCases: Readonly<Record<string, readonly RegulationCase[]>>;
  readonly today: () => CalendarDate;
}

interface Known {
  id: string;
  code: string;
  isOfficial: boolean;
  basedOn: string | null;
}

const issuesOf = (error: { issues: readonly { path: PropertyKey[]; message: string }[] }) =>
  error.issues.map((issue): RegulationIssue => ({
    path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
    message: issue.message,
  }));

const summaryOf = (
  id: string,
  document: RegulationDocument,
  rest: Pick<RegulationVersionSummary, 'isOfficial' | 'status' | 'basedOn' | 'publishedAt'>,
): RegulationVersionSummary => ({
  id,
  code: document.id,
  name: document.name,
  effectiveFrom: document.effectiveFrom,
  ...rest,
});

function invalid(issues: RegulationIssue[]): ServiceError {
  return new ServiceError('regulation_invalid', 'The regulation document is invalid', { issues });
}

function wrapWrite(error: unknown): never {
  if (error instanceof RepositoryError) {
    if (error.code === '42501')
      throw new ServiceError('forbidden', 'Not allowed to change versions');
    if (error.code === '23505') {
      throw invalid([
        { path: ['effectiveFrom'], message: 'Another version of the office starts on this date' },
      ]);
    }
  }
  throw error;
}

export function createRegulationEditorService(
  dependencies: RegulationEditorDependencies,
): RegulationEditorService {
  const { versions, drafts, officialCases, today } = dependencies;

  /** Everything the account can see, published or draft: official first, then the local versions. */
  async function load() {
    const [candidates, local] = await Promise.all([
      versions.listInForceCandidates(),
      drafts.listLocal(),
    ]);
    const officials = candidates.filter((candidate) => candidate.isOfficial);
    const known = new Map<string, Known>();
    for (const official of officials) {
      known.set(official.rowId, {
        id: official.rowId,
        code: official.code,
        isOfficial: true,
        basedOn: null,
      });
    }
    for (const version of local) {
      known.set(version.id, {
        id: version.id,
        code: version.code,
        isOfficial: false,
        basedOn: version.basedOn,
      });
    }
    return { candidates, officials, local, known };
  }

  /** The official version a chain of clones starts from. Its worked examples apply to every clone. */
  function rootOf(known: Map<string, Known>, id: string): Known | null {
    let current = known.get(id) ?? null;
    for (let step = 0; current !== null && step < 100; step += 1) {
      if (current.isOfficial) return current;
      current = current.basedOn === null ? null : (known.get(current.basedOn) ?? null);
    }
    return null;
  }

  function casesOf(known: Map<string, Known>, id: string): readonly RegulationCase[] {
    const root = rootOf(known, id);
    return root === null ? [] : (officialCases[root.code] ?? []);
  }

  function checkOf(
    document: RegulationDocument,
    cases: readonly RegulationCase[],
  ): RegulationCheck {
    return { issues: [], cases: runRegulationCases(document, cases) };
  }

  function detailOf(
    summary: RegulationVersionSummary,
    document: RegulationDocument,
    cases: readonly RegulationCase[],
    acceptedFailingCases: RegulationCaseResult[] | null,
  ): RegulationVersionDetail {
    return {
      ...summary,
      document,
      graph: regulationGraph(document),
      check: checkOf(document, cases),
      acceptedFailingCases,
    };
  }

  const localSummary = (version: LocalRegulationVersion) =>
    summaryOf(version.id, version.document, {
      isOfficial: false,
      status: version.status,
      basedOn: version.basedOn,
      publishedAt: version.publishedAt,
    });

  async function draftOf(id: string) {
    const state = await load();
    const version = state.local.find((candidate) => candidate.id === id);
    if (version === undefined)
      throw new ServiceError('not_found', `Regulation version ${id} not found`);
    if (version.status !== 'draft') {
      throw new ServiceError(
        'regulation_not_draft',
        `Regulation version ${version.code} is published and cannot change`,
      );
    }
    return { ...state, version };
  }

  /** The stored document with the identity of its row: `id` is the code, `effectiveFrom` the row date. */
  const withIdentity = (document: unknown, code: string, effectiveFrom: string): unknown => ({
    ...(typeof document === 'object' && document !== null ? document : {}),
    id: code,
    effectiveFrom,
  });

  return {
    async list() {
      const { officials, local } = await load();
      const summaries = [
        ...officials.map((official) =>
          summaryOf(official.rowId, official.document, {
            isOfficial: true,
            status: 'published',
            basedOn: null,
            publishedAt: null,
          }),
        ),
        ...local.map(localSummary),
      ];
      return summaries.sort(
        (a, b) =>
          a.effectiveFrom.localeCompare(b.effectiveFrom) ||
          Number(b.isOfficial) - Number(a.isOfficial),
      );
    },

    async get(id) {
      const { officials, local, known } = await load();
      const cases = casesOf(known, id);
      const official = officials.find((candidate) => candidate.rowId === id);
      if (official !== undefined) {
        return detailOf(
          summaryOf(official.rowId, official.document, {
            isOfficial: true,
            status: 'published',
            basedOn: null,
            publishedAt: null,
          }),
          official.document,
          cases,
          null,
        );
      }
      const version = local.find((candidate) => candidate.id === id);
      if (version === undefined) return null;
      return detailOf(localSummary(version), version.document, cases, version.acceptedFailingCases);
    },

    async clone({ sourceId, name }) {
      const { candidates, local, known } = await load();
      const source = candidates.find((candidate) => candidate.rowId === sourceId);
      if (source === undefined) {
        throw new ServiceError('not_found', `Published regulation version ${sourceId} not found`);
      }
      const root = rootOf(known, sourceId);
      const prefix = `${root?.code ?? source.code}-local-`;
      const taken = new Set(local.map((version) => version.code));
      let number = 1;
      while (taken.has(`${prefix}${number}`)) number += 1;
      const code = `${prefix}${number}`;

      let document: RegulationDocument;
      try {
        document = parseRegulationDocument({
          ...source.document,
          id: code,
          name,
          effectiveFrom: today(),
        });
      } catch (error) {
        if (error instanceof RegulationDocumentError) throw invalid(issuesOf(error));
        throw error;
      }
      let created: LocalRegulationVersion;
      try {
        created = await drafts.createDraft({ code, basedOn: sourceId, document });
      } catch (error) {
        return wrapWrite(error);
      }
      return detailOf(localSummary(created), created.document, casesOf(known, sourceId), null);
    },

    async saveDraft(id, document) {
      const { version, known } = await draftOf(id);
      const result = regulationDocumentSchema.safeParse(
        withIdentity(document, version.code, version.effectiveFrom),
      );
      if (!result.success) return { issues: issuesOf(result.error), cases: [], saved: false };
      let saved: LocalRegulationVersion | null;
      try {
        saved = await drafts.updateDraft(id, result.data);
      } catch (error) {
        return wrapWrite(error);
      }
      if (saved === null) throw new ServiceError('forbidden', 'Not allowed to change versions');
      return { ...checkOf(saved.document, casesOf(known, id)), saved: true };
    },

    async publish(id, input) {
      const { version, known } = await draftOf(id);
      if (input.effectiveFrom < today()) {
        throw invalid([
          { path: ['effectiveFrom'], message: 'The effective date cannot be in the past' },
        ]);
      }
      const result = regulationDocumentSchema.safeParse(
        withIdentity(version.document, version.code, input.effectiveFrom),
      );
      if (!result.success) throw invalid(issuesOf(result.error));
      const cases = casesOf(known, id);
      const check = checkOf(result.data, cases);
      const failing = check.cases.filter((item) => item.status !== 'passed');
      if (failing.length > 0 && input.acceptFailingCases !== true) {
        throw new ServiceError(
          'regulation_cases_failed',
          `${failing.length} worked examples do not pass on this draft`,
          { cases: check.cases },
        );
      }
      let published: LocalRegulationVersion | null;
      try {
        published = await drafts.publish(id, result.data, failing.length > 0 ? failing : undefined);
      } catch (error) {
        return wrapWrite(error);
      }
      if (published === null) throw new ServiceError('forbidden', 'Not allowed to change versions');
      return detailOf(
        localSummary(published),
        published.document,
        cases,
        published.acceptedFailingCases,
      );
    },

    async deleteDraft(id) {
      await draftOf(id);
      let deleted: boolean;
      try {
        deleted = await drafts.deleteDraft(id);
      } catch (error) {
        return wrapWrite(error);
      }
      if (!deleted) throw new ServiceError('forbidden', 'Not allowed to change versions');
    },
  };
}

/** Today as a calendar date in UTC, the default clock of the service. */
export const todayUtc = (): CalendarDate => calendarDate(new Date().toISOString().slice(0, 10));
