import {
  type CalendarDate,
  type NewNoteInput,
  type NoteKind,
  type NotePatch,
  type NoteSign,
  calendarDate,
} from '@sarmata/domain';
import { type Db } from './db';
import { readAccountClaims } from './auth';
import { RepositoryError } from './errors';

/** Notatka: an observation, conversation, appreciation or workload fact about an employee. */
export interface Note {
  readonly id: string;
  readonly officeId: string;
  readonly employeeId: string;
  readonly authorAccountId: string;
  readonly kind: NoteKind;
  readonly occurredOn: CalendarDate;
  readonly criterionId: string | null;
  readonly sign: NoteSign | null;
  readonly communicated: boolean;
  readonly body: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Wersja notatki: the content between two edits. `validTo` is null for the current one. */
export type NoteVersion = Pick<
  Note,
  'version' | 'kind' | 'occurredOn' | 'criterionId' | 'sign' | 'communicated' | 'body'
> & { readonly validFrom: string; readonly validTo: string | null };

export interface NoteRepository {
  /** The office and the author come from the signed-in account (evaluator or hr). */
  create(input: NewNoteInput): Promise<Note>;
  /** `null` when access rules do not allow the change (only the author edits). */
  update(id: string, patch: NotePatch): Promise<Note | null>;
  /** `null` for a note that does not exist or is not visible. */
  get(id: string): Promise<Note | null>;
  /** Newest occurrence first, then newest entry first. */
  listForEmployee(employeeId: string): Promise<Note[]>;
  /** Notes the signed-in account wrote (kadry can read all notes, this keeps only their own). */
  listMine(): Promise<Note[]>;
  /** Earlier versions and the current one, oldest first. Empty for a note that is not visible. */
  versions(id: string): Promise<NoteVersion[]>;
}

const COLUMNS =
  'id, office_id, employee_id, author_account_id, kind, occurred_on, criterion_id, sign, communicated, body, version, created_at, updated_at' as const;

const VERSION_COLUMNS =
  'version, kind, occurred_on, criterion_id, sign, communicated, body, valid_from, valid_to' as const;

const asSign = (value: string | null): NoteSign | null =>
  value === 'plus' || value === 'minus' ? value : null;

interface NoteRow {
  id: string;
  office_id: string;
  employee_id: string;
  author_account_id: string;
  kind: NoteKind;
  occurred_on: string;
  criterion_id: string | null;
  sign: string | null;
  communicated: boolean;
  body: string;
  version: number;
  created_at: string;
  updated_at: string;
}

const toNote = (row: NoteRow): Note => ({
  id: row.id,
  officeId: row.office_id,
  employeeId: row.employee_id,
  authorAccountId: row.author_account_id,
  kind: row.kind,
  occurredOn: calendarDate(row.occurred_on),
  criterionId: row.criterion_id,
  sign: asSign(row.sign),
  communicated: row.communicated,
  body: row.body,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

interface NoteColumns {
  kind?: NoteKind;
  occurred_on?: string;
  criterion_id?: string | null;
  sign?: NoteSign | null;
  communicated?: boolean;
  body?: string;
}

/** Column values of the fields present in the patch, absent keys stay untouched. */
function toColumns(patch: NotePatch): NoteColumns {
  const columns: NoteColumns = {};
  if (patch.kind !== undefined) columns.kind = patch.kind;
  if (patch.occurredOn !== undefined) columns.occurred_on = patch.occurredOn;
  if (patch.criterionId !== undefined) columns.criterion_id = patch.criterionId;
  if (patch.sign !== undefined) columns.sign = patch.sign;
  if (patch.communicated !== undefined) columns.communicated = patch.communicated;
  if (patch.body !== undefined) columns.body = patch.body;
  return columns;
}

export function createNoteRepository(db: Db): NoteRepository {
  return {
    async create(input) {
      const { data, error } = await db
        .from('notes')
        .insert({
          employee_id: input.employeeId,
          kind: input.kind,
          occurred_on: input.occurredOn,
          criterion_id: input.criterionId ?? null,
          sign: input.sign,
          communicated: input.communicated ?? false,
          body: input.body,
        })
        .select(COLUMNS)
        .single();
      if (error) throw new RepositoryError('notes.create', error);
      return toNote(data);
    },

    async update(id, patch) {
      const { data, error } = await db
        .from('notes')
        .update(toColumns(patch))
        .eq('id', id)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw new RepositoryError('notes.update', error);
      return data === null ? null : toNote(data);
    },

    async get(id) {
      const { data, error } = await db.from('notes').select(COLUMNS).eq('id', id).maybeSingle();
      if (error) throw new RepositoryError('notes.get', error);
      return data === null ? null : toNote(data);
    },

    async listForEmployee(employeeId) {
      const { data, error } = await db
        .from('notes')
        .select(COLUMNS)
        .eq('employee_id', employeeId)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw new RepositoryError('notes.listForEmployee', error);
      return data.map(toNote);
    },

    async listMine() {
      const claims = await readAccountClaims(db);
      const accountId = claims?.sub;
      if (typeof accountId !== 'string') return [];
      const { data, error } = await db
        .from('notes')
        .select(COLUMNS)
        .eq('author_account_id', accountId)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw new RepositoryError('notes.listMine', error);
      return data.map(toNote);
    },

    async versions(id) {
      const { data: current, error: currentError } = await db
        .from('notes')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (currentError) throw new RepositoryError('notes.versions', currentError);
      if (current === null) return [];
      const { data, error } = await db
        .from('note_versions')
        .select(VERSION_COLUMNS)
        .eq('note_id', id)
        .order('version');
      if (error) throw new RepositoryError('notes.versions', error);
      const earlier: NoteVersion[] = data.map((row) => ({
        version: row.version,
        kind: row.kind,
        occurredOn: calendarDate(row.occurred_on),
        criterionId: row.criterion_id,
        sign: asSign(row.sign),
        communicated: row.communicated,
        body: row.body,
        validFrom: row.valid_from,
        validTo: row.valid_to,
      }));
      return [
        ...earlier,
        {
          version: current.version,
          kind: current.kind,
          occurredOn: calendarDate(current.occurred_on),
          criterionId: current.criterion_id,
          sign: asSign(current.sign),
          communicated: current.communicated,
          body: current.body,
          validFrom: current.updated_at,
          validTo: null,
        },
      ];
    },
  };
}
