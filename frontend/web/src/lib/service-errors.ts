import {
  type ApprovalIssue,
  type InvalidSupervisorReason,
  type ServiceErrorCode,
} from '@sarmata/services';

/**
 * Polish messages for every `ServiceError` code. The `Record` makes the compiler demand a message
 * for each new code of the services. Codes with useful `details` get a sharper text below.
 */
const messages: Record<ServiceErrorCode, string> = {
  no_regulation_in_force:
    'Brak wersji przepisów obowiązującej w tym dniu. Skontaktuj się z administratorem urzędu.',
  unknown_regulation:
    'Nie znaleziono wersji przepisów tej oceny. Skontaktuj się z administratorem urzędu.',
  missing_deadline_slot:
    'Wersja przepisów nie określa potrzebnego terminu. Skontaktuj się z administratorem urzędu.',
  regulation_drift:
    'Wersja przepisów w bazie różni się od wzorcowej. Skontaktuj się z administratorem urzędu.',
  not_eligible: 'Ten pracownik nie podlega teraz ocenie okresowej.',
  invalid_transition: 'Ta czynność nie jest dostępna na obecnym etapie oceny. Odśwież stronę.',
  approval_blocked: 'Nie można zatwierdzić. Popraw pola wskazane na liście.',
  criteria_invalid: 'Kryteria w części I wymagają poprawy. Popraw pola wskazane na liście.',
  part_locked: 'Ta część arkusza jest już zatwierdzona i nie można jej zmienić.',
  stale_status:
    'Ktoś zmienił tę ocenę w międzyczasie. Odśwież stronę, sprawdź jej stan i wyślij formularz ponownie.',
  objection_late: 'Termin na wniesienie sprzeciwu już minął.',
  objection_lowers_outcome:
    'Rozpatrzenie sprzeciwu nie może obniżyć oceny. Zmień oceny cząstkowe tak, by poziom nie był niższy.',
  term_change_invalid: 'Nie można zmienić terminu tej oceny.',
  forbidden:
    'Twoja rola nie pozwala na tę czynność. Jeśli to pomyłka, poproś administratora urzędu o zmianę roli.',
  invalid_supervisor: 'Nie można ustawić tego przełożonego. Wybierz inną osobę.',
  invalid_evaluator: 'Wybrana osoba nie może prowadzić oceny w tym urzędzie. Wybierz inną osobę.',
  no_locked_sheet: 'Ta ocena nie ma zatwierdzonego arkusza, więc nie ma czego korygować.',
  not_found: 'Nie znaleziono danych. Mogły zostać usunięte, odśwież stronę.',
  sensitive_data:
    'Notatka może zawierać dane wrażliwe. Sprawdź ostrzeżenia, a potem popraw treść albo potwierdź zapis.',
  hr_entry_rejected: 'Tego wpisu nie można zapisać przy obecnym stanie oceny.',
  ai_disabled: 'AI jest wyłączone w ustawieniach urzędu. Możesz pracować bez sugestii.',
  ai_run_not_done: 'AI jeszcze nie skończyło. Poczekaj chwilę i spróbuj ponownie.',
  ai_fragment_unknown: 'Ta propozycja AI już nie istnieje. Odśwież stronę.',
  regulation_invalid: 'Wersja przepisów zawiera błędy. Popraw wskazane parametry.',
  regulation_cases_failed:
    'Część przypadków testowych nie przechodzi. Sprawdź wyniki testów przed publikacją.',
  regulation_not_draft: 'Tę wersję przepisów już opublikowano. Zmieniać można tylko szkic.',
  already_ended: 'Zatrudnienie tej osoby już ustało.',
  not_ended:
    'Zatrudnienie tej osoby jeszcze trwa. Ta czynność jest dostępna dopiero po jego ustaniu.',
  invalid_end_date: 'Data ustania zatrudnienia nie może być w przyszłości.',
  invalid_csv:
    'Nie udało się odczytać pliku. Sprawdź, czy to plik CSV z nagłówkiem w pierwszym wierszu.',
  account_exists: 'Ta osoba ma już konto w urzędzie.',
  last_admin: 'Urząd musi mieć co najmniej jednego aktywnego administratora.',
  invalid_account: 'Nie można nadać dostępu tej osobie, bo jej zatrudnienie ustało.',
};

