import {
  type AiInput,
  type AiInputRefs,
  type AiRequest,
  type AiRunKind,
  type CriterionFact,
  type NoteFact,
  type RegulationDocument,
  fitNotesToBudget,
  sensitiveDataWarnings,
  versionInForce,
} from '@sarmata/domain';
import {
  type AiRunRepository,
  type Note,
  type NoteRepository,
  type OfficeSettings,
  type RegulationVersionRepository,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';
import { type EvaluationService, type EvaluationView } from '../evaluations/evaluation-service';

/** Where the input snapshot comes from: repositories on the client of the user, so RLS applies. */
export interface AiInputSources {
  readonly runs: AiRunRepository;
  readonly notes: NoteRepository;
  readonly evaluations: EvaluationService;
  readonly regulations: RegulationVersionRepository;
  readonly settings: OfficeSettings;
}

export interface BuiltAiInput<K extends AiRunKind = AiRunKind> {
  readonly employeeId: string | null;
  readonly evaluationId: string | null;
  readonly input: AiInput<K>;
  readonly inputRefs: AiInputRefs;
}

const toFact = (note: Note): NoteFact => ({
  id: note.id,
  version: note.version,
  kind: note.kind,
  occurredOn: note.occurredOn,
  criterionId: note.criterionId,
  sign: note.sign,
  communicated: note.communicated,
  body: note.body,
});

function criterionFacts(regulation: RegulationDocument, ids: readonly string[]): CriterionFact[] {
  return ids.flatMap((id) => {
    const criterion = regulation.criteria.catalog.find((candidate) => candidate.id === id);
    return criterion === undefined
      ? []
      : [{ id: criterion.id, name: criterion.name, indicators: criterion.indicators }];
  });
}

export function buildAiInput(request: AiRequest, sources: AiInputSources): Promise<BuiltAiInput> {
  async function evaluation(id: string): Promise<EvaluationView> {
    const found = await sources.evaluations.get(id);
    if (found === null) throw new ServiceError('not_found', `Evaluation ${id} not found`);
    return found;
  }

  async function regulationOf(id: string): Promise<RegulationDocument> {
    const regulation = await sources.regulations.findOfficialById(id);
    if (regulation === null) {
      throw new ServiceError('unknown_regulation', `Unknown regulation version ${id}`);
    }
    return regulation;
  }

  /** Notes of the employee within the budget: the newest stay, the ids of the rest are listed. */
  async function notesOf(employeeId: string) {
    const { kept, droppedIds } = fitNotesToBudget(
      (await sources.notes.listForEmployee(employeeId)).map(toFact),
    );
    return {
      notes: kept,
      refs: {
        noteIds: kept.map((note) => ({ id: note.id, version: note.version })),
        droppedNoteIds: droppedIds,
      },
    };
  }

  const noRefs: AiInputRefs = { noteIds: [], droppedNoteIds: [] };

  async function build(): Promise<BuiltAiInput> {
    switch (request.kind) {
      case 'sheet_draft': {
        const view = await evaluation(request.evaluationId);
        const regulation = await regulationOf(view.regulationId);
        const { notes, refs } = await notesOf(view.employeeId);
        return {
          employeeId: view.employeeId,
          evaluationId: view.id,
          input: {
            sheetId: view.sheetId,
            criteria: criterionFacts(regulation, view.criteria),
            scale: regulation.partialScale.levels.map((level) => ({
              points: level.points,
              name: level.name,
            })),
            notes,
          },
          inputRefs: { ...refs, sheetVersion: view.sheet.version, regulationId: regulation.id },
        };
      }
      case 'quality_check': {
        const view = await evaluation(request.evaluationId);
        const regulation = await regulationOf(view.regulationId);
        const criterion =
          request.criterionId === null
            ? null
            : (criterionFacts(regulation, [request.criterionId])[0] ?? null);
        return {
          employeeId: view.employeeId,
          evaluationId: view.id,
          input: { text: request.text, criterion },
          inputRefs: { ...noRefs, sheetVersion: view.sheet.version, regulationId: regulation.id },
        };
      }
      case 'sensitive_data':
        return {
          employeeId: request.employeeId,
          evaluationId: null,
          input: { text: request.text, keywordWarnings: sensitiveDataWarnings(request.text) },
          inputRefs: noRefs,
        };
      case 'conversation_prep': {
        let criteria: CriterionFact[];
        let regulationId: string;
        let sheetVersion: number | undefined;
        if (request.evaluationId === undefined) {
          // Without an evaluation the whole catalog of the newest official version.
          const regulation = (await sources.regulations.listOfficial()).at(-1);
          if (regulation === undefined) {
            throw new ServiceError('no_regulation_in_force', 'No official regulation version');
          }
          criteria = criterionFacts(
            regulation,
            regulation.criteria.catalog.map((criterion) => criterion.id),
          );
          regulationId = regulation.id;
        } else {
          const view = await evaluation(request.evaluationId);
          const regulation = await regulationOf(view.regulationId);
          criteria = criterionFacts(regulation, view.criteria);
          regulationId = regulation.id;
          sheetVersion = view.sheet.version;
        }
        const { notes, refs } = await notesOf(request.employeeId);
        const latestSignals = (
          await sources.runs.list({
            employeeId: request.employeeId,
            kind: 'hr_signals',
            status: 'done',
          })
        ).find((run) => run.kind === 'hr_signals' && run.output !== null);
        const signals = latestSignals?.kind === 'hr_signals' ? latestSignals.output : null;
        return {
          employeeId: request.employeeId,
          evaluationId: request.evaluationId ?? null,
          input: { conversation: request.conversation, criteria, notes, signals },
          inputRefs: {
            ...refs,
            regulationId,
            ...(sheetVersion === undefined ? {} : { sheetVersion }),
            ...(latestSignals === undefined ? {} : { signalsRunId: latestSignals.id }),
          },
        };
      }
      case 'criteria_proposals': {
        const view = await evaluation(request.evaluationId);
        const regulation = await regulationOf(view.regulationId);
        const sheet = regulation.sheets.find((candidate) => candidate.id === view.sheetId);
        const mandatory = sheet?.mandatoryCriteria ?? [];
        const candidates = regulation.criteria.catalog
          .map((criterion) => criterion.id)
          .filter(
            (id) => regulation.additionalCriteria.fromMandatoryAllowed || !mandatory.includes(id),
          );
        return {
          employeeId: view.employeeId,
          evaluationId: view.id,
          input: {
            duties: request.duties,
            mandatory: criterionFacts(regulation, mandatory),
            candidates: criterionFacts(regulation, candidates),
            maxAdditional: regulation.additionalCriteria.max,
          },
          inputRefs: { ...noRefs, sheetVersion: view.sheet.version, regulationId: regulation.id },
        };
      }
      case 'appreciation_moments': {
        const { notes, refs } = await notesOf(request.employeeId);
        return {
          employeeId: request.employeeId,
          evaluationId: null,
          input: { today: request.today, gapDays: sources.settings.appreciationGapDays, notes },
          inputRefs: refs,
        };
      }
      case 'hr_signals': {
        const { notes, refs } = await notesOf(request.employeeId);
        const closed = await sources.evaluations.list({
          employeeId: request.employeeId,
          status: 'closed',
        });
        const views = await Promise.all(closed.map((entry) => sources.evaluations.get(entry.id)));
        const pastRatings = views
          .filter((view) => view !== null)
          .map((view) => ({
            evaluationId: view.id,
            cycleStart: view.cycleStart,
            ratings: view.sheet.content.partTwo.ratings,
          }))
          .sort((a, b) => a.cycleStart.localeCompare(b.cycleStart));
        return {
          employeeId: request.employeeId,
          evaluationId: null,
          input: { notes, pastRatings },
          inputRefs: refs,
        };
      }
      case 'procedure_question': {
        let regulation: RegulationDocument | null;
        if (request.evaluationId === undefined) {
          regulation = versionInForce(await sources.regulations.listOfficial(), request.today);
        } else {
          regulation = await regulationOf((await evaluation(request.evaluationId)).regulationId);
        }
        if (regulation === null) {
          throw new ServiceError(
            'no_regulation_in_force',
            `No regulation version is in force on ${request.today}`,
          );
        }
        return {
          employeeId: null,
          evaluationId: request.evaluationId ?? null,
          input: {
            question: request.question,
            today: request.today,
            regulationId: regulation.id,
            corpus: regulation.sources.map((source) => ({
              sourceId: source.id,
              title: source.title,
              citation: source.citation,
              path: source.text,
            })),
          },
          inputRefs: { ...noRefs, regulationId: regulation.id },
        };
      }
    }
  }

  return build();
}
