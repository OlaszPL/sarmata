/** Kinds of evaluation documents of `/api/oceny/[id]/eksport/[rodzaj]`. */
export type EvaluationExportKind =
  'arkusz-pdf' | 'arkusz-docx' | 'zawiadomienie' | 'teczka' | 'paczka-ezd';

function withQuery(path: string, query?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Paths the proxy, server actions and pages agree on. URLs are user-facing, so they are Polish.
 * Every screen of the app has its path here, so parallel work never invents its own.
 */
export const routes = {
  home: '/',
  signIn: '/logowanie',
  noOffice: '/brak-urzedu',
  accessibility: '/deklaracja-dostepnosci',

  // Evaluations.
  evaluations: '/oceny',
  newEvaluation: '/oceny/nowa',
  evaluation: (id: string) => `/oceny/${id}`,
  evaluationPart1: (id: string) => `/oceny/${id}/czesc-1`,
  evaluationPart2: (id: string) => `/oceny/${id}/czesc-2`,
  evaluationPart3: (id: string) => `/oceny/${id}/czesc-3`,
  evaluationCheck: (id: string) => `/oceny/${id}/sprawdz`,
  evaluationEvents: (id: string) => `/oceny/${id}/zdarzenia`,
  evaluationJournal: (id: string) => `/oceny/${id}/dziennik`,
  /** Download of a generated document. `zdarzenie` is needed for `zawiadomienie`. */
  evaluationExport: (
    id: string,
    kind: EvaluationExportKind,
    query?: { podpis?: '1'; zdarzenie?: string; znak?: string },
  ) => withQuery(`/api/oceny/${id}/eksport/${kind}`, query),

  // Employees and notes.
  employees: '/pracownicy',
  newEmployee: '/pracownicy/nowy',
  employee: (id: string) => `/pracownicy/${id}`,
  /** ZIP archive of an employee after the end of employment. */
  employeeArchive: (id: string) => `/api/pracownicy/${id}/archiwum`,
  notes: '/notatki',

  notifications: '/powiadomienia',

  // HR.
  hr: '/kadry',
  hrSchedule: '/kadry/harmonogram',
  hrStatistics: '/kadry/statystyki',
  hrRegister: '/kadry/rejestr',
  /** The grade grant form of the register, preset to the evaluation that grants a grade by law. */
  hrRegisterGrade: (evaluationId: string) =>
    `${withQuery('/kadry/rejestr', { ocena: evaluationId })}#stopien`,
  /** The register after an appeal was saved, with the confirmation in view. */
  hrRegisterAppealSaved: '/kadry/rejestr?zapisano=odwolanie#odwolania',
  hrImport: '/kadry/import',
  hrTree: '/kadry/struktura',
  /** CSV of the DSC-OCK statistics report for a year. */
  hrDscOckCsv: (year: number) => withQuery('/api/kadry/dsc-ock', { rok: String(year) }),

  // Administrator.
  settings: '/ustawienia',
  settingsAccounts: '/ustawienia/konta',
  settingsRules: '/ustawienia/przepisy',
  aiLog: '/dziennik-ai',

  help: '/pomoc',
  /** The procedure assistant asked about one evaluation, answering by the regulation pinned to it. */
  helpForEvaluation: (evaluationId: string) =>
    `${withQuery('/pomoc', { ocena: evaluationId })}#asystent`,

  /** Dev-only catalog of the shared components, 404 in production. */
  componentCatalog: '/komponenty',
} as const;
