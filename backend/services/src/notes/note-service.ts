import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_CHECK_TIMEOUT_MS,
  type NewNoteInput,
  type NotePatch,
  newNoteSchema,
  notePatchSchema,
  type SensitiveDataWarning,
  sensitiveDataWarnings,
} from '@sarmata/domain';
import {
  type AiRun,
  type Note,
  type NoteRepository,
  type NoteVersion,
  RepositoryError,
} from '@sarmata/repositories';
import { z } from 'zod';
import { ServiceError } from '../errors';
import { type AiService } from '../ai/ai-service';

export interface NoteWriteOptions {
  /** Save although the sensitive data guard found something, after the user confirmed the warning. */
  readonly acceptWarnings?: boolean;
}

export { NOTE_CHECK_TIMEOUT_MS };

export interface NoteCheckInput {
  readonly employeeId: string;
  readonly body: string;
}

export type NoteCheckAi =
  | { readonly status: 'disabled' }
  | { readonly status: 'pending'; readonly runId: string }
  | {
      readonly status: 'done';
      readonly runId: string;
      /** Dictionary (keyword) and model warnings merged: the AI task adds `input.keywordWarnings` first. */
      readonly warnings: readonly SensitiveDataWarning[];
      /**
       * The whole note without sensitive data, fragment `rewrite`. Null when there are no warnings or
       * the proposal was dropped as unsafe, then the author rewrites by hand. Deciding the fragment
       * does not change the note, the frontend puts the text into `body` and saves.
       */
      readonly rewrite: string | null;
    }
  | { readonly status: 'unavailable'; readonly runId: string };

export interface NoteCheck {
  /** The dictionary guard, at once. The same check `create`/`update` run. */
  readonly keywordWarnings: readonly SensitiveDataWarning[];
  readonly ai: NoteCheckAi;
}

export interface NoteServiceDependencies {
  readonly notes: NoteRepository;
  readonly ai: Pick<AiService, 'start' | 'get'>;
  /** Clock for the check timeout, `() => new Date()` by default. */
  readonly now?: () => Date;
}

const checkInputSchema = z.strictObject({
  employeeId: z.uuid(),
  body: z.string().trim().min(1).max(NOTE_BODY_MAX_LENGTH),
});

export interface NoteService {
  /** Throws `ZodError` for invalid input and `sensitive_data` (details: the warnings) without a confirmation. */
  create(input: NewNoteInput, options?: NoteWriteOptions): Promise<Note>;
  /** Only the author edits: anybody else gets `forbidden`. The guard runs only when the body changes. */
  update(id: string, patch: NotePatch, options?: NoteWriteOptions): Promise<Note>;
  listForEmployee(employeeId: string): Promise<Note[]>;
  /** Earlier versions and the current one. `not_found` for a note the account cannot see. */
  history(id: string): Promise<NoteVersion[]>;
  /**
   * Before saving: dictionary warnings now and an AI run to poll with `checkResult`. ZodError for
   * invalid input. The user decides about the `rewrite` fragment through `services.ai.decide`.
   */
  check(input: NoteCheckInput): Promise<NoteCheck>;
  /**
   * Poll about once per second until the status is not `pending`. `not_found` for an unknown run or
   * another kind. `unavailable` is final for the UI: stop polling and ignore later results (a timed
   * out run may still finish, and the age compares the server clock with the database `requested_at`).
   */
  checkResult(runId: string): Promise<NoteCheckAi>;
}

function guardSensitiveData(body: string, options: NoteWriteOptions | undefined): void {
  if (options?.acceptWarnings === true) return;
  const warnings = sensitiveDataWarnings(body);
  if (warnings.length > 0) {
    throw new ServiceError(
      'sensitive_data',
      'The note may contain sensitive data, confirm to save it',
      warnings,
    );
  }
}

export function createNoteService(deps: NoteServiceDependencies): NoteService {
  const { notes, ai } = deps;
  const now = deps.now ?? (() => new Date());

  async function checkAi(runId: string): Promise<NoteCheckAi> {
    const run: AiRun = await ai.get(runId);
    if (run.kind !== 'sensitive_data') {
      throw new ServiceError('not_found', `Check ${runId} not found`);
    }
    if (run.status === 'failed') {
      return run.failure?.reason === 'disabled'
        ? { status: 'disabled' }
        : { status: 'unavailable', runId };
    }
    if (run.status === 'done') {
      if (run.output === null) return { status: 'unavailable', runId };
      return {
        status: 'done',
        runId,
        warnings: run.output.warnings,
        rewrite: run.output.rewrite,
      };
    }
    const age = now().getTime() - new Date(run.requestedAt).getTime();
    return age > NOTE_CHECK_TIMEOUT_MS
      ? { status: 'unavailable', runId }
      : { status: 'pending', runId };
  }

  return {
    async create(input, options) {
      const note = newNoteSchema.parse(input);
      guardSensitiveData(note.body, options);
      try {
        return await notes.create(note);
      } catch (error) {
        if (error instanceof RepositoryError && error.code === '42501') {
          throw new ServiceError('forbidden', 'This account cannot add notes');
        }
        throw error;
      }
    },

    async update(id, patch, options) {
      const parsed = notePatchSchema.parse(patch);
      if (Object.keys(parsed).length === 0) {
        const current = await notes.get(id);
        if (current === null) throw new ServiceError('not_found', `Note ${id} not found`);
        return current;
      }
      if (parsed.body !== undefined) guardSensitiveData(parsed.body, options);
      const updated = await notes.update(id, parsed);
      if (updated === null) {
        throw new ServiceError('forbidden', 'Only the author can change a note');
      }
      return updated;
    },

    listForEmployee: (employeeId) => notes.listForEmployee(employeeId),

    async history(id) {
      const versions = await notes.versions(id);
      if (versions.length === 0) throw new ServiceError('not_found', `Note ${id} not found`);
      return versions;
    },

    async check(input) {
      const { employeeId, body } = checkInputSchema.parse(input);
      const keywordWarnings = sensitiveDataWarnings(body);
      try {
        const run = await ai.start({ kind: 'sensitive_data', employeeId, text: body });
        return { keywordWarnings, ai: { status: 'pending', runId: run.id } };
      } catch (error) {
        if (error instanceof ServiceError && error.code === 'ai_disabled') {
          return { keywordWarnings, ai: { status: 'disabled' } };
        }
        throw error;
      }
    },

    checkResult: (runId) => checkAi(runId),
  };
}
