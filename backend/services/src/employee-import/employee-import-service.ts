import { employeePatchSchema, newEmployeeSchema } from '@sarmata/domain';
import type { Employee, EmployeeRepository, SimilarEmployee } from '@sarmata/repositories';
import type { ZodError } from 'zod';
import { ServiceError } from '../errors';
import { type CsvDelimiter, parseCsv } from './csv';

/** Employee fields a CSV column can fill. `supervisorEmployeeId` is never proposed: hr must map it explicitly. */
export const importFields = [
  'firstName',
  'lastName',
  'email',
  'positionTitle',
  'orgUnit',
  'positionKind',
  'serviceStatus',
  'employmentBasis',
  'employmentStart',
  'appointmentYear',
  'grade',
  'gradeGrantedOn',
  'supervisorEmployeeId',
] as const;

export type ImportField = (typeof importFields)[number];

/** Field to the header of the CSV column that fills it. Unmapped fields are left out. */
export type ColumnMapping = Partial<Record<ImportField, string>>;

export interface MappingProposal {
  readonly delimiter: CsvDelimiter;
  readonly headers: string[];
  readonly mapping: ColumnMapping;
  /** Required fields (first and last name) that no header matched. */
  readonly missing: ImportField[];
}

export interface RowError {
  readonly field: ImportField | null;
  readonly message: string;
}

export type RowMatch =
  | { readonly kind: 'email'; readonly employeeId: string }
  | { readonly kind: 'similar'; readonly candidates: SimilarEmployee[] }
  | { readonly kind: 'none' };

export interface RowPreview {
  /** Number of the data row, from 1 (the line of the file is `row + 1`). */
  readonly row: number;
  /** Parsed values of the mapped, non-empty cells. */
  readonly values: Record<string, unknown>;
  readonly errors: RowError[];
  readonly match: RowMatch;
  /**
   * `update`: an employee with this e-mail exists. `create`: nobody similar. `needs_decision`: similar names,
   * hr decides (nothing is merged automatically). `invalid`: the row has errors and is not imported.
   */
  readonly proposedAction: 'create' | 'update' | 'needs_decision' | 'invalid';
}

export interface ImportPreview {
  readonly rows: RowPreview[];
  readonly summary: Record<RowPreview['proposedAction'], number>;
}

/** Hr's decision for a row that needs one. `{ updateEmployeeId }` merges the row into an existing employee. */
export type RowDecision = 'create' | 'skip' | { readonly updateEmployeeId: string };

export interface ImportReport {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  /** Rows with similar names and no decision: not written. */
  readonly undecided: number[];
  /** Invalid rows and rows the database refused. */
  readonly failed: { readonly row: number; readonly message: string }[];
}

export interface EmployeeImportService {
  /** Proposes which column fills which field from the headers. Pure, writes nothing. */
  proposeMapping(csv: string): MappingProposal;
  /** Dry run: parses and validates every row and finds matches. Writes nothing. Hr only. */
  dryRun(csv: string, mapping: ColumnMapping): Promise<ImportPreview>;
  /**
   * Imports the rows. Each row is written on its own (no all or nothing): a refused row is reported in
   * `failed` and the rest goes on. Rows are matched by e-mail, so a re-import updates instead of duplicating.
   * Only mapped, non-empty cells overwrite existing data, so the supervisor tree stays untouched unless
   * `supervisorEmployeeId` is mapped. Throws `forbidden` for a role other than hr.
   */
  commit(
    csv: string,
    mapping: ColumnMapping,
    decisions?: Readonly<Record<number, RowDecision>>,
  ): Promise<ImportReport>;
}

