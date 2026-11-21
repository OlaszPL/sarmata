import {
  type NewNoteInput,
  type NotePatch,
  newNoteSchema,
  notePatchSchema,
  sensitiveDataWarnings,
} from '@sarmata/domain';
import {
  type Note,
  type NoteRepository,
  type NoteVersion,
  RepositoryError,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';

export interface NoteWriteOptions {
  /** Save although the sensitive data guard found something, after the user confirmed the warning. */
  readonly acceptWarnings?: boolean;
}

export interface NoteService {
  /** Throws `ZodError` for invalid input and `sensitive_data` (details: the warnings) without a confirmation. */
  create(input: NewNoteInput, options?: NoteWriteOptions): Promise<Note>;
  /** Only the author edits: anybody else gets `forbidden`. The guard runs only when the body changes. */
  update(id: string, patch: NotePatch, options?: NoteWriteOptions): Promise<Note>;
  listForEmployee(employeeId: string): Promise<Note[]>;
  /** Earlier versions and the current one. `not_found` for a note the account cannot see. */
  history(id: string): Promise<NoteVersion[]>;
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

export function createNoteService(notes: NoteRepository): NoteService {
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
  };
}