/** Every code with a message, for tests and for screens that list them. */
export const serviceErrorCodes = Object.keys(messages) as ServiceErrorCode[];

const FALLBACK = 'Coś poszło nie tak. Spróbuj ponownie.';

const notEligibleReasons: Record<string, string> = {
  fixed_term: 'Pracownik zatrudniony na czas określony nie podlega ocenie okresowej.',
  employment_ended: 'Zatrudnienie tego pracownika ustało, więc nie można rozpocząć oceny.',
  evaluation_in_progress: 'Ten pracownik ma już ocenę w toku. Otwórz ją z listy ocen.',
};

const invalidSupervisorReasons: Record<InvalidSupervisorReason, string> = {
  cycle: 'Ta osoba jest już podwładnym wybranego przełożonego. Wybierz inną osobę.',
  self: 'Pracownik nie może być swoim przełożonym.',
  other_office: 'Wybrany przełożony nie należy do urzędu.',
  not_allowed: 'Przełożonego zmieniają tylko kadry.',
};

const termChangeIssues: Record<string, string> = {
  term_change_too_early:
    'Termin można zmienić dopiero po upływie okresu wymaganego przepisami od początku cyklu.',
  term_change_reason_unknown: 'Wybierz jedną z przyczyn zmiany terminu z listy.',
  term_change_after_negative: 'Po ocenie negatywnej terminu nie można zmienić.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `rrrr-mm-dd` from the services as `dd.mm.rrrr`, anything else as it is. */
function polishDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

/** The message for the user of a `ServiceError`, sharpened by its `details` where they say more. */
export function serviceErrorMessage(code: string, details?: unknown): string {
  if (code === 'not_eligible' && isRecord(details) && typeof details.reason === 'string') {
    return notEligibleReasons[details.reason] ?? messages.not_eligible;
  }
  if (code === 'invalid_supervisor' && isRecord(details) && typeof details.reason === 'string') {
    return (
      (invalidSupervisorReasons as Record<string, string>)[details.reason] ??
      messages.invalid_supervisor
    );
  }
  if (code === 'objection_late' && isRecord(details) && typeof details.dueOn === 'string') {
    return `Termin na wniesienie sprzeciwu minął ${polishDate(details.dueOn)}. Sprzeciwu po terminie nie można przyjąć.`;
  }
  if (code === 'term_change_invalid' && Array.isArray(details)) {
    const texts = details.flatMap((issue) =>
      typeof issue === 'string' && termChangeIssues[issue] ? [termChangeIssues[issue]] : [],
    );
    if (texts.length > 0) return texts.join(' ');
  }
  return (messages as Record<string, string>)[code] ?? FALLBACK;
}

type ApprovalIssueCode = ApprovalIssue['code'];

/**
 * Field id and message per gate code, for part I and the whole sheet. Field ids are the ids the
 * case screens give their controls: `rating-<criterionId>` for a rating, the content key otherwise.
 */
const issueRules: Record<
  ApprovalIssueCode,
  { field: (criterionId: string) => string; message: (criterion: string) => string }
> = {
  too_many: {
    field: () => 'additionalCriteria',
    message: () => 'Wybrano za dużo kryteriów dodatkowych. Usuń nadmiarowe.',
  },
  duplicate: {
    field: () => 'additionalCriteria',
    message: (name) => `Kryterium ${name} wybrano dwa razy. Zostaw je tylko raz.`,
  },
  mandatory_as_additional: {
    field: () => 'additionalCriteria',
    message: (name) =>
      `Kryterium ${name} jest obowiązkowe w tym arkuszu. Wybierz inne kryterium dodatkowe.`,
  },
  unknown: {
    field: () => 'additionalCriteria',
    message: (name) => `Kryterium ${name} nie występuje w katalogu. Wybierz kryterium z listy.`,
  },
  due_after_deadline: {
    field: () => 'dueOn',
    message: () =>
      'Termin oceny nie może być późniejszy niż termin z przepisów. Wybierz wcześniejszą datę.',
  },
  rating_missing: {
    field: (id) => `rating-${id}`,
    message: (name) => `Wybierz ocenę cząstkową dla kryterium ${name}.`,
  },
  rating_out_of_scale: {
    field: (id) => `rating-${id}`,
    message: (name) => `Ocena kryterium ${name} jest spoza skali. Wybierz jedną z wartości skali.`,
  },
  development_conclusions_missing: {
    field: () => 'developmentConclusions',
    message: () => 'Wpisz wnioski do indywidualnego programu rozwoju zawodowego (IPRZ).',
  },
  justification_missing: {
    field: () => 'justification',
    message: () => 'Wpisz uzasadnienie. Przy ocenie negatywnej jest wymagane.',
  },
  grade_request_not_allowed: {
    field: () => 'gradeRequest',
    message: () =>
      'Wniosek o stopień jest możliwy tylko dla urzędnika służby cywilnej z oceną pozytywną. Usuń wniosek.',
  },
  grade_request_max_grade: {
    field: () => 'gradeRequest',
    message: () => 'Pracownik ma już najwyższy stopień IX. Usuń wniosek o stopień.',
  },
  grade_request_motivation_missing: {
    field: () => 'gradeRequestMotivation',
    message: () => 'Wpisz uzasadnienie wniosku o stopień.',
  },
  grade_request_wrong_grade: {
    field: () => 'requestedGrade',
    message: () => 'Wnioskowany stopień musi być o jeden wyższy od obecnego.',
  },
  interview_date_missing: {
    field: () => 'interviewOn',
    message: () => 'Wpisz datę rozmowy oceniającej.',
  },
  objection_window_open: {
    field: () => 'closedOn',
    message: () => 'Termin na sprzeciw jeszcze trwa. Ocenę zamkniesz po jego upływie.',
  },
};

/** Every gate code, for tests. */
export const approvalIssueCodes = Object.keys(issueRules) as ApprovalIssueCode[];

/**
 * Field id and Polish message of a gate issue (`criteria_invalid` and `approval_blocked` details).
 * `criterionName` turns a criterion id into its name, the id is shown without it.
 */
export function approvalIssueMessage(
  issue: ApprovalIssue,
  criterionName: (criterionId: string) => string = (id) => id,
): { fieldId: string; message: string } {
  const rule = issueRules[issue.code];
  const id = issue.criterionId ?? '';
  return { fieldId: rule.field(id), message: rule.message(id ? criterionName(id) : '') };
}

/**
 * Error summary items of gate issues, e.g. of `services.evaluations.approvalIssues(id).issues`.
 * `fieldMap` remaps the default field ids to the control ids of a form, one item per field.
 */
export function approvalIssueItems(
  issues: readonly ApprovalIssue[],
  criterionName?: (criterionId: string) => string,
  fieldMap?: Record<string, string>,
): { fieldId: string; message: string }[] {
  const seen = new Set<string>();
  const items: { fieldId: string; message: string }[] = [];
  for (const issue of issues) {
    const { fieldId, message } = approvalIssueMessage(issue, criterionName);
    const target = fieldMap?.[fieldId] ?? fieldId;
    if (seen.has(`${target}|${message}`)) continue;
    seen.add(`${target}|${message}`);
    items.push({ fieldId: target, message });
  }
  return items;
}

/** Gate issues found in `details`, skipping entries of unknown shape (e.g. `sheet_incomplete`). */
export function approvalIssuesOf(details: unknown): ApprovalIssue[] {
  if (!Array.isArray(details)) return [];
  return details.filter(
    (issue): issue is ApprovalIssue =>
      isRecord(issue) && typeof issue.code === 'string' && issue.code in issueRules,
  );
}