export interface EmployeeImportDependencies {
  readonly employees: Pick<EmployeeRepository, 'list' | 'create' | 'update' | 'findSimilar'>;
  /** Role of the signed-in account in its office, `null` without one. */
  readonly role: () => Promise<string | null>;
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replaceAll('ł', 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const HEADER_NAMES: Record<Exclude<ImportField, 'supervisorEmployeeId'>, string[]> = {
  firstName: ['imie', 'imiona', 'first name', 'firstname', 'given name'],
  lastName: ['nazwisko', 'last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'e mail', 'adres e mail', 'mail', 'adres email'],
  positionTitle: ['stanowisko', 'position', 'position title', 'job title'],
  orgUnit: ['komorka', 'komorka organizacyjna', 'org unit', 'unit', 'department', 'dzial', 'biuro'],
  positionKind: ['rodzaj stanowiska', 'position kind', 'kind'],
  serviceStatus: ['status', 'status sluzby', 'service status', 'urzednik'],
  employmentBasis: ['stosunek pracy', 'typ stosunku', 'rodzaj stosunku', 'employment basis'],
  employmentStart: [
    'data nawiazania stosunku',
    'data zatrudnienia',
    'poczatek zatrudnienia',
    'employment start',
    'start date',
  ],
  appointmentYear: ['rok mianowania', 'appointment year'],
  grade: ['stopien', 'stopien sluzbowy', 'grade'],
  gradeGrantedOn: ['data przyznania stopnia', 'data stopnia', 'grade granted on'],
};

export function proposeColumnMapping(headers: readonly string[]): {
  mapping: ColumnMapping;
  missing: ImportField[];
} {
  const byName = new Map<string, string>();
  for (const header of headers) {
    const key = normalize(header);
    if (!byName.has(key)) byName.set(key, header);
  }
  const mapping: ColumnMapping = {};
  for (const [field, names] of Object.entries(HEADER_NAMES) as [ImportField, string[]][]) {
    const header = names.map((name) => byName.get(name)).find((found) => found !== undefined);
    if (header !== undefined) mapping[field] = header;
  }
  const missing = (['firstName', 'lastName'] as const).filter(
    (field) => mapping[field] === undefined,
  );
  return { mapping, missing };
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'];

const ENUM_VALUES: Partial<Record<ImportField, Record<string, string>>> = {
  positionKind: {
    office_head: 'office_head',
    'kierownik urzedu': 'office_head',
    a: 'office_head',
    manages_people: 'manages_people',
    'kieruje ludzmi': 'manages_people',
    'kieruje zespolem': 'manages_people',
    b: 'manages_people',
    other: 'other',
    pozostale: 'other',
    pozostali: 'other',
    c: 'other',
  },
  serviceStatus: {
    civil_servant: 'civil_servant',
    urzednik: 'civil_servant',
    'urzednik sc': 'civil_servant',
    employee: 'employee',
    pracownik: 'employee',
    'pracownik sc': 'employee',
  },
  employmentBasis: {
    indefinite: 'indefinite',
    'czas nieokreslony': 'indefinite',
    'umowa na czas nieokreslony': 'indefinite',
    appointment: 'appointment',
    mianowanie: 'appointment',
    fixed_term: 'fixed_term',
    'czas okreslony': 'fixed_term',
    'umowa na czas okreslony': 'fixed_term',
  },
};

/** `31.01.2026`, `31-01-2026` and `31/01/2026` become `2026-01-31`. Anything else passes through for the schema to judge. */
function normalizeDate(raw: string): string {
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(raw);
  if (match === null) return raw;
  const [, day = '', month = '', year = ''] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function convert(field: ImportField, raw: string): { value: unknown } | { error: string } {
  switch (field) {
    case 'positionKind':
    case 'serviceStatus':
    case 'employmentBasis': {
      const value = ENUM_VALUES[field]?.[normalize(raw)] ?? ENUM_VALUES[field]?.[raw];
      return value === undefined ? { error: `Unknown value "${raw}"` } : { value };
    }
    case 'employmentStart':
    case 'gradeGrantedOn':
      return { value: normalizeDate(raw) };
    case 'appointmentYear':
    case 'grade': {
      const roman = ROMAN.indexOf(raw.toLowerCase());
      if (field === 'grade' && roman >= 0) return { value: roman + 1 };
      return /^\d+$/.test(raw) ? { value: Number(raw) } : { error: `"${raw}" is not a number` };
    }
    case 'email':
      return { value: raw.toLowerCase() };
    default:
      return { value: raw };
  }
}

function zodErrors(error: ZodError): RowError[] {
  return error.issues.map((issue) => {
    const key = issue.path[0];
    const field = importFields.find((name) => name === key) ?? null;
    return { field, message: issue.message };
  });
}

const forbidden = () => new ServiceError('forbidden', 'Only hr can import employees');

export function createEmployeeImportService(
  deps: EmployeeImportDependencies,
): EmployeeImportService {
  async function requireHr(): Promise<void> {
    if ((await deps.role()) !== 'hr') throw forbidden();
  }

  function parse(csv: string) {
    try {
      return parseCsv(csv);
    } catch (error) {
      throw new ServiceError('invalid_csv', error instanceof Error ? error.message : 'Bad CSV');
    }
  }

  function checkMapping(headers: readonly string[], mapping: ColumnMapping): void {
    for (const [field, header] of Object.entries(mapping)) {
      if (!headers.includes(header)) {
        throw new ServiceError(
          'invalid_csv',
          `Column "${header}" mapped to ${field} is not in the file`,
        );
      }
    }
  }

  async function preview(csv: string, mapping: ColumnMapping): Promise<ImportPreview> {
    const parsed = parse(csv);
    checkMapping(parsed.headers, mapping);
    const existing = await deps.employees.list();
    const byEmail = new Map<string, Employee>();
    for (const employee of existing) {
      if (employee.email !== null) byEmail.set(employee.email.toLowerCase(), employee);
    }
    const seenEmails = new Set<string>();
    const rows: RowPreview[] = [];

    for (const [index, cells] of parsed.rows.entries()) {
      const errors: RowError[] = [];
      const values: Record<string, unknown> = {};
      for (const field of importFields) {
        const header = mapping[field];
        if (header === undefined) continue;
        const raw = cells[parsed.headers.indexOf(header)] ?? '';
        if (raw === '') continue;
        const converted = convert(field, raw);
        if ('error' in converted) errors.push({ field, message: converted.error });
        else values[field] = converted.value;
      }

      const email = typeof values.email === 'string' ? values.email : null;
      const known = email === null ? undefined : byEmail.get(email);
      let match: RowMatch = { kind: 'none' };
      if (email !== null && seenEmails.has(email)) {
        errors.push({ field: 'email', message: 'The e-mail repeats earlier in the file' });
      }
      if (email !== null) seenEmails.add(email);

      if (known !== undefined) {
        match = { kind: 'email', employeeId: known.id };
        const result = employeePatchSchema.safeParse(values);
        if (!result.success) errors.push(...zodErrors(result.error));
      } else {
        const result = newEmployeeSchema.safeParse(values);
        if (!result.success) errors.push(...zodErrors(result.error));
        else if (errors.length === 0) {
          const candidates = await deps.employees.findSimilar(
            `${result.data.firstName} ${result.data.lastName}`,
          );
          if (candidates.length > 0) match = { kind: 'similar', candidates };
        }
      }

      const proposedAction: RowPreview['proposedAction'] =
        errors.length > 0
          ? 'invalid'
          : match.kind === 'email'
            ? 'update'
            : match.kind === 'similar'
              ? 'needs_decision'
              : 'create';
      rows.push({ row: index + 1, values, errors, match, proposedAction });
    }

    const summary = { create: 0, update: 0, needs_decision: 0, invalid: 0 };
    for (const row of rows) summary[row.proposedAction] += 1;
    return { rows, summary };
  }

  return {
    proposeMapping(csv) {
      const parsed = parse(csv);
      return {
        delimiter: parsed.delimiter,
        headers: parsed.headers,
        ...proposeColumnMapping(parsed.headers),
      };
    },

    async dryRun(csv, mapping) {
      await requireHr();
      return preview(csv, mapping);
    },

    async commit(csv, mapping, decisions = {}) {
      await requireHr();
      const { rows } = await preview(csv, mapping);
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const undecided: number[] = [];
      const failed: { row: number; message: string }[] = [];

      for (const row of rows) {
        if (row.proposedAction === 'invalid') {
          failed.push({
            row: row.row,
            message: row.errors.map((error) => error.message).join('; '),
          });
          continue;
        }
        const decision = decisions[row.row];
        let action: 'create' | 'skip' | { updateEmployeeId: string };
        if (row.match.kind === 'email') action = { updateEmployeeId: row.match.employeeId };
        else if (decision !== undefined) action = decision;
        else if (row.match.kind === 'similar') {
          undecided.push(row.row);
          continue;
        } else action = 'create';

        try {
          if (action === 'skip') {
            skipped += 1;
          } else if (action === 'create') {
            await deps.employees.create(newEmployeeSchema.parse(row.values));
            created += 1;
          } else {
            await deps.employees.update(
              action.updateEmployeeId,
              employeePatchSchema.parse(row.values),
            );
            updated += 1;
          }
        } catch (error) {
          failed.push({
            row: row.row,
            message: error instanceof Error ? error.message : 'Write failed',
          });
        }
      }
      return { created, updated, skipped, undecided, failed };
    },
  };
}
