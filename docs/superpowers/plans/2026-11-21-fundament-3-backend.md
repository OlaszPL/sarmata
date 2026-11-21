# Fundament 3: szkielet backendu. Plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** szkielet warstw backendu z ADR 0004 na prawdziwym kawałku domeny: silnik terminów z Kodeksu cywilnego i polskiego kalendarza świąt, schemat wersji przepisów, oficjalna wersja przepisów obowiązujących jako moduł `@sarmata/regulations`, tabela `regulation_versions` z niezmiennymi wierszami oficjalnymi, repozytoria na supabase-js, pierwsze serwisy, klient AI (tekst i Bielik-One) oraz worker kolejki pgmq z synchronizacją oficjalnych wersji przy starcie.

**Architektura:** `backend/domain` dostaje jeden głęboki moduł terminów: `computeDeadline(rule, facts)`. Za tym interfejsem są strategie (rejestr nazwanych funkcji), święta ustawowe z ruchomymi datami, przesunięcie z art. 115 Kc i sklejanie nieobecności. Reguła to dane walidowane zodem, a dokument wersji przepisów (`RegulationDocument`) składa sloty terminów z parametrami oceny. Oficjalne wersje leżą w `backend/regulations/<wersja>/rules.json` (ADR 0006, uzupełnienie). Do bazy trafiają przez krok synchronizacji w serwisach, który uruchamia worker przy starcie i skrypt `pnpm regulations:sync`. Repozytoria przyjmują klienta supabase-js (JWT użytkownika albo klucz serwisowy dla workera) i oddają typy domenowe. Serwisy dostają repozytoria jako zależność, więc testy jednostkowe idą na adapterze w pamięci.

**Stack:** zod 4.6.7, @supabase/supabase-js 2.119.2, tsx 4.23.15, Vitest 5.1.1, pgmq (RPC przez PostgREST), pgTAP, fetch z Node 24 (bez SDK OpenAI).

**Kontekst dla wykonawcy:**
- Decyzje: `docs/adr/0001-office-id-od-poczatku.md`, `docs/adr/0002-uklad-repo-i-runtime.md`, `docs/adr/0004-repozytoria-supabase-js.md`, `docs/adr/0005-runtime-llm.md`, `docs/adr/0006-reguly-jako-wersjonowane-dane.md` (z sekcją o oficjalnych wersjach jako module). Pojęcia: `GLOSSARY.md`. Spec funkcjonalny: `docs/funkcjonalnosci.md` z wątku funkcjonalnego.
- Plan 2 jest zrobiony: tabele `offices`, `memberships`, `employees`, hook `access.custom_access_token_hook`, enumy `access.action` i `access.resource`, funkcje `access.can(action, resource, office_id, resource_id)` i `access.current_office_id()`, domyślne granty dla nowych tabel i funkcji w `public` odebrane rolom `anon` i `authenticated`, konta demo, Supabase CLI 3.2.0 jako devDependency `@sarmata/database`, pakiet `@sarmata/database` eksportujący typ `Database`, skrypty `db:*`. Przed zadaniem 4 przeczytaj `database/supabase/migrations/*.sql`.
- Plan 4 (frontend) musi być zmergowany przed startem: tworzy minimalne `@sarmata/repositories` i `@sarmata/services`, które ten plan rozszerza. Kontrakt w sekcji „Zgodność z planem 4”.
- Źródła przypadków testowych: `docs/zasoby-kprm/6. Materiały dodatkowe/liczenie terminów.docx` (podgląd: `pandoc -t plain`), `docs/analiza/proces-i-przypadki-uzycia.md` sekcje 1.5 i 4 (P-01 do P-04), `docs/legal/oceny-okresowe-dane.yaml`. Każda data oczekiwana w testach została policzona niezależnie skryptem w Pythonie.
- Kod, nazwy plików, testy i komunikaty dla deweloperów po angielsku. Nazwy i opisy kryteriów oraz podstawy prawne w `rules.json` po polsku, bo trafiają do UI i arkusza. Proza bez półpauz i bez średników (`AGENTS.md`). Polecenia z prefiksem `rtk`.
- Każdy pakiet deklaruje swoje zależności: biblioteki produkcyjne w `dependencies`, narzędzia w `devDependencies`, pakiety wewnętrzne przez `workspace:*`. Wersje wspólne idą przez `catalog:`.
- Projekt UDER102 nie wchodzi (decyzja z wątku funkcjonalnego, ADR 0006). Strategia „miesiąc kalendarzowy upływu” dojdzie razem z jego katalogiem.
- Kod TS i JSON z zadań 1 do 9 został przed oddaniem planu sprawdzony w piaskownicy: `tsc` z flagami `tsconfig.base.json` (w tym `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`), ESLint `strictTypeChecked` i `stylisticTypeChecked` z konfiguracji repo, Prettier i Vitest (wszystkie testy jednostkowe PASS). Typy bazy były wtedy ręczną atrapą `Database`, więc po wygenerowaniu prawdziwych w zadaniu 5 może być potrzebna drobna poprawka w repozytoriach. Każdy plik TS należy do `tsconfig.json` swojego pakietu, łącznie z testami i `vitest.integration.config.ts`.
- Model wykonania: zadania po kolei, bez uruchamiania testów po drodze. Wyjątek to zadanie 5, które musi uruchomić bazę, żeby wygenerować typy. Wszystkie sprawdzenia są w sekcji „Walidacja końcowa”.

## Gdzie działa synchronizacja oficjalnych wersji

Oficjalne wersje żyją w TS i JSON (`@sarmata/regulations`), a walidacja to schemat zod z domeny. Migracja SQL nie umie ich zaimportować bez generatora, który dublowałby dane w plikach migracji. Dlatego synchronizacja to funkcja serwisu `regulations.syncOfficial()`, wołana w dwóch miejscach:

1. **Start workera.** Worker działa w każdym profilu (w light w kontenerze web), ma klucz serwisowy i startuje po każdym wydaniu, bo aktualizacja z ADR 0003 kończy się restartem. Nowy katalog wersji trafia więc do bazy razem z kodem, który go zna. Gdy wiersz oficjalny w bazie różni się od kodu, worker kończy się błędem `regulation_drift` i nie przetwarza zadań.
2. **Skrypt `pnpm regulations:sync`.** Dev po `db:reset` (skrypt `db:reset` woła go sam), skrypt setup termic i kreator instalacji zaraz po migracjach.

Odrzucone: synchronizacja przy starcie Next.js (web musiałby mieć klucz serwisowy) i wiersze w migracjach (dwa źródła prawdy dla tej samej wersji).

## Zgodność z planem 4

Plan 4 (frontend) wykonuje się przed tym planem. Jego zadanie 1 tworzy minimalne pakiety `@sarmata/repositories` (`src/db.ts` z typem `Db`, `src/auth.ts` z `readAccountClaims`, `src/offices.ts` z `findOfficeName`, `src/index.ts`) i `@sarmata/services` (`src/account/current-account.ts` z `getCurrentAccount(db)`, `src/index.ts` z reeksportem `Database` i `Db`), dopisuje do katalogu pnpm `zod: 4.6.7` i `'@supabase/supabase-js': 2.119.2` oraz `savePrefix: ''`. Ten plan:
- rozszerza oba pakiety (zadania 6 i 7): dodaje pliki, dopisuje eksporty na końcu istniejących `src/index.ts`, uzupełnia pola `package.json`, a plików z planu 4 nie zmienia,
- używa typu `Db` z `src/db.ts`, a `createServiceClient` dodaje w osobnym pliku `src/service-client.ts`,
- nie definiuje nazw `readAccountClaims`, `findOfficeName`, `getCurrentAccount`, `CurrentAccount`, `MemberAccount`, `OfficeRole`,
- daje frontendowi `servicesFor(db)` obok `getCurrentAccount(db)`: serwisy dostają klienta jako `db: Db`,
- tworzy nowe pakiety `@sarmata/regulations`, `@sarmata/ai` i `@sarmata/worker`.

Plan 4 przepisuje też `scripts/termic-setup.sh` i sekcje README, więc kroki tego planu wskazują miejsca w tych plikach po treści, a nie po numerze punktu.

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `backend/domain/src/deadlines/calendar.ts` | wewnętrzne: dodawanie dni, dzień tygodnia, długość okresu |
| `backend/domain/src/deadlines/working-days.ts` | wewnętrzne: święta ustawowe, Wielkanoc, dzień roboczy, art. 115 Kc |
| `backend/domain/src/deadlines/absences.ts` | wewnętrzne: sklejanie nieobecności, „dłużej niż miesiąc” |
| `backend/domain/src/deadlines/deadline-rule.ts` | schemat zod reguły terminu (sloty strategii) |
| `backend/domain/src/deadlines/compute-deadline.ts` | rejestr strategii i `computeDeadline` |
| `backend/domain/src/regulations/regulation-document.ts` | schemat dokumentu wersji przepisów i `parseRegulationDocument` |
| `backend/domain/src/regulations/version-in-force.ts` | wersja obowiązująca w danym dniu |
| `backend/regulations/**` | pakiet `@sarmata/regulations`: oficjalne wersje, testy przypadków |
| `database/supabase/migrations/20261121130000_access_resource_regulation_version.sql` | nowa wartość enuma `access.resource` (osobna transakcja) |
| `database/supabase/migrations/20261121130100_regulation_versions.sql` | tabela, wyzwalacz niezmienności, `access.can` dla danych referencyjnych |
| `database/supabase/migrations/20261121130200_job_queue.sql` | kolejka `jobs` i RPC tylko dla roli serwisowej |
| `database/supabase/tests/002_regulation_versions.test.sql`, `003_job_queue.test.sql` | pgTAP |
| `backend/repositories/**` | rozszerzenie pakietu z planu 4: klient serwisowy, repozytoria, kolejka, testy integracyjne |
| `backend/services/**` | rozszerzenie pakietu z planu 4: pracownicy, przepisy, terminy, synchronizacja |
| `backend/ai/**` | pakiet `@sarmata/ai`: model tekstowy z wymuszonym schematem, decyzje Bielik-One |
| `backend/worker/**` | pakiet `@sarmata/worker`: pętla kolejki, handlery, start z synchronizacją |
| `scripts/with-supabase-env.sh` | uruchamia polecenie z adresem i kluczami lokalnej instancji |
| `docs/adr/0001-office-id-od-poczatku.md` | wyjątek dla danych referencyjnych |

---

### Task 1: Domena: silnik terminów

Jeden publiczny moduł: `computeDeadline(rule, facts)`. Reguła mówi, jaką strategią liczyć (miesiące od zdarzenia, dni od zdarzenia, okno wokół zdarzenia) i czy przesuwać koniec na dzień roboczy. Fakty to data zdarzenia i nieobecności. Wybór, która data jest zdarzeniem (np. sporządzenie poprzedniej oceny albo zatrudnienie), należy do wołającego. Pole `event` w regule opisuje to zdarzenie dla serwisów i edytora reguł. Kalendarz, święta i sklejanie nieobecności są wewnętrzne i testowane przez ten jeden interfejs.

Zasady (KPRM, `liczenie terminów.docx`, P-01 do P-04):
- termin w miesiącach kończy się w dniu odpowiadającym datą dniowi początkowemu, a gdy go brak, w ostatnim dniu miesiąca (art. 112 Kc, `addMonths` z planu 1),
- termin w dniach nie wlicza dnia zdarzenia, koniec to data zdarzenia plus liczba dni (art. 111 § 2 Kc),
- koniec w sobotę albo w dzień wolny przechodzi na następny dzień roboczy (art. 115 Kc). Dni wolne: ustawa z 18.01.1951 o dniach wolnych od pracy, z 6 stycznia od 2011 r. i Wigilią od 2025 r.,
- nieobecności ciągłe liczy się od pierwszego do ostatniego dnia, a dni wolne między nimi nie przerywają ciągłości,
- termin oceny przedłuża się o dni kalendarzowe każdej nieobecności trwającej dłużej niż miesiąc, porównując kalendarzowo (P-04). Interpretacja zespołu: od 5.10 do 4.11 to dokładnie miesiąc, od 5.10 do 5.11 to już dłużej. Nieobecność bez daty końca wstrzymuje termin (spec funkcjonalny: „wstrzymany do powrotu”),
- przedłużenie może wciągnąć kolejną nieobecność, która zaczęła się przed nowym końcem.

**Files:**
- Create: `backend/domain/src/deadlines/calendar.ts`, `backend/domain/src/deadlines/working-days.ts`, `backend/domain/src/deadlines/absences.ts`, `backend/domain/src/deadlines/deadline-rule.ts`, `backend/domain/src/deadlines/compute-deadline.ts`
- Modify: `pnpm-workspace.yaml`, `backend/domain/package.json`, `backend/domain/src/index.ts`
- Test: `backend/domain/src/deadlines/compute-deadline.test.ts`

- [ ] **Step 1: Sprawdź katalog w `pnpm-workspace.yaml`**

Plan 4 dopisał do sekcji `catalog:` między innymi te dwa wpisy. Jeśli któregoś brakuje, dopisz go, a istniejących wpisów nie zmieniaj:

```yaml
  '@supabase/supabase-js': 2.119.2
  zod: 4.6.7
```

- [ ] **Step 2: Dodaj zod do `backend/domain/package.json`**

Dopisz po `"scripts"`:

```json
  "dependencies": {
    "zod": "catalog:"
  },
```

- [ ] **Step 3: Utwórz `backend/domain/src/deadlines/calendar.ts`**

```ts
import { type CalendarDate, fromParts, toParts } from './calendar-date';

const DAY_MS = 86_400_000;

const toUtcMs = (date: CalendarDate): number => {
  const { year, month, day } = toParts(date);
  return Date.UTC(year, month - 1, day);
};

const fromUtcMs = (ms: number): CalendarDate => {
  const date = new Date(ms);
  return fromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

/** Internal: the date `days` calendar days later (a negative number goes back). */
export const addDays = (date: CalendarDate, days: number): CalendarDate =>
  fromUtcMs(toUtcMs(date) + days * DAY_MS);

/** Internal: 0 is Sunday, 6 is Saturday. */
export const weekday = (date: CalendarDate): number => new Date(toUtcMs(date)).getUTCDay();

/** Internal: number of days from `from` to `to`, both included. */
export const daysInclusive = (from: CalendarDate, to: CalendarDate): number =>
  Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS) + 1;
```

- [ ] **Step 4: Utwórz `backend/domain/src/deadlines/working-days.ts`**

```ts
import { addDays, weekday } from './calendar';
import { type CalendarDate, fromParts, toParts } from './calendar-date';

/** Gregorian Easter Sunday (Meeus, Jones and Butcher algorithm). */
function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fromParts(year, month, day);
}

const holidaysByYear = new Map<number, ReadonlySet<CalendarDate>>();

/**
 * Public holidays under art. 1 of the act of 18 January 1951 on days off work:
 * 6 January since 2011, 24 December since 2025 (Dz.U. 2024 poz. 1965).
 * Easter Sunday and Pentecost are Sundays anyway, listed so the set mirrors the act.
 */
function publicHolidays(year: number): ReadonlySet<CalendarDate> {
  const cached = holidaysByYear.get(year);
  if (cached) return cached;
  const fixed: [number, number][] = [
    [1, 1],
    [5, 1],
    [5, 3],
    [8, 15],
    [11, 1],
    [11, 11],
    [12, 25],
    [12, 26],
  ];
  if (year >= 2011) fixed.push([1, 6]);
  if (year >= 2025) fixed.push([12, 24]);
  const easter = easterSunday(year);
  const holidays = new Set<CalendarDate>([
    ...fixed.map(([month, day]) => fromParts(year, month, day)),
    easter,
    addDays(easter, 1),
    addDays(easter, 49),
    addDays(easter, 60),
  ]);
  holidaysByYear.set(year, holidays);
  return holidays;
}

/** Internal: not a Saturday, not a Sunday and not a public holiday. */
export function isWorkingDay(date: CalendarDate): boolean {
  const day = weekday(date);
  return day !== 0 && day !== 6 && !publicHolidays(toParts(date).year).has(date);
}

/** Internal: art. 115 Kc, an end of term on a day off or a Saturday moves to the next working day. */
export function nextWorkingDayOnOrAfter(date: CalendarDate): CalendarDate {
  let current = date;
  while (!isWorkingDay(current)) current = addDays(current, 1);
  return current;
}
```

- [ ] **Step 5: Utwórz `backend/domain/src/deadlines/absences.ts`**

```ts
import { addMonths } from './add-months';
import { addDays } from './calendar';
import { type CalendarDate } from './calendar-date';
import { isWorkingDay } from './working-days';

/** A justified absence of the evaluated person, both days included. `to` is null while it lasts. */
export interface Absence {
  readonly from: CalendarDate;
  readonly to: CalendarDate | null;
}

const laterEnd = (a: CalendarDate | null, b: CalendarDate | null): CalendarDate | null =>
  a === null || b === null ? null : a > b ? a : b;

function continues(period: Absence, next: Absence): boolean {
  if (period.to === null) return true;
  for (let day = addDays(period.to, 1); day < next.from; day = addDays(day, 1)) {
    if (isWorkingDay(day)) return false;
  }
  return true;
}

/**
 * Internal: continuous absences (KPRM rules). Overlapping, adjacent or separated only by days off
 * merge into one period that runs from the first day of the first absence to the last day of the last.
 */
export function mergeAbsences(absences: readonly Absence[]): Absence[] {
  const sorted = [...absences].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const merged: Absence[] = [];
  for (const absence of sorted) {
    if (absence.to !== null && absence.to < absence.from) {
      throw new RangeError(`Absence ends before it starts: ${absence.from} to ${absence.to}`);
    }
    const last = merged.at(-1);
    if (last && continues(last, absence)) {
      merged[merged.length - 1] = { from: last.from, to: laterEnd(last.to, absence.to) };
    } else {
      merged.push(absence);
    }
  }
  return merged;
}

/**
 * Internal: art. 81 ust. 7 "dłużej niż miesiąc", compared by calendar (art. 112 Kc, P-04).
 * An absence from 5 October to 4 November lasts exactly one month, until 5 November it lasts longer.
 */
export const lastsLongerThanMonth = (from: CalendarDate, to: CalendarDate): boolean =>
  to >= addMonths(from, 1);
```

- [ ] **Step 6: Utwórz `backend/domain/src/deadlines/deadline-rule.ts`**

```ts
import { z } from 'zod';

/** The event a deadline is counted from. The caller supplies its date as `facts.eventDate`. */
export const deadlineEventSchema = z.enum([
  'cycleStart',
  'acquaintance',
  'positionChange',
  'objectionFiled',
  'objectionOutcome',
]);

const legalBasis = z.string().min(1);

const monthsFromEventSchema = z.strictObject({
  strategy: z.literal('monthsFromEvent'),
  event: deadlineEventSchema,
  months: z.number().int().positive(),
  extendByAbsencesLongerThanMonth: z.boolean(),
  shiftToWorkingDay: z.boolean(),
  basis: legalBasis,
});

const daysFromEventSchema = z.strictObject({
  strategy: z.literal('daysFromEvent'),
  event: deadlineEventSchema,
  days: z.number().int().positive(),
  shiftToWorkingDay: z.boolean(),
  basis: legalBasis,
});

const windowAroundEventSchema = z.strictObject({
  strategy: z.literal('windowAroundEvent'),
  event: deadlineEventSchema,
  daysBefore: z.number().int().nonnegative(),
  daysAfter: z.number().int().positive(),
  shiftToWorkingDay: z.boolean(),
  basis: legalBasis,
});

/** A deadline slot of a regulation version: a named strategy with its parameters and legal basis (ADR 0006). */
export const deadlineRuleSchema = z.discriminatedUnion('strategy', [
  monthsFromEventSchema,
  daysFromEventSchema,
  windowAroundEventSchema,
]);

export type DeadlineEvent = z.infer<typeof deadlineEventSchema>;
export type DeadlineRule = z.infer<typeof deadlineRuleSchema>;
```

- [ ] **Step 7: Utwórz `backend/domain/src/deadlines/compute-deadline.ts`**

```ts
import { type Absence, lastsLongerThanMonth, mergeAbsences } from './absences';
import { addMonths } from './add-months';
import { addDays, daysInclusive } from './calendar';
import { type CalendarDate } from './calendar-date';
import { type DeadlineRule } from './deadline-rule';
import { nextWorkingDayOnOrAfter } from './working-days';

export interface DeadlineFacts {
  /** Date of the event named by `rule.event`. */
  readonly eventDate: CalendarDate;
  /** Justified absences of the evaluated person in the current cycle. Only some strategies use them. */
  readonly absences?: readonly Absence[];
}

export type DeadlineResult =
  | {
      readonly kind: 'due';
      /** First day of a window (e.g. § 9 ust. 2), null for a plain deadline. */
      readonly windowStart: CalendarDate | null;
      /** End of term before the art. 115 Kc shift, after any extension. */
      readonly nominalDue: CalendarDate;
      /** Last day to act. */
      readonly due: CalendarDate;
      /** Calendar days added for absences longer than a month (art. 81 ust. 7). */
      readonly extendedByDays: number;
    }
  | {
      /** An absence without an end date started before the deadline: the deadline waits for the return. */
      readonly kind: 'suspended';
      readonly since: CalendarDate;
    };

type Strategy<S extends DeadlineRule['strategy']> = (
  rule: Extract<DeadlineRule, { strategy: S }>,
  facts: DeadlineFacts,
) => DeadlineResult;

function due(
  rule: DeadlineRule,
  windowStart: CalendarDate | null,
  nominalDue: CalendarDate,
  extendedByDays: number,
): DeadlineResult {
  return {
    kind: 'due',
    windowStart,
    nominalDue,
    due: rule.shiftToWorkingDay ? nextWorkingDayOnOrAfter(nominalDue) : nominalDue,
    extendedByDays,
  };
}

type Extension =
  | { readonly kind: 'extended'; readonly end: CalendarDate; readonly days: number }
  | { readonly kind: 'suspended'; readonly since: CalendarDate };

function extendByAbsences(
  eventDate: CalendarDate,
  end: CalendarDate,
  absences: readonly Absence[],
): Extension {
  let current = end;
  let days = 0;
  for (const period of mergeAbsences(absences)) {
    if (period.to !== null && period.to < eventDate) continue;
    const from = period.from < eventDate ? eventDate : period.from;
    if (from > current) break;
    if (period.to === null) return { kind: 'suspended', since: from };
    if (!lastsLongerThanMonth(from, period.to)) continue;
    const length = daysInclusive(from, period.to);
    current = addDays(current, length);
    days += length;
  }
  return { kind: 'extended', end: current, days };
}

/** Registry of named deadline strategies. A new strategy needs a schema variant and an entry here. */
const strategies: { [S in DeadlineRule['strategy']]: Strategy<S> } = {
  monthsFromEvent: (rule, facts) => {
    const end = addMonths(facts.eventDate, rule.months);
    if (!rule.extendByAbsencesLongerThanMonth) return due(rule, null, end, 0);
    const extension = extendByAbsences(facts.eventDate, end, facts.absences ?? []);
    if (extension.kind === 'suspended') return extension;
    return due(rule, null, extension.end, extension.days);
  },
  daysFromEvent: (rule, facts) => due(rule, null, addDays(facts.eventDate, rule.days), 0),
  windowAroundEvent: (rule, facts) =>
    due(
      rule,
      addDays(facts.eventDate, -rule.daysBefore),
      addDays(facts.eventDate, rule.daysAfter),
      0,
    ),
};

/** Computes a deadline of one slot of a regulation version from the facts of one evaluation. */
export function computeDeadline(rule: DeadlineRule, facts: DeadlineFacts): DeadlineResult {
  const strategy = strategies[rule.strategy] as (
    rule: DeadlineRule,
    facts: DeadlineFacts,
  ) => DeadlineResult;
  return strategy(rule, facts);
}
```

- [ ] **Step 8: Rozszerz `backend/domain/src/index.ts`**

```ts
export { type CalendarDate, calendarDate } from './deadlines/calendar-date';
export { addMonths } from './deadlines/add-months';
export { type Absence } from './deadlines/absences';
export {
  type DeadlineEvent,
  type DeadlineRule,
  deadlineRuleSchema,
} from './deadlines/deadline-rule';
export {
  type DeadlineFacts,
  type DeadlineResult,
  computeDeadline,
} from './deadlines/compute-deadline';
```

- [ ] **Step 9: Napisz testy `backend/domain/src/deadlines/compute-deadline.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { type DeadlineResult, type DeadlineRule, calendarDate, computeDeadline } from '../index';

const months = (count: number, extend: boolean, shift = true): DeadlineRule => ({
  strategy: 'monthsFromEvent',
  event: 'cycleStart',
  months: count,
  extendByAbsencesLongerThanMonth: extend,
  shiftToWorkingDay: shift,
  basis: 'test',
});

const days = (count: number, shift = true): DeadlineRule => ({
  strategy: 'daysFromEvent',
  event: 'acquaintance',
  days: count,
  shiftToWorkingDay: shift,
  basis: 'test',
});

function compute(
  rule: DeadlineRule,
  eventDate: string,
  absences: [string, string | null][] = [],
): DeadlineResult {
  return computeDeadline(rule, {
    eventDate: calendarDate(eventDate),
    absences: absences.map(([from, to]) => ({
      from: calendarDate(from),
      to: to === null ? null : calendarDate(to),
    })),
  });
}

const dayBefore = (iso: string): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

describe('months from the event (art. 112 Kc)', () => {
  it.each([
    ['2024-03-16', 24, '2026-03-16', 'KPRM example'],
    ['2024-01-31', 13, '2025-02-28', 'KPRM example, no 31st in February'],
    ['2024-01-31', 1, '2024-02-29', 'KPRM example, leap year'],
    ['2016-04-04', 24, '2018-04-04', 'DSC FAQ 10'],
  ])('%s + %i months is due %s (%s)', (event, count, expected) => {
    expect(compute(months(count, false), event)).toMatchObject({ kind: 'due', due: expected });
  });

  it('moves an end on Saturday to Monday', () => {
    expect(compute(months(24, false), '2024-03-14')).toEqual({
      kind: 'due',
      windowStart: null,
      nominalDue: '2026-03-14',
      due: '2026-03-16',
      extendedByDays: 0,
    });
  });

  it('keeps an end on Saturday when the slot does not shift', () => {
    expect(compute(months(24, false, false), '2024-03-14')).toMatchObject({ due: '2026-03-14' });
  });
});

describe('days from the event (art. 111 § 2 Kc, the event day is not counted)', () => {
  it.each([
    ['2026-11-16', 7, '2026-11-23', '2026-11-23'],
    ['2026-11-13', 7, '2026-11-20', '2026-11-20'],
    ['2026-11-14', 7, '2026-11-21', '2026-11-23'],
    ['2026-12-10', 14, '2026-12-24', '2026-12-28'],
    ['2026-10-02', 30, '2026-11-01', '2026-11-02'],
  ])('%s + %i days ends %s and is due %s', (event, count, nominal, expected) => {
    expect(compute(days(count), event)).toMatchObject({ nominalDue: nominal, due: expected });
  });
});

describe('an end of term on a day off moves to the next working day (art. 115 Kc)', () => {
  it.each([
    ['2026-03-14', '2026-03-16', 'Saturday'],
    ['2026-08-15', '2026-08-17', 'Assumption on a Saturday'],
    ['2026-11-11', '2026-11-12', 'Independence Day'],
    ['2026-04-06', '2026-04-07', 'Easter Monday'],
    ['2027-03-28', '2027-03-30', 'Easter Sunday and Monday'],
    ['2026-06-04', '2026-06-05', 'Corpus Christi'],
    ['2026-05-01', '2026-05-04', 'Labour Day, a Saturday and 3 May on a Sunday'],
    ['2027-01-01', '2027-01-04', 'New Year and a weekend'],
    ['2027-01-06', '2027-01-07', 'Epiphany'],
    ['2025-12-24', '2025-12-29', 'Christmas Eve is a day off since 2025'],
    ['2024-12-24', '2024-12-24', 'Christmas Eve was a working day before 2025'],
    ['2010-01-06', '2010-01-06', 'Epiphany was a working day before 2011'],
    ['2026-12-31', '2026-12-31', 'an ordinary Thursday'],
  ])('a term ending %s is due %s (%s)', (end, expected) => {
    expect(compute(days(1), dayBefore(end))).toMatchObject({ nominalDue: end, due: expected });
  });
});

describe('window around the event (§ 9 ust. 2)', () => {
  it('opens 7 days before a position change and closes 30 days after it', () => {
    const rule: DeadlineRule = {
      strategy: 'windowAroundEvent',
      event: 'positionChange',
      daysBefore: 7,
      daysAfter: 30,
      shiftToWorkingDay: true,
      basis: 'test',
    };
    expect(compute(rule, '2026-11-20')).toEqual({
      kind: 'due',
      windowStart: '2026-11-13',
      nominalDue: '2026-12-20',
      due: '2026-12-21',
      extendedByDays: 0,
    });
  });
});

describe('extension by a justified absence longer than a month (art. 81 ust. 7)', () => {
  const cycle = months(24, true);
  const start = '2025-06-02';

  it('is due 24 months after the start without absences', () => {
    expect(compute(cycle, start)).toMatchObject({ due: '2027-06-02', extendedByDays: 0 });
  });

  it('joins sick leave and holiday separated by a weekend (KPRM example, 33 days)', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-10-16'],
      ['2026-10-19', '2026-11-06'],
    ]);
    expect(result).toMatchObject({
      nominalDue: '2027-07-05',
      due: '2027-07-05',
      extendedByDays: 33,
    });
  });

  it('does not join absences separated by a working day', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-10-15'],
      ['2026-10-19', '2026-11-06'],
    ]);
    expect(result).toMatchObject({ due: '2027-06-02', extendedByDays: 0 });
  });

  it('does not extend for an absence of exactly one month', () => {
    expect(compute(cycle, start, [['2026-10-05', '2026-11-04']])).toMatchObject({
      extendedByDays: 0,
    });
  });

  it('extends for an absence one day longer than a month, then shifts from Sunday', () => {
    expect(compute(cycle, start, [['2026-10-05', '2026-11-05']])).toMatchObject({
      nominalDue: '2027-07-04',
      due: '2027-07-05',
      extendedByDays: 32,
    });
  });

  it('joins absences across a public holiday and a weekend', () => {
    const result = compute(cycle, start, [
      ['2026-12-01', '2026-12-31'],
      ['2027-01-04', '2027-01-15'],
    ]);
    expect(result).toMatchObject({
      nominalDue: '2027-07-18',
      due: '2027-07-19',
      extendedByDays: 46,
    });
  });

  it('merges overlapping absences', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-10-20'],
      ['2026-10-15', '2026-11-10'],
    ]);
    expect(result).toMatchObject({ due: '2027-07-09', extendedByDays: 37 });
  });

  it('counts an absence that starts before the extended deadline', () => {
    const result = compute(cycle, start, [
      ['2026-10-05', '2026-11-06'],
      ['2027-06-14', '2027-07-31'],
    ]);
    expect(result).toMatchObject({
      nominalDue: '2027-08-22',
      due: '2027-08-23',
      extendedByDays: 81,
    });
  });

  it('ignores absences after the deadline and before the event', () => {
    const result = compute(cycle, start, [
      ['2025-01-01', '2025-03-31'],
      ['2027-06-10', '2027-08-10'],
    ]);
    expect(result).toMatchObject({ due: '2027-06-02', extendedByDays: 0 });
  });

  it('suspends the deadline while an absence has no end date', () => {
    expect(compute(cycle, start, [['2026-10-05', null]])).toEqual({
      kind: 'suspended',
      since: '2026-10-05',
    });
  });

  it('ignores absences when the slot is not extended (art. 81 ust. 9, DSC FAQ 19)', () => {
    const result = compute(months(6, false, false), '2026-11-16', [['2026-12-01', '2027-02-26']]);
    expect(result).toMatchObject({ due: '2027-05-16', extendedByDays: 0 });
  });

  it('rejects an absence that ends before it starts', () => {
    expect(() => compute(cycle, start, [['2026-10-05', '2026-10-01']])).toThrow(RangeError);
  });
});
```

- [ ] **Step 10: Zainstaluj i commit**

```bash
rtk pnpm install
rtk pnpm exec prettier --write backend/domain
rtk git add pnpm-workspace.yaml pnpm-lock.yaml backend/domain
rtk git commit -m "feat(domain): deadline strategies with polish holidays and absence extension" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 2: Domena: dokument wersji przepisów

Schemat zod całego dokumentu wersji przepisów (ADR 0006): źródła prawa, skala cząstkowa, przedziały poziomu ogólnego, wynik, uzasadnienie, katalog kryteriów, kryteria dodatkowe, arkusze, sloty terminów, zmiana terminu, stopień z mocy prawa i informacja zwrotna z zarządzenia nr 6. Każda reguła ma pole z podstawą prawną. Schemat sprawdza też spójność odwołań (kryteria arkusza istnieją w katalogu, przedziały pokrywają skalę bez luk), bo edytor reguł będzie publikował wersje lokalne przez ten sam schemat. Testy schematu leżą w `@sarmata/regulations` (zadanie 3), gdzie jest prawdziwy dokument, więc domena nie trzyma kopii danych w fiksturze.

**Files:**
- Create: `backend/domain/src/regulations/regulation-document.ts`, `backend/domain/src/regulations/version-in-force.ts`
- Modify: `backend/domain/src/index.ts`
- Test: `backend/domain/src/regulations/version-in-force.test.ts`

- [ ] **Step 1: Utwórz `backend/domain/src/regulations/regulation-document.ts`**

```ts
import { z } from 'zod';
import { calendarDate } from '../deadlines/calendar-date';
import { deadlineRuleSchema } from '../deadlines/deadline-rule';

const identifier = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'expected a kebab-case identifier');
const text = z.string().min(1);
const basis = z.string().min(1);

const isoDate = z.string().transform((value, ctx) => {
  try {
    return calendarDate(value);
  } catch {
    ctx.issues.push({ code: 'custom', message: `invalid date ${value}`, input: value });
    return z.NEVER;
  }
});

export const deadlineSlotSchema = z.enum([
  'startingInterview',
  'startingInterviewAfterNegative',
  'evaluationDeadline',
  'reevaluationAfterNegative',
  'criteriaResetAfterPositionChange',
  'evaluationOnPositionChange',
  'objection',
  'objectionDecision',
  'labourCourtAppeal',
  'gradeByLawGrant',
]);

const termChangeReasonSchema = z.enum([
  'evaluatorChange',
  'expectedAbsenceOfEvaluated',
  'expectedAbsenceOfEvaluator',
  'requestOfEvaluated',
]);

const regulationDocumentShape = z.strictObject({
  id: identifier,
  name: text,
  effectiveFrom: isoDate,
  legalBasis: basis,
  sources: z
    .array(
      z.strictObject({
        id: identifier,
        title: text,
        citation: text,
        text: z.string().regex(/^docs\/legal\/[^/]+\.md$/, 'expected a file in docs/legal'),
      }),
    )
    .min(1),
  partialScale: z.strictObject({
    basis,
    levels: z
      .array(z.strictObject({ code: identifier, name: text, points: z.number().int().positive() }))
      .min(2),
  }),
  overallLevel: z.strictObject({
    basis,
    method: z.literal('arithmeticMean'),
    bands: z
      .array(
        z.strictObject({
          code: identifier,
          min: z.number(),
          minInclusive: z.boolean(),
          max: z.number(),
        }),
      )
      .min(2),
  }),
  outcome: z.strictObject({
    basis,
    positiveLevels: z.array(identifier).min(1),
    negativeIfAnyPartialIs: identifier,
  }),
  justification: z.strictObject({
    basis,
    requiredForNegative: z.boolean(),
    requiredForPositive: z.boolean(),
  }),
  criteria: z.strictObject({
    basis,
    catalog: z
      .array(z.strictObject({ id: identifier, name: text, indicators: z.array(text).min(1) }))
      .min(1),
  }),
  additionalCriteria: z.strictObject({
    basis,
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    fromMandatoryAllowed: z.boolean(),
  }),
  sheets: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[A-Z]$/, 'expected a single capital letter'),
        annex: z.number().int().positive(),
        basis,
        position: text,
        mandatoryCriteria: z.array(identifier).min(1),
        orgUnitFields: z.boolean(),
        objectionAddressee: text.nullable(),
      }),
    )
    .min(1),
  deadlines: z.partialRecord(deadlineSlotSchema, deadlineRuleSchema),
  termChange: z.strictObject({
    basis,
    minimumElapsedMonths: z.number().int().positive(),
    reasons: z.array(termChangeReasonSchema).min(1),
    writtenNoticeRequired: z.boolean(),
  }),
  gradeByLaw: z.strictObject({
    basis,
    consecutiveEvaluations: z.number().int().positive(),
    qualifyingLevels: z.array(identifier).min(1),
    sameLevelRequired: z.boolean(),
  }),
  feedback: z.strictObject({ basis, ongoing: z.boolean(), periodic: z.boolean() }),
});

type Shape = z.output<typeof regulationDocumentShape>;

function checkReferences(document: Shape, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: 'custom', path, message });
  };
  const levels = new Set(document.partialScale.levels.map((level) => level.code));
  const criteria = new Set<string>();
  document.criteria.catalog.forEach((criterion, index) => {
    if (criteria.has(criterion.id)) {
      issue(['criteria', 'catalog', index, 'id'], `duplicate criterion ${criterion.id}`);
    }
    criteria.add(criterion.id);
  });
  const checkLevel = (path: (string | number)[], code: string): void => {
    if (!levels.has(code)) issue(path, `unknown level ${code}`);
  };
  document.overallLevel.bands.forEach((band, index) => {
    checkLevel(['overallLevel', 'bands', index, 'code'], band.code);
  });
  document.outcome.positiveLevels.forEach((code, index) => {
    checkLevel(['outcome', 'positiveLevels', index], code);
  });
  checkLevel(['outcome', 'negativeIfAnyPartialIs'], document.outcome.negativeIfAnyPartialIs);
  document.gradeByLaw.qualifyingLevels.forEach((code, index) => {
    checkLevel(['gradeByLaw', 'qualifyingLevels', index], code);
  });
  document.sheets.forEach((sheet, sheetIndex) => {
    sheet.mandatoryCriteria.forEach((id, index) => {
      if (!criteria.has(id)) {
        issue(['sheets', sheetIndex, 'mandatoryCriteria', index], `unknown criterion ${id}`);
      }
    });
  });
  if (document.additionalCriteria.min > document.additionalCriteria.max) {
    issue(['additionalCriteria', 'min'], 'min is greater than max');
  }
  const points = document.partialScale.levels.map((level) => level.points);
  const bands = document.overallLevel.bands;
  if (bands[0]?.min !== Math.min(...points) || bands.at(-1)?.max !== Math.max(...points)) {
    issue(['overallLevel', 'bands'], 'bands must cover the whole partial scale');
  }
  bands.forEach((band, index) => {
    const previous = bands[index - 1];
    if (previous && previous.max !== band.min) {
      issue(['overallLevel', 'bands', index, 'min'], 'bands must be contiguous');
    }
  });
}

/** A complete regulation version (wersja przepisów): parameters and deadline slots with legal basis. */
export const regulationDocumentSchema = regulationDocumentShape.superRefine(checkReferences);

export type RegulationDocument = z.output<typeof regulationDocumentSchema>;
export type DeadlineSlot = z.infer<typeof deadlineSlotSchema>;

export class RegulationDocumentError extends Error {
  readonly issues: z.ZodError['issues'];

  constructor(message: string, issues: z.ZodError['issues']) {
    super(message);
    this.name = 'RegulationDocumentError';
    this.issues = issues;
  }
}

/** Validates an untrusted document (JSON file, jsonb row, editor draft). Throws `RegulationDocumentError`. */
export function parseRegulationDocument(input: unknown): RegulationDocument {
  const result = regulationDocumentSchema.safeParse(input);
  if (!result.success) {
    throw new RegulationDocumentError(
      `Invalid regulation document:\n${z.prettifyError(result.error)}`,
      result.error.issues,
    );
  }
  return result.data;
}
```

- [ ] **Step 2: Utwórz `backend/domain/src/regulations/version-in-force.ts`**

```ts
import { type CalendarDate } from '../deadlines/calendar-date';

/**
 * The version in force on a day: the latest one whose `effectiveFrom` is not after it.
 * An evaluation pins the version in force on the day it starts (GLOSSARY.md, Wersja przepisów).
 */
export function versionInForce<T extends { readonly effectiveFrom: CalendarDate }>(
  versions: readonly T[],
  on: CalendarDate,
): T | null {
  let best: T | null = null;
  for (const version of versions) {
    if (
      version.effectiveFrom <= on &&
      (best === null || version.effectiveFrom > best.effectiveFrom)
    ) {
      best = version;
    }
  }
  return best;
}
```

- [ ] **Step 3: Dopisz eksporty na końcu `backend/domain/src/index.ts`**

```ts
export {
  type DeadlineSlot,
  type RegulationDocument,
  RegulationDocumentError,
  parseRegulationDocument,
  regulationDocumentSchema,
} from './regulations/regulation-document';
export { versionInForce } from './regulations/version-in-force';
```

- [ ] **Step 4: Napisz `backend/domain/src/regulations/version-in-force.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { calendarDate, versionInForce } from '../index';

const version = (effectiveFrom: string) => ({
  id: effectiveFrom,
  effectiveFrom: calendarDate(effectiveFrom),
});

describe('versionInForce', () => {
  const versions = [version('2027-03-01'), version('2016-04-23')];

  it.each([
    ['2026-11-21', '2016-04-23'],
    ['2027-02-28', '2016-04-23'],
    ['2027-03-01', '2027-03-01'],
    ['2030-01-01', '2027-03-01'],
  ])('on %s picks the version effective from %s', (on, expected) => {
    expect(versionInForce(versions, calendarDate(on))?.id).toBe(expected);
  });

  it('returns null before the first version', () => {
    expect(versionInForce(versions, calendarDate('2016-04-22'))).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(versionInForce([], calendarDate('2026-11-21'))).toBeNull();
  });
});
```

- [ ] **Step 5: Commit**

```bash
rtk pnpm exec prettier --write backend/domain
rtk git add backend/domain
rtk git commit -m "feat(domain): regulation document schema and version in force" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 3: Pakiet `@sarmata/regulations`: oficjalna wersja przepisów obowiązujących

Jedna wersja zbudowana z ustawy o służbie cywilnej (t.j. Dz.U. 2026 poz. 590), rozporządzenia z 2016 r. i zarządzenia nr 6 Szefa SC, z danymi z `docs/legal/oceny-okresowe-dane.yaml`. Katalog wersji to `backend/regulations/regulation-2016/` z `rules.json` i testami przypadków. Teksty prawne do RAG wskazuje pole `sources` (pliki w `docs/legal/`), bez kopiowania. Wersja nie potrzebuje własnych strategii, więc nie ma `strategies.ts` (zob. przegląd na końcu). Pakiet eksportuje listę oficjalnych wersji ze statycznego importu JSON, bez `node:fs`.

Kody poziomów i kryteriów są po angielsku (dane czytane przez kod), nazwy i wskaźniki po polsku (trafiają na arkusz). Mapowanie kryteriów z YAML: komunikacja `communication`, kreatywnosc `creativity`, negocjowanie `negotiation`, organizacja_pracy `work-organization`, orientacja_na_klienta `customer-orientation`, podejmowanie_decyzji `decision-making`, sytuacje_kryzysowe `crisis-management`, rzetelnosc `reliability`, myslenie_analityczne `analytical-thinking`, wykorzystywanie_wiedzy `knowledge-use`, wspolpraca `cooperation`, wystapienia_publiczne `public-speaking`, zarzadzanie_ludzmi `people-management`, zarzadzanie_strategiczne `strategic-management`. Poziomy: ZPO `far-below`, PO `below`, NPO `meets`, POW `above`, ZPOW `far-above`.

`fromMandatoryAllowed: false` to decyzja ze specu funkcjonalnego (P-10: blokada kryterium obowiązkowego wybranego jako dodatkowe). `sameLevelRequired: false` to wariant szerszy z P-18 i ze specu („dowolne połączenie dwóch najwyższych poziomów”).

**Files:**
- Create: `backend/regulations/package.json`, `backend/regulations/tsconfig.json`, `backend/regulations/src/index.ts`, `backend/regulations/regulation-2016/rules.json`
- Modify: `eslint.config.mjs`
- Test: `backend/regulations/src/catalog.test.ts`, `backend/regulations/regulation-2016/cases.test.ts`

- [ ] **Step 1: Utwórz `backend/regulations/package.json`**

```json
{
  "name": "@sarmata/regulations",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@sarmata/domain": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Utwórz `backend/regulations/tsconfig.json`**

Każdy katalog wersji nazywa się `regulation-<rok>`, więc wzorzec obejmie przyszłe wersje.

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "regulation-*"]
}
```

- [ ] **Step 3: Utwórz `backend/regulations/regulation-2016/rules.json`**

```json
{
  "id": "regulation-2016",
  "name": "Ocena okresowa według ustawy o służbie cywilnej i rozporządzenia z 2016 r.",
  "effectiveFrom": "2016-04-23",
  "legalBasis": "ustawa o służbie cywilnej (Dz.U. 2026 poz. 590 t.j.), rozporządzenie PRM z 4.04.2016 r. (Dz.U. 2016 poz. 470, w mocy od 23.04.2016, § 14), zarządzenie nr 6 Szefa SC z 12.03.2020 r.",
  "sources": [
    {
      "id": "civil-service-act",
      "title": "Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej",
      "citation": "Dz.U. 2026 poz. 590 t.j.",
      "text": "docs/legal/ustawa-o-sluzbie-cywilnej-tj-2026.md"
    },
    {
      "id": "periodic-evaluation-regulation",
      "title": "Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej",
      "citation": "Dz.U. 2016 poz. 470",
      "text": "docs/legal/rozporzadzenie-oceny-okresowe-2016.md"
    },
    {
      "id": "hr-standards-order-6",
      "title": "Zarządzenie nr 6 Szefa Służby Cywilnej z dnia 12 marca 2020 r. w sprawie standardów zarządzania zasobami ludzkimi w służbie cywilnej",
      "citation": "publikacja na gov.pl/web/sluzbacywilna, zmienione zarządzeniem nr 7 z 16.12.2020 r.",
      "text": "docs/legal/zarzadzenie-6-szefa-sc-2020-standardy-zzl.md"
    }
  ],
  "partialScale": {
    "basis": "§ 11 ust. 1 pkt 1 rozporządzenia",
    "levels": [
      { "code": "far-below", "name": "znacznie poniżej oczekiwań", "points": 1 },
      { "code": "below", "name": "poniżej oczekiwań", "points": 3 },
      { "code": "meets", "name": "na poziomie oczekiwań", "points": 5 },
      { "code": "above", "name": "powyżej oczekiwań", "points": 7 },
      { "code": "far-above", "name": "znacznie powyżej oczekiwań", "points": 9 }
    ]
  },
  "overallLevel": {
    "basis": "§ 11 ust. 1 pkt 2 rozporządzenia",
    "method": "arithmeticMean",
    "bands": [
      { "code": "far-below", "min": 1, "minInclusive": true, "max": 2 },
      { "code": "below", "min": 2, "minInclusive": false, "max": 4 },
      { "code": "meets", "min": 4, "minInclusive": false, "max": 6 },
      { "code": "above", "min": 6, "minInclusive": false, "max": 8 },
      { "code": "far-above", "min": 8, "minInclusive": false, "max": 9 }
    ]
  },
  "outcome": {
    "basis": "§ 11 ust. 1 pkt 3 i 4 rozporządzenia",
    "positiveLevels": ["meets", "above", "far-above"],
    "negativeIfAnyPartialIs": "far-below"
  },
  "justification": {
    "basis": "§ 11 ust. 3 i 4 rozporządzenia",
    "requiredForNegative": true,
    "requiredForPositive": false
  },
  "criteria": {
    "basis": "załącznik nr 1 do rozporządzenia",
    "catalog": [
      {
        "id": "communication",
        "name": "Komunikacja",
        "indicators": [
          "Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie.",
          "Wypowiadanie się w sposób jasny i precyzyjny, dostosowany do sytuacji i rozmówcy (dobieranie stylu, języka i treści).",
          "Formułowanie jasnych i precyzyjnych wypowiedzi pisemnych dostosowanych do sytuacji i odbiorcy (dobieranie stylu, języka i treści).",
          "Przedstawianie przekonujących argumentów odpowiednio do sytuacji."
        ]
      },
      {
        "id": "creativity",
        "name": "Kreatywność",
        "indicators": [
          "Proponowanie lub tworzenie nowych rozwiązań.",
          "Nieschematyczne podejście do zadań."
        ]
      },
      {
        "id": "negotiation",
        "name": "Negocjowanie",
        "indicators": [
          "Przygotowywanie się do negocjacji, w szczególności opracowanie projektu stanowiska, zakresu możliwych ustępstw i argumentacji.",
          "Stosowanie technik i strategii negocjacyjnych.",
          "Osiągnięcie efektu negocjacji akceptowanego przez przełożonych."
        ]
      },
      {
        "id": "work-organization",
        "name": "Organizacja pracy i orientacja na osiąganie celów",
        "indicators": [
          "Określanie sposobu realizacji zadań/celów.",
          "Realizowanie zadań/celów w kolejności uwzględniającej ich wagę i pilność (ustalanie priorytetów działania).",
          "Dobieranie niezbędnych zasobów umożliwiających realizację zadań/celów.",
          "Dostosowywanie się do zmieniających się okoliczności.",
          "Wytrwałość i zaangażowanie w realizację zadań/celów."
        ]
      },
      {
        "id": "customer-orientation",
        "name": "Orientacja na klienta/interesanta",
        "indicators": [
          "Taktowne zachowanie, wyrażające szacunek i zrozumienie dla drugiej osoby.",
          "Reagowanie na potrzeby klienta/interesanta, w szczególności rozpoznawanie jego potrzeb i proponowanie rozwiązań."
        ]
      },
      {
        "id": "decision-making",
        "name": "Podejmowanie decyzji i odpowiedzialność",
        "indicators": [
          "Wypracowywanie alternatywnych rozwiązań na podstawie analizy informacji, w szczególności potencjalnego ryzyka.",
          "Podejmowanie decyzji (decyzyjność).",
          "Przyjmowanie odpowiedzialności za efekty podjętych decyzji."
        ]
      },
      {
        "id": "crisis-management",
        "name": "Radzenie sobie w sytuacjach kryzysowych",
        "indicators": [
          "Rozpoznawanie sytuacji kryzysowych i informowanie o nich zainteresowanych.",
          "Podejmowanie działań mających na celu rozwiązanie kryzysu.",
          "Wyciąganie wniosków z sytuacji kryzysowych."
        ]
      },
      {
        "id": "reliability",
        "name": "Rzetelność",
        "indicators": [
          "Wykonywanie zadań zgodnie z obowiązującymi standardami (przepisami, zasadami, procedurami) oraz dbałość o jakość rezultatów.",
          "Dotrzymywanie zobowiązań (realizacja zadań) w wyznaczonym czasie."
        ]
      },
      {
        "id": "analytical-thinking",
        "name": "Myślenie analityczne",
        "indicators": [
          "Rozróżnianie informacji istotnych i nieistotnych.",
          "Dostrzeganie zależności między informacjami.",
          "Formułowanie wniosków."
        ]
      },
      {
        "id": "knowledge-use",
        "name": "Wykorzystywanie wiedzy i doskonalenie zawodowe",
        "indicators": [
          "Wykorzystywanie wiedzy przy realizacji zadań na zajmowanym stanowisku pracy.",
          "Doskonalenie wiedzy i umiejętności niezbędnych do wykonywania zadań na zajmowanym stanowisku pracy, w szczególności wyszukiwanie i pozyskiwanie wiedzy, korzystanie z dobrych praktyk i doświadczeń innych.",
          "Korzystanie z dostępnych źródeł informacji, rozwiązań i technologii."
        ]
      },
      {
        "id": "cooperation",
        "name": "Współpraca",
        "indicators": [
          "Włączanie się w działania realizowane razem z innymi osobami, jeśli istnieje taka możliwość.",
          "Dbanie o przepływ informacji.",
          "Dbanie o dobrą atmosferę i otwartość we współpracy.",
          "Dostrzeganie wkładu pracy innych osób.",
          "Branie pod uwagę zdania innych osób.",
          "Dzielenie się wiedzą i doświadczeniem."
        ]
      },
      {
        "id": "public-speaking",
        "name": "Wystąpienia publiczne",
        "indicators": [
          "Wykorzystywanie różnych środków przekazu (np. narzędzi multimedialnych) i dbałość o sposób prezentacji (w tym autoprezentacji).",
          "Nawiązywanie i utrzymywanie kontaktu z audytorium.",
          "Zarządzanie czasem wystąpienia, w szczególności przestrzeganie ram czasowych, elastyczne reagowanie na potrzeby audytorium.",
          "Radzenie sobie ze stresem i emocjami, w szczególności wywołanymi krytyką i trudnymi pytaniami."
        ]
      },
      {
        "id": "people-management",
        "name": "Zarządzanie ludźmi",
        "indicators": [
          "Przydzielanie zakresu odpowiedzialności, zadań i uprawnień pracownikom (delegowanie zadań).",
          "Monitorowanie realizacji zadań oraz w razie potrzeby podejmowanie działań korygujących lub zapobiegawczych.",
          "Motywowanie pracowników.",
          "Udzielanie pracownikom informacji zwrotnej opartej na ocenie ich zaangażowania i sposobu realizacji zadań.",
          "Rozwiązywanie konfliktów.",
          "Wspieranie pracowników w rozwoju zawodowym, w szczególności identyfikowanie potrzeb rozwojowych, proponowanie działań rozwojowych oraz monitorowanie ich realizacji."
        ]
      },
      {
        "id": "strategic-management",
        "name": "Zarządzanie strategiczne",
        "indicators": [
          "Tworzenie wizji oraz wyznaczanie celów strategicznych w oparciu o całościowe i perspektywiczne widzenie organizacji, otoczenia oraz strategie rozwoju.",
          "Formułowanie celów operacyjnych na podstawie celów strategicznych.",
          "Analiza ryzyka planowanych działań o charakterze strategicznym."
        ]
      }
    ]
  },
  "additionalCriteria": {
    "basis": "§ 2 ust. 2 i § 5 ust. 2 rozporządzenia, blokada kryterium obowiązkowego: spec funkcjonalny (P-10)",
    "min": 0,
    "max": 3,
    "fromMandatoryAllowed": false
  },
  "sheets": [
    {
      "id": "A",
      "annex": 2,
      "basis": "§ 3 ust. 2 i § 4 ust. 1 rozporządzenia",
      "position": "kierownik urzędu, gdy jest to stanowisko pracy w służbie cywilnej",
      "mandatoryCriteria": [
        "people-management",
        "decision-making",
        "work-organization",
        "cooperation",
        "communication",
        "strategic-management"
      ],
      "orgUnitFields": false,
      "objectionAddressee": null
    },
    {
      "id": "B",
      "annex": 3,
      "basis": "§ 3 ust. 3 i § 4 ust. 2 rozporządzenia",
      "position": "praca polegająca na bezpośrednim kierowaniu pracownikami, inna niż kierownik urzędu",
      "mandatoryCriteria": [
        "people-management",
        "decision-making",
        "work-organization",
        "cooperation",
        "communication"
      ],
      "orgUnitFields": true,
      "objectionAddressee": "dyrektor generalny urzędu (albo kierownik urzędu, gdy nie ma stanowiska dyrektora generalnego)"
    },
    {
      "id": "C",
      "annex": 4,
      "basis": "§ 3 ust. 4 i § 4 ust. 3 rozporządzenia",
      "position": "pozostałe stanowiska",
      "mandatoryCriteria": [
        "knowledge-use",
        "reliability",
        "work-organization",
        "cooperation",
        "communication"
      ],
      "orgUnitFields": true,
      "objectionAddressee": "dyrektor generalny urzędu (albo kierownik urzędu, gdy nie ma stanowiska dyrektora generalnego)"
    }
  ],
  "deadlines": {
    "startingInterview": {
      "strategy": "daysFromEvent",
      "event": "cycleStart",
      "days": 30,
      "shiftToWorkingDay": true,
      "basis": "§ 7 pkt 1 rozporządzenia: 30 dni od sporządzenia poprzedniej oceny albo od zatrudnienia na czas nieokreślony"
    },
    "startingInterviewAfterNegative": {
      "strategy": "daysFromEvent",
      "event": "cycleStart",
      "days": 7,
      "shiftToWorkingDay": true,
      "basis": "§ 7 pkt 2 rozporządzenia: 7 dni od sporządzenia oceny negatywnej"
    },
    "evaluationDeadline": {
      "strategy": "monthsFromEvent",
      "event": "cycleStart",
      "months": 24,
      "extendByAbsencesLongerThanMonth": true,
      "shiftToWorkingDay": true,
      "basis": "art. 81 ust. 4 i 7 ustawy: co 24 miesiące, przedłużenie o usprawiedliwioną nieobecność dłuższą niż miesiąc"
    },
    "reevaluationAfterNegative": {
      "strategy": "monthsFromEvent",
      "event": "acquaintance",
      "months": 6,
      "extendByAbsencesLongerThanMonth": false,
      "shiftToWorkingDay": false,
      "basis": "art. 81 ust. 9 ustawy: po upływie 6 miesięcy od zapoznania z oceną negatywną, bez przedłużenia o nieobecność (DSC FAQ 19). Data to dzień, po którym ocenę sporządza się niezwłocznie, więc nie przechodzi na dzień roboczy"
    },
    "criteriaResetAfterPositionChange": {
      "strategy": "daysFromEvent",
      "event": "positionChange",
      "days": 30,
      "shiftToWorkingDay": true,
      "basis": "§ 9 ust. 1 rozporządzenia: ponowna rozmowa i ustalenie kryteriów w 30 dni od zmiany stanowiska, termin oceny bez zmian"
    },
    "evaluationOnPositionChange": {
      "strategy": "windowAroundEvent",
      "event": "positionChange",
      "daysBefore": 7,
      "daysAfter": 30,
      "shiftToWorkingDay": true,
      "basis": "art. 81 ust. 6 ustawy i § 9 ust. 2 rozporządzenia: ocena nie wcześniej niż 7 dni przed zmianą i nie później niż 30 dni po zmianie"
    },
    "objection": {
      "strategy": "daysFromEvent",
      "event": "acquaintance",
      "days": 7,
      "shiftToWorkingDay": true,
      "basis": "art. 83 ust. 1 ustawy: sprzeciw w 7 dni od zapoznania z oceną"
    },
    "objectionDecision": {
      "strategy": "daysFromEvent",
      "event": "objectionFiled",
      "days": 14,
      "shiftToWorkingDay": true,
      "basis": "art. 83 ust. 3 ustawy: rozpatrzenie sprzeciwu w 14 dni od wniesienia"
    },
    "labourCourtAppeal": {
      "strategy": "daysFromEvent",
      "event": "objectionOutcome",
      "days": 14,
      "shiftToWorkingDay": true,
      "basis": "art. 83 ust. 5 ustawy: odwołanie do sądu pracy w 14 dni od doręczenia decyzji albo od upływu terminu na rozpatrzenie sprzeciwu"
    },
    "gradeByLawGrant": {
      "strategy": "daysFromEvent",
      "event": "acquaintance",
      "days": 30,
      "shiftToWorkingDay": true,
      "basis": "art. 89 ust. 2 ustawy: kolejny stopień służbowy w 30 dni od zapoznania z oceną"
    }
  },
  "termChange": {
    "basis": "art. 81 ust. 8 ustawy i § 8 rozporządzenia",
    "minimumElapsedMonths": 6,
    "reasons": [
      "evaluatorChange",
      "expectedAbsenceOfEvaluated",
      "expectedAbsenceOfEvaluator",
      "requestOfEvaluated"
    ],
    "writtenNoticeRequired": true
  },
  "gradeByLaw": {
    "basis": "art. 89 ust. 2 ustawy, wariant szerszy (P-18, spec funkcjonalny)",
    "consecutiveEvaluations": 2,
    "qualifyingLevels": ["above", "far-above"],
    "sameLevelRequired": false
  },
  "feedback": {
    "basis": "zarządzenie nr 6 Szefa SC, cz. IV pkt 6: system informacji zwrotnej, bieżącej i cyklicznej (standard obligatoryjny)",
    "ongoing": true,
    "periodic": true
  }
}
```

- [ ] **Step 4: Utwórz `backend/regulations/src/index.ts`**

```ts
import { type RegulationDocument, parseRegulationDocument } from '@sarmata/domain';
import regulation2016 from '../regulation-2016/rules.json';

/**
 * Official regulation versions, oldest first. A new version is a new `regulation-<year>/` directory
 * added here. Parsing at import makes an invalid catalog fail every test and every process start.
 */
export const officialRegulations: readonly RegulationDocument[] = [
  parseRegulationDocument(regulation2016),
];
```

- [ ] **Step 5: Napisz `backend/regulations/src/catalog.test.ts`**

```ts
import { RegulationDocumentError, parseRegulationDocument } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import rules2016 from '../regulation-2016/rules.json';
import { officialRegulations } from './index';

type RawDocument = typeof rules2016;

const parseMutated = (mutate: (document: RawDocument) => void) => () => {
  const document = structuredClone(rules2016);
  mutate(document);
  return parseRegulationDocument(document);
};

describe('official regulation catalog', () => {
  it('contains only the law in force', () => {
    expect(officialRegulations.map((version) => version.id)).toEqual(['regulation-2016']);
  });

  it('defines every deadline slot of the 2016 regulation', () => {
    const version = officialRegulations[0];
    expect(Object.keys(version?.deadlines ?? {}).sort()).toEqual([
      'criteriaResetAfterPositionChange',
      'evaluationDeadline',
      'evaluationOnPositionChange',
      'gradeByLawGrant',
      'labourCourtAppeal',
      'objection',
      'objectionDecision',
      'reevaluationAfterNegative',
      'startingInterview',
      'startingInterviewAfterNegative',
    ]);
  });

  it('lists the 14 criteria of annex 1 and the mandatory criteria of sheet C (§ 4 ust. 3)', () => {
    const version = officialRegulations[0];
    expect(version?.criteria.catalog).toHaveLength(14);
    expect(version?.sheets.find((sheet) => sheet.id === 'C')?.mandatoryCriteria).toEqual([
      'knowledge-use',
      'reliability',
      'work-organization',
      'cooperation',
      'communication',
    ]);
  });
});

describe('regulation document schema', () => {
  it.each([
    [
      'a sheet refers to an unknown criterion',
      (document: RawDocument) => document.sheets[2]?.mandatoryCriteria.push('telepathy'),
      /unknown criterion telepathy/,
    ],
    [
      'an unknown deadline slot',
      (document: RawDocument) => {
        Object.assign(document.deadlines, { coffeeBreak: document.deadlines.objection });
      },
      /deadlines/,
    ],
    [
      'a deadline without legal basis',
      (document: RawDocument) => {
        Reflect.deleteProperty(document.deadlines.objection, 'basis');
      },
      /basis/,
    ],
    [
      'an unknown strategy',
      (document: RawDocument) => {
        document.deadlines.objection.strategy = 'whenever';
      },
      /strategy/,
    ],
    [
      'a gap between level bands',
      (document: RawDocument) => {
        const band = document.overallLevel.bands[2];
        if (band) band.min = 4.5;
      },
      /bands must be contiguous/,
    ],
    [
      'an unknown level in the outcome',
      (document: RawDocument) => {
        document.outcome.negativeIfAnyPartialIs = 'awful';
      },
      /unknown level awful/,
    ],
    [
      'more additional criteria at minimum than at maximum',
      (document: RawDocument) => {
        document.additionalCriteria.min = 4;
      },
      /min is greater than max/,
    ],
    [
      'a date that does not exist',
      (document: RawDocument) => {
        document.effectiveFrom = '2016-02-30';
      },
      /invalid date 2016-02-30/,
    ],
    [
      'a property the schema does not know',
      (document: RawDocument) => {
        Object.assign(document, { comment: 'draft' });
      },
      /comment/,
    ],
  ])('rejects %s', (_name, mutate, message) => {
    const parse = parseMutated(mutate);
    expect(parse).toThrow(RegulationDocumentError);
    expect(parse).toThrow(message);
  });
});
```

- [ ] **Step 6: Napisz testy przypadków wersji `backend/regulations/regulation-2016/cases.test.ts`**

```ts
import { type DeadlineSlot, calendarDate, computeDeadline } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from '../src/index';

const version = officialRegulations.find((candidate) => candidate.id === 'regulation-2016');

function deadline(slot: DeadlineSlot, eventDate: string, absences: [string, string][] = []) {
  const rule = version?.deadlines[slot];
  if (!rule) throw new Error(`regulation-2016 has no ${slot} slot`);
  return computeDeadline(rule, {
    eventDate: calendarDate(eventDate),
    absences: absences.map(([from, to]) => ({ from: calendarDate(from), to: calendarDate(to) })),
  });
}

describe('regulation-2016 deadlines (KPRM term counting, docs/analiza 1.5)', () => {
  it('evaluation 24 months after the cycle start (KPRM example)', () => {
    expect(deadline('evaluationDeadline', '2024-03-16')).toMatchObject({ due: '2026-03-16' });
  });

  it('evaluation 24 months after the previous one (DSC FAQ 10)', () => {
    expect(deadline('evaluationDeadline', '2016-04-04')).toMatchObject({ due: '2018-04-04' });
  });

  it('evaluation extended by the KPRM absence example', () => {
    const result = deadline('evaluationDeadline', '2025-06-02', [
      ['2026-10-05', '2026-10-16'],
      ['2026-10-19', '2026-11-06'],
    ]);
    expect(result).toMatchObject({ due: '2027-07-05', extendedByDays: 33 });
  });

  it.each([
    ['startingInterview', '2026-10-02', '2026-11-02'],
    ['startingInterviewAfterNegative', '2026-11-13', '2026-11-20'],
    ['reevaluationAfterNegative', '2026-11-16', '2027-05-16'],
    ['criteriaResetAfterPositionChange', '2027-02-01', '2027-03-03'],
    ['objection', '2026-11-14', '2026-11-23'],
    ['objectionDecision', '2026-12-10', '2026-12-28'],
    ['labourCourtAppeal', '2026-12-28', '2027-01-11'],
    ['gradeByLawGrant', '2026-11-16', '2026-12-16'],
  ] as const)('%s from %s is due %s', (slot, event, expected) => {
    expect(deadline(slot, event)).toMatchObject({ kind: 'due', due: expected });
  });

  it('reevaluation after a negative one is not extended by absences (DSC FAQ 19)', () => {
    const result = deadline('reevaluationAfterNegative', '2026-11-16', [
      ['2026-12-01', '2027-02-26'],
    ]);
    expect(result).toMatchObject({ due: '2027-05-16', extendedByDays: 0 });
  });

  it('evaluation on a position change has a window from 7 days before to 30 days after', () => {
    expect(deadline('evaluationOnPositionChange', '2026-11-20')).toMatchObject({
      windowStart: '2026-11-13',
      due: '2026-12-21',
    });
  });
});
```

- [ ] **Step 7: Dodaj granicę pakietu do `eslint.config.mjs`**

Wstaw przed linią `prettier,` na końcu tablicy:

```js
  {
    files: ['backend/regulations/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '@sarmata/*', '!@sarmata/domain'],
              message: 'Regulation versions are data and pure code on @sarmata/domain (ADR 0006).',
            },
            {
              group: ['node:*'],
              message: 'Regulation versions are pure: no Node built-ins and no I/O (ADR 0006).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Regulation versions are pure: no access to the process environment (ADR 0006).',
        },
      ],
    },
  },
```

- [ ] **Step 8: Zainstaluj i commit**

```bash
rtk pnpm install
rtk pnpm exec prettier --write backend/regulations
rtk git add backend/regulations eslint.config.mjs pnpm-lock.yaml
rtk git commit -m "feat(regulations): official 2016 regulation version with case tests" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 4: Baza: `regulation_versions` z niezmiennymi wersjami oficjalnymi

Wersja oficjalna to wiersz z `is_official = true` i `office_id = null`. To dane referencyjne wspólne dla wszystkich urzędów, więc potrzebny jest wyjątek w ADR 0001. Lokalny klon to wiersz urzędu z `is_official = false`. Niezmienność oficjalnych pilnuje wyzwalacz, który działa także dla roli serwisowej i właściciela bazy.

Dostęp nadal rozstrzyga jedno `access.can(action, resource, office_id, resource_id)` z planu 2. Rozszerzenie zachowuje jego zasadę: ciało to jedno wyrażenie bez zapytań do tabel i bez `SET search_path`, więc planer nadal wstawia je w polityki. Gałąź dla `regulation_version` czyta tylko argumenty i claimy JWT:
- wiersz bez `office_id` (wersja oficjalna) czyta każde konto należące do urzędu, a nikt go nie tworzy ani nie zmienia przez API,
- wiersz z `office_id` (klon lokalny) czyta urząd, a tworzy, zmienia i usuwa tylko rola `admin` tego urzędu (spec funkcjonalny, edytor reguł). Rola pochodzi z claimu `office_role` przez nową funkcję `access.current_office_role()`, odpowiednik `access.current_office_id()`.

Nowa wartość enuma `access.resource` musi być zatwierdzona, zanim użyje jej ciało funkcji albo polityka (Postgres odrzuca użycie wartości dodanej w tej samej transakcji), dlatego `alter type ... add value` ma osobny plik migracji.

**Files:**
- Create: `database/supabase/migrations/20261121130000_access_resource_regulation_version.sql`, `database/supabase/migrations/20261121130100_regulation_versions.sql`, `database/supabase/tests/002_regulation_versions.test.sql`
- Modify: `docs/adr/0001-office-id-od-poczatku.md`

- [ ] **Step 1: Utwórz `database/supabase/migrations/20261121130000_access_resource_regulation_version.sql`**

```sql
-- Regulation versions join the access model. Separate migration: a new enum value
-- cannot be used in the transaction that adds it.
alter type access.resource add value 'regulation_version';
```

- [ ] **Step 2: Utwórz `database/supabase/migrations/20261121130100_regulation_versions.sql`**

```sql
-- Regulation versions (wersje przepisów, ADR 0006). Official versions come from @sarmata/regulations
-- through regulations.syncOfficial() and are global reference data with office_id null (ADR 0001 exception).
-- Local versions are office clones edited by the office admin.
create table public.regulation_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  office_id uuid references public.offices (id) on delete cascade,
  is_official boolean not null,
  based_on uuid references public.regulation_versions (id),
  effective_from date not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  constraint regulation_versions_official_is_global check (is_official = (office_id is null)),
  constraint regulation_versions_document_code check (document ->> 'id' = code),
  constraint regulation_versions_document_effective_from
    check (document ->> 'effectiveFrom' = to_char(effective_from, 'YYYY-MM-DD')),
  constraint regulation_versions_code_unique unique nulls not distinct (office_id, code)
);
create index regulation_versions_office_id_idx on public.regulation_versions (office_id);
comment on table public.regulation_versions is
  'Regulation version (wersja przepisów): rules document validated by the zod schema in @sarmata/domain.';

-- Official versions are immutable for everyone, including service_role and postgres:
-- a change of the law is a new version, never an edit (ADR 0006).
create function public.prevent_official_regulation_version_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_official then
    raise exception 'official regulation version % is immutable', old.code;
  end if;
  if tg_op = 'UPDATE' and new.is_official then
    raise exception 'local regulation version % cannot become official', old.code;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger regulation_versions_official_immutable
  before update or delete on public.regulation_versions
  for each row execute function public.prevent_official_regulation_version_change();

-- Role of the signed-in account in its office (claim set by the JWT hook). Like current_office_id():
-- no SET search_path, so it stays inlinable.
create function access.current_office_role()
returns public.office_role
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'office_role', '')::public.office_role
$$;

-- Single access decision point, extended for regulation versions. Still one expression over the arguments
-- and JWT claims, without table lookups, so the planner inlines it into policies (plan 2 rule).
create or replace function access.can(action access.action, resource access.resource, office_id uuid, resource_id uuid)
returns boolean
language sql
stable
as $$
  select case
    -- Official versions (office_id null): global reference data, read by every account that belongs to an office.
    when resource = 'regulation_version' and office_id is null then
      action = 'read' and access.current_office_id() is not null
    -- Local versions: the office reads them, only the office admin changes them (docs/funkcjonalnosci.md, rule editor).
    when resource = 'regulation_version' and action <> 'read' then
      office_id = access.current_office_id() and access.current_office_role() = 'admin'
    else
      office_id is not null and office_id = access.current_office_id()
  end
$$;

revoke execute on function access.current_office_role() from public;
grant execute on function access.current_office_role() to authenticated;

alter table public.regulation_versions enable row level security;
-- Later migrations start without Data API grants (plan 2), so this is the complete surface.
grant select, insert, update, delete on public.regulation_versions to authenticated;

create policy "read regulation versions" on public.regulation_versions
  for select to authenticated
  using (access.can('read', 'regulation_version', office_id, id));

create policy "create regulation versions" on public.regulation_versions
  for insert to authenticated
  with check (access.can('create', 'regulation_version', office_id, id));

create policy "update regulation versions" on public.regulation_versions
  for update to authenticated
  using (access.can('update', 'regulation_version', office_id, id))
  with check (access.can('update', 'regulation_version', office_id, id));

create policy "delete regulation versions" on public.regulation_versions
  for delete to authenticated
  using (access.can('delete', 'regulation_version', office_id, id));
```

Rola `service_role` omija RLS i zachowuje domyślne granty Supabase do nowych tabel (plan 2 odebrał je tylko `anon` i `authenticated`). Wstawia wersje oficjalne w kroku synchronizacji, a zmienić ich nie może przez wyzwalacz. Gdy `office_id` jest puste, `access.current_office_id() is not null` i porównania dają `false` albo `null`, a RLS traktuje `null` jak odmowę.

- [ ] **Step 3: Utwórz `database/supabase/tests/002_regulation_versions.test.sql`**

Testy filtrują po kodach `test-%`, bo w bazie deweloperskiej może już być zsynchronizowana `regulation-2016`.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.offices (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Urząd A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Urząd B');
insert into public.regulation_versions (code, office_id, is_official, effective_from, document) values
  ('test-official', null, true, '2016-04-23', '{"id":"test-official","effectiveFrom":"2016-04-23"}'),
  ('test-local-a', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2016-04-23', '{"id":"test-local-a","effectiveFrom":"2016-04-23"}'),
  ('test-local-b', 'bbbbbbbb-0000-4000-8000-000000000002', false, '2016-04-23', '{"id":"test-local-b","effectiveFrom":"2016-04-23"}');

select throws_ok(
  $$update public.regulation_versions set document = document where code = 'test-official'$$,
  'P0001',
  'official regulation version test-official is immutable',
  'nobody updates an official version, not even the database owner'
);

select throws_ok(
  $$delete from public.regulation_versions where code = 'test-official'$$,
  'P0001',
  'official regulation version test-official is immutable',
  'nobody deletes an official version'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-mismatch', null, true, '2016-04-23', '{"id":"other","effectiveFrom":"2016-04-23"}')$$,
  '23514',
  null,
  'the document id must match the code'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-orphan', null, false, '2016-04-23', '{"id":"test-orphan","effectiveFrom":"2016-04-23"}')$$,
  '23514',
  null,
  'a local version belongs to an office'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"hr"}';

select results_eq(
  $$select code from public.regulation_versions where code like 'test-%' order by code$$,
  $$values ('test-local-a'), ('test-official')$$,
  'an account sees official versions and the local versions of its office'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-by-hr', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2016-04-23', '{"id":"test-by-hr","effectiveFrom":"2016-04-23"}')$$,
  '42501',
  null,
  'hr cannot create a local version'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4000-8000-000000000009","role":"authenticated","office_id":"aaaaaaaa-0000-4000-8000-000000000001","office_role":"admin"}';

select lives_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-by-admin', 'aaaaaaaa-0000-4000-8000-000000000001', false, '2016-04-23', '{"id":"test-by-admin","effectiveFrom":"2016-04-23"}')$$,
  'the office admin creates a local version'
);

update public.regulation_versions set document = document || '{"name":"changed"}' where code = 'test-local-a';
select is(
  (select document ->> 'name' from public.regulation_versions where code = 'test-local-a'),
  'changed',
  'the office admin edits a local version of the office'
);

select throws_ok(
  $$insert into public.regulation_versions (code, office_id, is_official, effective_from, document)
    values ('test-fake-official', null, true, '2016-04-23', '{"id":"test-fake-official","effectiveFrom":"2016-04-23"}')$$,
  '42501',
  null,
  'an admin cannot create an official version'
);

update public.regulation_versions set document = document || '{"name":"hijacked"}' where code = 'test-local-b';

set local request.jwt.claims = '{"sub":"cccccccc-1111-4000-8000-000000000003","role":"authenticated"}';

select is_empty(
  $$select 1 from public.regulation_versions where code like 'test-%'$$,
  'without office_id in the JWT no version is visible'
);

reset role;

select is(
  (select document ->> 'name' from public.regulation_versions where code = 'test-local-b'),
  null,
  'an admin cannot edit a local version of another office'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Dopisz wyjątek na końcu `docs/adr/0001-office-id-od-poczatku.md`**

```markdown

## Wyjątek: dane referencyjne

Oficjalne wersje przepisów w `regulation_versions` są wspólne dla wszystkich urzędów, więc mają `office_id` równe `null` i `is_official = true`. Czyta je każde konto należące do urzędu, a zmienić ich nie może nikt, także rola serwisowa (wyzwalacz w bazie, ADR 0006). Lokalne klony wersji przepisów mają `office_id` urzędu jak każda inna tabela domenowa. Decyzję o dostępie do obu rodzajów nadal podejmuje `access.can`. Kolejne tabele referencyjne bez `office_id` wymagają dopisania ich tutaj.
```

- [ ] **Step 5: Commit**

```bash
rtk git add database/supabase/migrations/20261121130000_access_resource_regulation_version.sql database/supabase/migrations/20261121130100_regulation_versions.sql database/supabase/tests/002_regulation_versions.test.sql docs/adr/0001-office-id-od-poczatku.md
rtk git commit -m "feat(db): regulation_versions with immutable official rows" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 5: Baza: kolejka zadań dla workera i typy

Worker czyta pgmq przez RPC supabase-js z kluczem serwisowym, a nie bezpośrednim połączeniem do Postgresa. Uzasadnienie: to ten sam sposób dostępu co reszta backendu (ADR 0004), działa z zewnętrzną instancją Supabase, gdzie port bazy bywa zamknięty (ADR 0003), nie dokłada sterownika ani drugiego rodzaju sekretu (hasło bazy) i nie wymaga wystawiania schematu `pgmq_public`. Koszt to odpytywanie co sekundę zamiast długiego `read_with_poll`, bez znaczenia dla zadań w tle liczonych w minutach. Trzy funkcje w schemacie `public` wołają pgmq jako właściciel (`security definer`) i są dostępne tylko dla `service_role`.

**Files:**
- Create: `database/supabase/migrations/20261121130200_job_queue.sql`, `database/supabase/tests/003_job_queue.test.sql`
- Modify: `database/src/types.ts` (generowany)

- [ ] **Step 1: Utwórz `database/supabase/migrations/20261121130200_job_queue.sql`**

```sql
-- Background jobs for backend/worker (ADR 0002): one pgmq queue, typed messages {type, payload}.
select pgmq.create('jobs');

create function public.job_queue_send(message jsonb, delay_seconds integer default 0)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select pgmq.send('jobs', message, delay_seconds)
$$;

create function public.job_queue_read(batch_size integer, visibility_timeout_seconds integer)
returns table (message_id bigint, read_count integer, enqueued_at timestamptz, message jsonb)
language sql
security definer
set search_path = ''
as $$
  select r.msg_id, r.read_ct, r.enqueued_at, r.message
    from pgmq.read('jobs', visibility_timeout_seconds, batch_size) r
$$;

create function public.job_queue_archive(message_id bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select pgmq.archive('jobs', message_id)
$$;

-- PUBLIC keeps execute on new functions (plan 2 removed only the anon and authenticated defaults).
revoke execute on function public.job_queue_send(jsonb, integer) from public, anon, authenticated;
revoke execute on function public.job_queue_read(integer, integer) from public, anon, authenticated;
revoke execute on function public.job_queue_archive(bigint) from public, anon, authenticated;
grant execute on function public.job_queue_send(jsonb, integer) to service_role;
grant execute on function public.job_queue_read(integer, integer) to service_role;
grant execute on function public.job_queue_archive(bigint) to service_role;
```

- [ ] **Step 2: Utwórz `database/supabase/tests/003_job_queue.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

set local role service_role;

select isnt(
  public.job_queue_send('{"type":"test.read","payload":{}}'::jsonb),
  null,
  'the service role enqueues a job'
);

select results_eq(
  $$select message ->> 'type' from public.job_queue_read(100, 30) where message ->> 'type' = 'test.read'$$,
  $$values ('test.read')$$,
  'the service role reads the job'
);

select ok(
  (with sent as (select public.job_queue_send('{"type":"test.archive","payload":{}}'::jsonb) as id)
   select public.job_queue_archive(id) from sent),
  'the service role archives a job'
);

reset role;
set local role authenticated;

select throws_ok(
  $$select public.job_queue_send('{"type":"test.denied","payload":{}}'::jsonb)$$,
  '42501',
  null,
  'an account cannot use the job queue'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Zastosuj migracje i wygeneruj typy**

Run: `rtk pnpm db:start && rtk pnpm --filter @sarmata/database reset && rtk pnpm db:types`
Expected: `database/src/types.ts` zawiera tabelę `regulation_versions` i funkcje `job_queue_send`, `job_queue_read`, `job_queue_archive`.

To wyjątek od zasady „bez sprawdzeń po drodze”: repozytoria w zadaniu 6 potrzebują tych typów.

- [ ] **Step 4: Commit**

```bash
rtk git add database/supabase/migrations/20261121130200_job_queue.sql database/supabase/tests/003_job_queue.test.sql database/src/types.ts
rtk git commit -m "feat(db): pgmq job queue rpc for the worker and regenerated types" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 6: Rozszerzenie pakietu `@sarmata/repositories`

Pakiet istnieje z planu 4 (zadanie 1): `package.json`, `tsconfig.json`, `src/db.ts` z typem `Db = SupabaseClient<Database>`, `src/auth.ts` (`readAccountClaims`), `src/offices.ts` (`findOfficeName`) i `src/index.ts`. Tego zadania nie zaczynaj, dopóki plan 4 nie jest zmergowany: `rtk ls backend/repositories/src` musi pokazać `db.ts`, `auth.ts`, `offices.ts` i `index.ts`. Istniejących plików nie przepisuj, tylko dodajesz pliki, eksporty i zależności.

Repozytoria to jedyne miejsce z zapytaniami do bazy. `createRepositories(db)` przyjmuje klienta supabase-js typu `Db`. Frontend tworzy go z JWT użytkownika przez `@supabase/ssr` (plan 4), więc RLS działa bez ręcznych claimów. Worker tworzy klienta serwisowego przez `createServiceClient`, który omija RLS i jest tylko dla zadań systemowych. Repozytoria oddają typy domenowe: dokument wersji przepisów przechodzi przez `parseRegulationDocument`, więc niepoprawny wiersz w bazie kończy się głośnym błędem. Kolejka zadań jest osobną fabryką `createJobQueue`, bo działa wyłącznie z kluczem serwisowym. Testy integracyjne idą na lokalnym Supabase osobnym skryptem.

**Files:**
- Create: `backend/repositories/vitest.integration.config.ts`, `backend/repositories/src/service-client.ts`, `backend/repositories/src/errors.ts`, `backend/repositories/src/json.ts`, `backend/repositories/src/employees.ts`, `backend/repositories/src/regulation-versions.ts`, `backend/repositories/src/job-queue.ts`, `backend/repositories/src/repositories.ts`, `scripts/with-supabase-env.sh`
- Modify: `backend/repositories/package.json`, `backend/repositories/tsconfig.json`, `backend/repositories/src/index.ts`, `package.json`, `README.md`
- Test: `backend/repositories/src/repositories.integration.test.ts`

- [ ] **Step 1: Rozszerz `backend/repositories/package.json`**

Pakiet nie dostaje testów jednostkowych, więc nie ma skryptu `test`. Turborepo go pominie, a testy integracyjne woła skrypt korzenia. Pola `scripts`, `dependencies` i `devDependencies` mają wyglądać tak (pozostałe pola bez zmian, wpisy dodane przez plan 4 po jego zakończeniu, jeśli są inne niż poniżej, zostają):

```json
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  },
  "dependencies": {
    "@sarmata/database": "workspace:*",
    "@sarmata/domain": "workspace:*",
    "@supabase/supabase-js": "catalog:"
  },
  "devDependencies": {
    "@sarmata/regulations": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
```

- [ ] **Step 2: Rozszerz `backend/repositories/tsconfig.json` i utwórz `vitest.integration.config.ts`**

Konfiguracja Vitest musi należeć do projektu TS (ESLint z `projectService`). `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "vitest.integration.config.ts"]
}
```

`backend/repositories/vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 3: Utwórz `backend/repositories/src/service-client.ts`**

`src/db.ts` z planu 4 zostaje bez zmian.

```ts
import type { Database } from '@sarmata/database';
import { createClient } from '@supabase/supabase-js';
import { type Db } from './db';

/**
 * Client with the secret (service) key. It bypasses RLS, so only the worker and system tasks use it,
 * never code that acts for a signed-in user.
 */
export function createServiceClient(options: { url: string; secretKey: string }): Db {
  return createClient<Database>(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 4: Utwórz `backend/repositories/src/errors.ts` i `json.ts`**

```ts
/** A failed database call. `code` is the Postgres or PostgREST error code, e.g. 42501 for a denied access. */
export class RepositoryError extends Error {
  readonly code: string | null;

  constructor(operation: string, cause: { message: string; code?: string }) {
    super(`${operation}: ${cause.message}`, { cause });
    this.name = 'RepositoryError';
    this.code = cause.code ?? null;
  }
}
```

```ts
import type { Database } from '@sarmata/database';

export type Json = Database['public']['Tables']['regulation_versions']['Insert']['document'];

/** Plain JSON copy of a value for a jsonb column or an RPC argument. */
export const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;
```

- [ ] **Step 5: Utwórz `backend/repositories/src/employees.ts`**

```ts
import { type Db } from './db';
import { RepositoryError } from './errors';

/** Pracownik: a person from HR records, may exist without an account (GLOSSARY.md). */
export interface Employee {
  readonly id: string;
  readonly officeId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly userId: string | null;
}

export interface EmployeeRepository {
  /** Employees visible to the client, i.e. of the signed-in office, sorted by last and first name. */
  list(): Promise<Employee[]>;
}

export function createEmployeeRepository(db: Db): EmployeeRepository {
  return {
    async list() {
      const { data, error } = await db
        .from('employees')
        .select('id, office_id, first_name, last_name, email, user_id')
        .order('last_name')
        .order('first_name');
      if (error) throw new RepositoryError('employees.list', error);
      return data.map((row) => ({
        id: row.id,
        officeId: row.office_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        userId: row.user_id,
      }));
    },
  };
}
```

- [ ] **Step 6: Utwórz `backend/repositories/src/regulation-versions.ts`**

```ts
import { type RegulationDocument, parseRegulationDocument } from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

export interface RegulationVersionRepository {
  /** Official versions, oldest first. */
  listOfficial(): Promise<RegulationDocument[]>;
  findOfficial(code: string): Promise<RegulationDocument | null>;
  /** Needs the service client: accounts cannot create official versions (RLS). */
  insertOfficial(document: RegulationDocument): Promise<void>;
}

export function createRegulationVersionRepository(db: Db): RegulationVersionRepository {
  return {
    async listOfficial() {
      const { data, error } = await db
        .from('regulation_versions')
        .select('document')
        .eq('is_official', true)
        .order('effective_from');
      if (error) throw new RepositoryError('regulationVersions.listOfficial', error);
      return data.map((row) => parseRegulationDocument(row.document));
    },

    async findOfficial(code) {
      const { data, error } = await db
        .from('regulation_versions')
        .select('document')
        .eq('is_official', true)
        .eq('code', code)
        .maybeSingle();
      if (error) throw new RepositoryError('regulationVersions.findOfficial', error);
      return data === null ? null : parseRegulationDocument(data.document);
    },

    async insertOfficial(document) {
      const { error } = await db.from('regulation_versions').insert({
        code: document.id,
        office_id: null,
        is_official: true,
        effective_from: document.effectiveFrom,
        document: toJson(document),
      });
      if (error) throw new RepositoryError('regulationVersions.insertOfficial', error);
    },
  };
}
```

- [ ] **Step 7: Utwórz `backend/repositories/src/job-queue.ts`**

```ts
import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

/** A message on the `jobs` queue. The worker picks the handler by `type`. */
export interface JobMessage {
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

export interface QueuedJob {
  readonly id: number;
  /** pgmq read counter: 1 on the first delivery. */
  readonly readCount: number;
  readonly enqueuedAt: string;
  /** Raw message, validated by the worker. */
  readonly message: unknown;
}

export interface JobQueue {
  send(message: JobMessage, options?: { readonly delaySeconds?: number }): Promise<number>;
  /** Hides the returned jobs for `visibilityTimeoutSeconds`. An unarchived job comes back afterwards. */
  read(batchSize: number, visibilityTimeoutSeconds: number): Promise<QueuedJob[]>;
  archive(id: number): Promise<void>;
}

/** pgmq through RPC. Needs the service client: accounts have no access to the queue functions. */
export function createJobQueue(db: Db): JobQueue {
  return {
    async send(message, options = {}) {
      const { data, error } = await db.rpc('job_queue_send', {
        message: toJson(message),
        delay_seconds: options.delaySeconds ?? 0,
      });
      if (error) throw new RepositoryError('jobQueue.send', error);
      return data;
    },

    async read(batchSize, visibilityTimeoutSeconds) {
      const { data, error } = await db.rpc('job_queue_read', {
        batch_size: batchSize,
        visibility_timeout_seconds: visibilityTimeoutSeconds,
      });
      if (error) throw new RepositoryError('jobQueue.read', error);
      return data.map((row) => ({
        id: row.message_id,
        readCount: row.read_count,
        enqueuedAt: row.enqueued_at,
        message: row.message,
      }));
    },

    async archive(id) {
      const { error } = await db.rpc('job_queue_archive', { message_id: id });
      if (error) throw new RepositoryError('jobQueue.archive', error);
    },
  };
}
```

- [ ] **Step 8: Utwórz `backend/repositories/src/repositories.ts` i dopisz eksporty do `index.ts`**

```ts
import { type Db } from './db';
import { type EmployeeRepository, createEmployeeRepository } from './employees';
import {
  type RegulationVersionRepository,
  createRegulationVersionRepository,
} from './regulation-versions';

export interface Repositories {
  readonly employees: EmployeeRepository;
  readonly regulationVersions: RegulationVersionRepository;
}

/** All repositories on one client. With the user's JWT, RLS decides what they see. */
export function createRepositories(db: Db): Repositories {
  return {
    employees: createEmployeeRepository(db),
    regulationVersions: createRegulationVersionRepository(db),
  };
}
```

Na końcu istniejącego `backend/repositories/src/index.ts` (eksporty `Database`, `Db`, `readAccountClaims` i `findOfficeName` z planu 4 zostają) dopisz:

```ts
export { createServiceClient } from './service-client';
export { RepositoryError } from './errors';
export { type Employee, type EmployeeRepository } from './employees';
export { type RegulationVersionRepository } from './regulation-versions';
export { type JobMessage, type JobQueue, type QueuedJob, createJobQueue } from './job-queue';
export { type Repositories, createRepositories } from './repositories';
```

- [ ] **Step 9: Utwórz `scripts/with-supabase-env.sh`**

```bash
#!/usr/bin/env bash
# Runs a command with SUPABASE_URL and the keys of the local "sarmata" instance.
# For development and integration tests only. A set SUPABASE_URL (e.g. an external instance) wins.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${SUPABASE_URL:-}" ]; then
  status=$(cd database && pnpm exec supabase status -o json)
  eval "$(printf '%s' "$status" | python3 -c '
import json, shlex, sys
d = json.load(sys.stdin)
values = {
    "SUPABASE_URL": d["API_URL"],
    "SUPABASE_PUBLISHABLE_KEY": d.get("PUBLISHABLE_KEY") or d["ANON_KEY"],
    "SUPABASE_SECRET_KEY": d.get("SECRET_KEY") or d["SERVICE_ROLE_KEY"],
}
for name, value in values.items():
    print(f"export {name}={shlex.quote(value)}")
')"
fi

exec "$@"
```

Run: `chmod +x scripts/with-supabase-env.sh`

`pnpm exec supabase` uruchamia CLI z devDependency `@sarmata/database` (plan 2).

- [ ] **Step 10: Dodaj skrypt do `package.json` korzenia**

W `scripts` dopisz:

```json
    "test:integration": "bash scripts/with-supabase-env.sh pnpm --filter @sarmata/repositories test:integration"
```

- [ ] **Step 11: Napisz `backend/repositories/src/repositories.integration.test.ts`**

Wymaga działającej instancji z danymi demo i zsynchronizowanymi wersjami (`pnpm db:reset`).

```ts
import type { Database } from '@sarmata/database';
import { officialRegulations } from '@sarmata/regulations';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  RepositoryError,
  createJobQueue,
  createRepositories,
  createServiceClient,
} from './index';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');

const DEMO_OFFICE_ID = '11111111-1111-4111-8111-111111111111';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

function anonymousClient(): Db {
  return createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(email: string): Promise<Db> {
  const db = anonymousClient();
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

const serviceClient = (): Db =>
  createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') });

describe('employees', () => {
  it('lists the employees of the signed-in office sorted by last name', async () => {
    const employees = await createRepositories(
      await signedIn('kadry@kropka.test'),
    ).employees.list();
    expect(employees.map((employee) => employee.lastName)).toEqual([
      'Administracyjna',
      'Ewidencyjna',
      'Kadrowy',
      'Merytoryczny',
      'Oceniająca',
    ]);
    expect(new Set(employees.map((employee) => employee.officeId))).toEqual(
      new Set([DEMO_OFFICE_ID]),
    );
  });

  it('refuses an anonymous client', async () => {
    await expect(createRepositories(anonymousClient()).employees.list()).rejects.toThrow(
      RepositoryError,
    );
  });
});

describe('regulation versions', () => {
  it('returns the synced official versions equal to the code catalog', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    expect(await repositories.regulationVersions.listOfficial()).toEqual([...officialRegulations]);
  });

  it('returns null for an unknown code', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    expect(await repositories.regulationVersions.findOfficial('regulation-1999')).toBeNull();
  });

  it('does not let an account write an official version', async () => {
    const repositories = createRepositories(await signedIn('admin@kropka.test'));
    const document = { ...regulation2016, id: 'regulation-fake' };
    await expect(repositories.regulationVersions.insertOfficial(document)).rejects.toThrow(
      RepositoryError,
    );
  });
});

describe('job queue', () => {
  it('sends, reads and archives a job with the service client', async () => {
    const queue = createJobQueue(serviceClient());
    const id = await queue.send({ type: 'test.integration', payload: { at: Date.now() } });
    const read = await queue.read(100, 30);
    expect(read.find((job) => job.id === id)).toMatchObject({
      readCount: 1,
      message: { type: 'test.integration' },
    });
    await queue.archive(id);
  });

  it('does not let an account use the queue', async () => {
    const queue = createJobQueue(await signedIn('admin@kropka.test'));
    await expect(queue.send({ type: 'test.denied', payload: {} })).rejects.toThrow(RepositoryError);
  });
});
```

- [ ] **Step 12: Zaktualizuj `README.md`**

W sekcji „Jak uruchomić (dev)” znajdź punkt ze sprawdzeniem całości (blok z `pnpm check` i `pnpm db:test`) i dopisz w tym bloku, w osobnej linii z tym samym wcięciem, `pnpm test:integration`. Pod blokiem dopisz akapit z wcięciem trzech spacji (część tego punktu):

```markdown
   `pnpm test:integration` to testy repozytoriów na działającej bazie, z kontami demo. CI ich nie uruchamia.
```

W tabeli „Skrypty” (ta z wierszem `pnpm db:types`) po wierszu `pnpm db:types` dopisz:

```markdown
| `pnpm test:integration` | testy repozytoriów na lokalnym Supabase, wymagają `pnpm db:reset` |
```

Przed sekcją „## Pliki konfiguracyjne” (a gdy jej nie ma, przed „## Termic”) dodaj nową sekcję:

```markdown
## Zmienne środowiskowe

Żadna z nich nie jest sekretem zespołu. Lokalne klucze Supabase podaje `supabase status`, więc nie trafiają do `secrets/dev.enc.env`. W instalacji u klienta ustawia je kreator.

| Zmienna | Kto używa | Skąd w dev |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | testy integracyjne, worker | `scripts/with-supabase-env.sh` czyta je z `supabase status`, chyba że `SUPABASE_URL` jest już ustawione (zewnętrzna instancja) |
```

- [ ] **Step 13: Zainstaluj i commit**

```bash
rtk pnpm install
rtk pnpm exec prettier --write backend/repositories package.json
rtk git add backend/repositories scripts/with-supabase-env.sh package.json pnpm-lock.yaml README.md
rtk git commit -m "feat(repositories): supabase-js repositories and job queue" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 7: Rozszerzenie pakietu `@sarmata/services`

Pakiet istnieje z planu 4 (zadanie 1): `package.json` z zależnościami `@sarmata/repositories` i `zod`, `tsconfig.json`, `src/account/current-account.ts` (`getCurrentAccount(db)`) i `src/index.ts`, który reeksportuje typy `Database` i `Db`. Istniejących plików nie przepisuj.

Jedyne API dla frontendu (ADR 0004). Zależności wstrzykiwane: `createServices({ repositories })`, a dla frontendu skrót `servicesFor(db)`. Pakiet nie importuje `@supabase/*` (ESLint). Testy jednostkowe idą na repozytoriach w pamięci, czyli drugim adapterze obok prawdziwego.

Pierwsze serwisy:
- `employees.list()`: pracownicy urzędu zalogowanego konta,
- `regulations.inForceOn(date)`: oficjalna wersja obowiązująca w dniu, błąd `no_regulation_in_force` przed pierwszą,
- `regulations.syncOfficial()`: wstawia brakujące wersje z `@sarmata/regulations`, a przy różnicy z bazą rzuca `regulation_drift`, zanim cokolwiek wstawi,
- `deadlines.compute({ regulationCode, slot, facts })`: termin slotu z przypiętej wersji.

**Files:**
- Create: `backend/services/src/errors.ts`, `backend/services/src/same-json.ts`, `backend/services/src/sync-official.ts`, `backend/services/src/services.ts`
- Modify: `backend/services/package.json`, `backend/services/src/index.ts`
- Test: `backend/services/src/services.test.ts`

- [ ] **Step 1: Rozszerz `backend/services/package.json`**

Pola `scripts`, `dependencies` i `devDependencies` mają wyglądać tak (pozostałe pola i ewentualne inne wpisy z planu 4 zostają):

```json
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@sarmata/domain": "workspace:*",
    "@sarmata/regulations": "workspace:*",
    "@sarmata/repositories": "workspace:*",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
```

`tsconfig.json` z planu 4 (`"include": ["src"]`) obejmuje już nowe pliki i testy.

- [ ] **Step 2: Utwórz `backend/services/src/errors.ts`**

```ts
export type ServiceErrorCode =
  'no_regulation_in_force' | 'unknown_regulation' | 'missing_deadline_slot' | 'regulation_drift';

/** An expected failure of a service. The frontend maps `code` to a message for the user. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}
```

- [ ] **Step 3: Utwórz `backend/services/src/same-json.ts`**

```ts
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonical(record[key])]),
    );
  }
  return value;
};

/** Equal as JSON regardless of key order (jsonb does not keep it). */
export const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
```

- [ ] **Step 4: Utwórz `backend/services/src/sync-official.ts`**

```ts
import { type RegulationDocument } from '@sarmata/domain';
import { type RegulationVersionRepository } from '@sarmata/repositories';
import { ServiceError } from './errors';
import { sameJson } from './same-json';

export interface SyncReport {
  readonly inserted: string[];
  readonly unchanged: string[];
}

/**
 * Loads official versions from code into the database as immutable rows. Checks every version first,
 * so a drift stops the sync before anything is written.
 */
export async function syncOfficialRegulations(
  repository: RegulationVersionRepository,
  official: readonly RegulationDocument[],
): Promise<SyncReport> {
  const missing: RegulationDocument[] = [];
  const unchanged: string[] = [];
  for (const document of official) {
    const stored = await repository.findOfficial(document.id);
    if (stored === null) {
      missing.push(document);
    } else if (sameJson(stored, document)) {
      unchanged.push(document.id);
    } else {
      throw new ServiceError(
        'regulation_drift',
        `Official regulation version ${document.id} in the database differs from the code. ` +
          'Official versions are immutable: publish the change as a new version.',
      );
    }
  }
  for (const document of missing) await repository.insertOfficial(document);
  return { inserted: missing.map((document) => document.id), unchanged };
}
```

- [ ] **Step 5: Utwórz `backend/services/src/services.ts`**

```ts
import {
  type CalendarDate,
  type DeadlineFacts,
  type DeadlineResult,
  type DeadlineSlot,
  type RegulationDocument,
  computeDeadline,
  versionInForce,
} from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import {
  type Db,
  type Employee,
  type Repositories,
  createRepositories,
} from '@sarmata/repositories';
import { ServiceError } from './errors';
import { type SyncReport, syncOfficialRegulations } from './sync-official';

export interface ServiceDependencies {
  readonly repositories: Pick<Repositories, 'employees' | 'regulationVersions'>;
  /** Defaults to the catalog of @sarmata/regulations. */
  readonly officialRegulations?: readonly RegulationDocument[];
}

export interface DeadlineRequest {
  readonly regulationCode: string;
  readonly slot: DeadlineSlot;
  readonly facts: DeadlineFacts;
}

export interface Services {
  readonly employees: { list(): Promise<Employee[]> };
  readonly regulations: {
    inForceOn(on: CalendarDate): Promise<RegulationDocument>;
    syncOfficial(): Promise<SyncReport>;
  };
  readonly deadlines: { compute(request: DeadlineRequest): Promise<DeadlineResult> };
}

export function createServices(dependencies: ServiceDependencies): Services {
  const { repositories } = dependencies;
  const official = dependencies.officialRegulations ?? officialRegulations;

  return {
    employees: {
      list: () => repositories.employees.list(),
    },
    regulations: {
      async inForceOn(on) {
        const version = versionInForce(await repositories.regulationVersions.listOfficial(), on);
        if (version === null) {
          throw new ServiceError(
            'no_regulation_in_force',
            `No regulation version is in force on ${on}`,
          );
        }
        return version;
      },
      syncOfficial: () => syncOfficialRegulations(repositories.regulationVersions, official),
    },
    deadlines: {
      async compute({ regulationCode, slot, facts }) {
        const version = await repositories.regulationVersions.findOfficial(regulationCode);
        if (version === null) {
          throw new ServiceError(
            'unknown_regulation',
            `Unknown regulation version ${regulationCode}`,
          );
        }
        const rule = version.deadlines[slot];
        if (rule === undefined) {
          throw new ServiceError(
            'missing_deadline_slot',
            `Regulation version ${regulationCode} has no ${slot} deadline`,
          );
        }
        return computeDeadline(rule, facts);
      },
    },
  };
}

/** Services on a supabase-js client. The frontend passes a client with the user's JWT. */
export const servicesFor = (db: Db): Services =>
  createServices({ repositories: createRepositories(db) });
```

- [ ] **Step 6: Dopisz eksporty na końcu `backend/services/src/index.ts`**

Eksporty z planu 4 (`Database`, `Db`, `getCurrentAccount` i typy konta) zostają.

```ts
export {
  type DeadlineRequest,
  type ServiceDependencies,
  type Services,
  createServices,
  servicesFor,
} from './services';
export { ServiceError, type ServiceErrorCode } from './errors';
export { type SyncReport } from './sync-official';
export type { Employee } from '@sarmata/repositories';
export {
  type CalendarDate,
  type DeadlineFacts,
  type DeadlineResult,
  type DeadlineSlot,
  type RegulationDocument,
  calendarDate,
} from '@sarmata/domain';
```

- [ ] **Step 7: Napisz `backend/services/src/services.test.ts`**

```ts
import { type RegulationDocument, calendarDate } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { type Employee, type Repositories } from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { ServiceError, createServices } from './index';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');

function inMemoryRepositories(seed: { employees?: Employee[]; official?: RegulationDocument[] }) {
  const official = [...(seed.official ?? [])];
  const inserted: string[] = [];
  const repositories: Pick<Repositories, 'employees' | 'regulationVersions'> = {
    employees: { list: () => Promise.resolve([...(seed.employees ?? [])]) },
    regulationVersions: {
      listOfficial: () => Promise.resolve([...official]),
      findOfficial: (code) =>
        Promise.resolve(official.find((document) => document.id === code) ?? null),
      insertOfficial: (document) => {
        official.push(document);
        inserted.push(document.id);
        return Promise.resolve();
      },
    },
  };
  return { repositories, inserted };
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

describe('regulations.syncOfficial', () => {
  it('inserts missing official versions', async () => {
    const { repositories, inserted } = inMemoryRepositories({});
    const report = await createServices({ repositories }).regulations.syncOfficial();
    expect(report).toEqual({ inserted: ['regulation-2016'], unchanged: [] });
    expect(inserted).toEqual(['regulation-2016']);
  });

  it('leaves an equal version alone even when jsonb reordered its keys', async () => {
    const reordered = Object.fromEntries(
      Object.entries(regulation2016).reverse(),
    ) as RegulationDocument;
    const { repositories, inserted } = inMemoryRepositories({ official: [reordered] });
    const report = await createServices({ repositories }).regulations.syncOfficial();
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
    const { repositories, inserted } = inMemoryRepositories({ official: [changed] });
    const services = createServices({ repositories, officialRegulations: [added, regulation2016] });
    await expectServiceError(services.regulations.syncOfficial(), 'regulation_drift');
    expect(inserted).toEqual([]);
  });
});

describe('deadlines.compute', () => {
  const { repositories } = inMemoryRepositories({ official: [regulation2016] });
  const services = createServices({ repositories });

  it('computes a slot of the pinned regulation version', async () => {
    const result = await services.deadlines.compute({
      regulationCode: 'regulation-2016',
      slot: 'objection',
      facts: { eventDate: calendarDate('2026-11-14') },
    });
    expect(result).toMatchObject({ kind: 'due', due: '2026-11-23' });
  });

  it('fails for an unknown regulation version', async () => {
    await expectServiceError(
      services.deadlines.compute({
        regulationCode: 'regulation-1999',
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
        regulationCode: 'regulation-2016',
        slot: 'objection',
        facts: { eventDate: calendarDate('2026-11-14') },
      }),
      'missing_deadline_slot',
    );
  });
});
```

- [ ] **Step 8: Zainstaluj i commit**

```bash
rtk pnpm install
rtk pnpm exec prettier --write backend/services
rtk git add backend/services pnpm-lock.yaml
rtk git commit -m "feat(services): employees, regulations and deadlines services" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 8: Pakiet `@sarmata/ai`

Klient bez SDK, na `fetch` z Node 24, bo potrzebne są dwa żądania POST z JSON. Jeden obiekt `createAi(config)` z dwiema metodami:
- `generateObject({ schemaName, schema, system, prompt })`: `/chat/completions` na API zgodnym z OpenAI (llama-server, vLLM, MLX) z `response_format: json_schema` ze schematu zod (`z.toJSONSchema`), a wynik walidowany tym samym schematem. Bielik nie przenosi `response_format` do szablonu czatu, więc wymuszenie robi silnik, a walidacja zod jest obowiązkowa (`docs/sources/ai-lokalne/FINDINGS.md`, część 2, 1.1),
- `decide({ state, questions, facts })`: `/systemone` na serwerze Bielik-One. Format żądania i odpowiedzi według README i `bielik_one/api/server.py` z https://github.com/speakleash/bielik-one: pytania `choice`, `noul`, `score`, `labels`, odpowiedź `{ model, answers: { <nazwa>: { type, ... } } }`, błędy `{ error, code }`.

Obie metody zwracają `AiResult` zamiast rzucać: `{ ok: true, value }` albo `{ ok: false, reason }` z powodem `disabled`, `timeout`, `unavailable`, `rejected`, `invalid_response`. Wołający i tak musi obsłużyć ścieżkę bez AI (spec: proces działa bez AI), więc wynik ją wymusza w typie. AI wyłączone albo endpoint nieskonfigurowany daje `disabled` bez żadnego żądania. Konfiguracja instalacji pochodzi z env (`aiConfigFromEnv`). Przełącznik AI w ustawieniach urzędu dojdzie w serwisach razem z tabelą ustawień.

**Files:**
- Create: `backend/ai/package.json`, `backend/ai/tsconfig.json`, `backend/ai/src/index.ts`, `backend/ai/src/config.ts`, `backend/ai/src/result.ts`, `backend/ai/src/http.ts`, `backend/ai/src/text-model.ts`, `backend/ai/src/decision.ts`, `backend/ai/src/ai.ts`
- Modify: `eslint.config.mjs`, `README.md`
- Test: `backend/ai/src/ai.test.ts`, `backend/ai/src/fake-server.ts`

- [ ] **Step 1: Utwórz `backend/ai/package.json` i `tsconfig.json`**

```json
{
  "name": "@sarmata/ai",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Utwórz `backend/ai/src/result.ts`**

```ts
export type AiFailureReason =
  'disabled' | 'timeout' | 'unavailable' | 'rejected' | 'invalid_response';

export interface AiFailure {
  readonly ok: false;
  readonly reason: AiFailureReason;
  readonly message: string;
}

/** Result of an AI call. AI is optional, so every caller handles the failure path. */
export type AiResult<T> = { readonly ok: true; readonly value: T } | AiFailure;

export const failure = (reason: AiFailureReason, message: string): AiFailure => ({
  ok: false,
  reason,
  message,
});
```

- [ ] **Step 3: Utwórz `backend/ai/src/config.ts`**

```ts
import { z } from 'zod';

export interface AiEndpoint {
  /** Base URL with the API version, e.g. `http://127.0.0.1:8080/v1`. */
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string | null;
}

export interface AiConfig {
  readonly enabled: boolean;
  readonly timeoutMs: number;
  /** OpenAI-compatible text model (llama-server, vLLM, MLX). */
  readonly text: AiEndpoint | null;
  /** Bielik-One `/v1/systemone`. Null where the hardware cannot run it (ADR 0005). */
  readonly decision: AiEndpoint | null;
}

const envSchema = z.object({
  SARMATA_AI_ENABLED: z.enum(['true', 'false']).default('false'),
  SARMATA_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  SARMATA_AI_TEXT_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  SARMATA_AI_TEXT_MODEL: z.string().min(1).default('bielik'),
  SARMATA_AI_TEXT_API_KEY: z.string().min(1).optional(),
  SARMATA_AI_DECISION_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  SARMATA_AI_DECISION_MODEL: z.string().min(1).default('decision'),
  SARMATA_AI_DECISION_API_KEY: z.string().min(1).optional(),
});

const endpoint = (
  baseUrl: string | undefined,
  model: string,
  apiKey: string | undefined,
): AiEndpoint | null =>
  baseUrl === undefined
    ? null
    : { baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey: apiKey ?? null };

/** Installation settings of AI. Empty variables count as unset. AI is off unless SARMATA_AI_ENABLED=true. */
export function aiConfigFromEnv(env: Record<string, string | undefined>): AiConfig {
  const present = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid AI configuration:\n${z.prettifyError(result.error)}`);
  }
  const values = result.data;
  return {
    enabled: values.SARMATA_AI_ENABLED === 'true',
    timeoutMs: values.SARMATA_AI_TIMEOUT_MS,
    text: endpoint(
      values.SARMATA_AI_TEXT_BASE_URL,
      values.SARMATA_AI_TEXT_MODEL,
      values.SARMATA_AI_TEXT_API_KEY,
    ),
    decision: endpoint(
      values.SARMATA_AI_DECISION_BASE_URL,
      values.SARMATA_AI_DECISION_MODEL,
      values.SARMATA_AI_DECISION_API_KEY,
    ),
  };
}
```

- [ ] **Step 4: Utwórz `backend/ai/src/http.ts`**

```ts
import { type AiEndpoint } from './config';
import { type AiResult, failure } from './result';

const isTimeout = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** POST with a JSON body. Maps network, timeout and HTTP errors to an `AiResult`. */
export async function postJson(
  endpoint: AiEndpoint,
  path: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<AiResult<unknown>> {
  const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];
  let status: number;
  let text: string;
  try {
    const response = await fetch(`${endpoint.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(endpoint.apiKey === null ? {} : { authorization: `Bearer ${endpoint.apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
    status = response.status;
    text = await response.text();
  } catch (error) {
    if (isTimeout(error)) return failure('timeout', `No answer within ${timeoutMs} ms`);
    return failure('unavailable', describe(error));
  }
  if (status >= 400 && status < 500)
    return failure('rejected', `HTTP ${status}: ${text.slice(0, 500)}`);
  if (status >= 500) return failure('unavailable', `HTTP ${status}: ${text.slice(0, 500)}`);
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return failure('invalid_response', 'The response is not JSON');
  }
}
```

- [ ] **Step 5: Utwórz `backend/ai/src/text-model.ts`**

```ts
import { z } from 'zod';
import { type AiEndpoint } from './config';
import { postJson } from './http';
import { type AiResult, failure } from './result';

export interface ObjectRequest<S extends z.ZodType> {
  /** Name of the schema for the engine, e.g. `evaluation_draft`. */
  readonly schemaName: string;
  /** Plain data schema (no transforms), turned into JSON Schema for the engine. */
  readonly schema: S;
  readonly system: string;
  readonly prompt: string;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}

const chatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

export async function generateObject<S extends z.ZodType>(
  endpoint: AiEndpoint,
  timeoutMs: number,
  request: ObjectRequest<S>,
): Promise<AiResult<z.output<S>>> {
  const body = {
    model: endpoint.model,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: request.schemaName,
        strict: true,
        schema: z.toJSONSchema(request.schema),
      },
    },
    max_tokens: request.maxTokens ?? 2048,
    temperature: 0,
  };
  const raw = await postJson(endpoint, '/chat/completions', body, timeoutMs, request.signal);
  if (!raw.ok) return raw;
  const chat = chatResponseSchema.safeParse(raw.value);
  if (!chat.success) return failure('invalid_response', 'Unexpected chat completion shape');
  const content = chat.data.choices[0]?.message.content;
  if (!content) return failure('invalid_response', 'The completion is empty');
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return failure('invalid_response', 'The completion is not JSON');
  }
  const parsed = request.schema.safeParse(json);
  if (!parsed.success) return failure('invalid_response', z.prettifyError(parsed.error));
  return { ok: true, value: parsed.data };
}
```

- [ ] **Step 6: Utwórz `backend/ai/src/decision.ts`**

```ts
import { z } from 'zod';
import { type AiEndpoint } from './config';
import { postJson } from './http';
import { type AiResult, failure } from './result';

/** Typed question of the TypeSafe System One schema (Bielik-One README). */
export type DecisionQuestion =
  | {
      readonly type: 'choice';
      readonly instructions: string;
      readonly criteria: Record<string, string>;
    }
  | {
      readonly type: 'noul';
      readonly instructions: string;
      readonly criteria?: { readonly true: string; readonly false: string };
    }
  | { readonly type: 'score'; readonly instructions: string; readonly criteria: readonly string[] }
  | {
      readonly type: 'labels';
      readonly instructions: string;
      readonly criteria: Record<string, string>;
    };

export interface DecisionRequest {
  /** Text describing the case, up to 400 000 characters. */
  readonly state: string;
  readonly questions: Record<string, DecisionQuestion>;
  /** Server-side calendar and number facts appended to the state (`"facts": true`). */
  readonly facts?: boolean;
  readonly signal?: AbortSignal;
}

const probabilities = z.record(z.string(), z.number());

const answerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('choice'),
    choice: z.string(),
    probabilities,
    confidence: z.number(),
  }),
  z.object({
    type: z.literal('noul'),
    noul: z.number(),
    probabilities: z.object({ true: z.number(), false: z.number() }),
    confidence: z.number(),
  }),
  z.object({
    type: z.literal('score'),
    score: z.number(),
    legend: z.record(z.string(), z.string()),
    probabilities,
    confidence: z.number(),
  }),
  z.object({
    type: z.literal('labels'),
    probabilities,
    selected: z.array(z.string()),
    confidence: z.number(),
  }),
]);

const responseSchema = z.object({ answers: z.record(z.string(), answerSchema) });

export type DecisionAnswer = z.infer<typeof answerSchema>;
export type DecisionAnswers = Record<string, DecisionAnswer>;

export async function decide(
  endpoint: AiEndpoint,
  timeoutMs: number,
  request: DecisionRequest,
): Promise<AiResult<DecisionAnswers>> {
  const body = {
    model: endpoint.model,
    state: request.state,
    questions: request.questions,
    facts: request.facts ?? false,
  };
  const raw = await postJson(endpoint, '/systemone', body, timeoutMs, request.signal);
  if (!raw.ok) return raw;
  const parsed = responseSchema.safeParse(raw.value);
  if (!parsed.success) return failure('invalid_response', z.prettifyError(parsed.error));
  const missing = Object.keys(request.questions).filter((name) => !(name in parsed.data.answers));
  if (missing.length > 0) {
    return failure('invalid_response', `No answer for: ${missing.join(', ')}`);
  }
  return { ok: true, value: parsed.data.answers };
}
```

- [ ] **Step 7: Utwórz `backend/ai/src/ai.ts` i `index.ts`**

```ts
import { type z } from 'zod';
import { type AiConfig } from './config';
import { type DecisionAnswers, type DecisionRequest, decide } from './decision';
import { type AiResult, failure } from './result';
import { type ObjectRequest, generateObject } from './text-model';

export interface Ai {
  /** What can answer now. Services use it to hide AI features instead of calling and failing. */
  readonly available: { readonly text: boolean; readonly decision: boolean };
  generateObject<S extends z.ZodType>(request: ObjectRequest<S>): Promise<AiResult<z.output<S>>>;
  decide(request: DecisionRequest): Promise<AiResult<DecisionAnswers>>;
}

export function createAi(config: AiConfig): Ai {
  const text = config.enabled ? config.text : null;
  const decision = config.enabled ? config.decision : null;
  return {
    available: { text: text !== null, decision: decision !== null },
    generateObject: (request) =>
      text === null
        ? Promise.resolve(failure('disabled', 'AI is disabled or the text model is not configured'))
        : generateObject(text, config.timeoutMs, request),
    decide: (request) =>
      decision === null
        ? Promise.resolve(failure('disabled', 'AI is disabled or Bielik-One is not configured'))
        : decide(decision, config.timeoutMs, request),
  };
}
```

```ts
export { type Ai, createAi } from './ai';
export { type AiConfig, type AiEndpoint, aiConfigFromEnv } from './config';
export {
  type DecisionAnswer,
  type DecisionAnswers,
  type DecisionQuestion,
  type DecisionRequest,
} from './decision';
export { type AiFailure, type AiFailureReason, type AiResult } from './result';
export { type ObjectRequest } from './text-model';
```

- [ ] **Step 8: Utwórz pomocnik testów `backend/ai/src/fake-server.ts`**

Fałszywy serwer HTTP na losowym porcie. Plik nie jest eksportowany z `index.ts`.

```ts
import {
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from 'node:http';
import { type AddressInfo } from 'node:net';

export interface RecordedRequest {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: unknown;
}

export interface FakeReply {
  readonly status: number;
  readonly body: unknown;
  readonly delayMs?: number;
}

export interface FakeServer {
  readonly baseUrl: string;
  readonly requests: RecordedRequest[];
  close(): Promise<void>;
}

export async function startFakeServer(
  reply: (request: RecordedRequest) => FakeReply,
): Promise<FakeServer> {
  const requests: RecordedRequest[] = [];
  const respond = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let data = '';
    for await (const chunk of req) data += String(chunk);
    const recorded: RecordedRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: data === '' ? null : (JSON.parse(data) as unknown),
    };
    requests.push(recorded);
    const answer = reply(recorded);
    if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));
    res.writeHead(answer.status, { 'content-type': 'application/json' });
    res.end(typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body));
  };
  const server = createServer((req, res) => {
    void respond(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
```

- [ ] **Step 9: Napisz `backend/ai/src/ai.test.ts`**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type FakeReply, type FakeServer, startFakeServer } from './fake-server';
import { type AiConfig, aiConfigFromEnv, createAi } from './index';

let server: FakeServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function serve(reply: () => FakeReply): Promise<FakeServer> {
  server = await startFakeServer(reply);
  return server;
}

const config = (baseUrl: string, overrides: Partial<AiConfig> = {}): AiConfig => ({
  enabled: true,
  timeoutMs: 2_000,
  text: { baseUrl, model: 'bielik-test', apiKey: 'secret' },
  decision: { baseUrl, model: 'decision', apiKey: null },
  ...overrides,
});

const draftSchema = z.object({ summary: z.string(), level: z.enum(['meets', 'above']) });

const completion = (content: string): FakeReply => ({
  status: 200,
  body: { choices: [{ message: { role: 'assistant', content } }] },
});

const request = {
  schemaName: 'evaluation_draft',
  schema: draftSchema,
  system: 'Jesteś asystentem oceniającego.',
  prompt: 'Przygotuj szkic.',
};

describe('generateObject', () => {
  it('sends a chat completion with the JSON schema and returns the validated object', async () => {
    const fake = await serve(() => completion('{"summary":"Terminowo.","level":"above"}'));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toEqual({ ok: true, value: { summary: 'Terminowo.', level: 'above' } });
    const sent = fake.requests[0];
    expect(sent?.url).toBe('/v1/chat/completions');
    expect(sent?.headers.authorization).toBe('Bearer secret');
    expect(sent?.body).toMatchObject({
      model: 'bielik-test',
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'evaluation_draft',
          strict: true,
          schema: z.toJSONSchema(draftSchema),
        },
      },
    });
  });

  it('rejects output that does not match the schema', async () => {
    const fake = await serve(() => completion('{"summary":"Terminowo.","level":"heroic"}'));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('rejects output that is not JSON', async () => {
    const fake = await serve(() => completion('Oto szkic oceny.'));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it.each([
    [503, 'unavailable'],
    [400, 'rejected'],
  ])('maps HTTP %i to %s', async (status, reason) => {
    const fake = await serve(() => ({ status, body: { error: 'nope' } }));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason });
  });

  it('gives up after the timeout', async () => {
    const fake = await serve(() => ({ ...completion('{}'), delayMs: 500 }));
    const result = await createAi(config(fake.baseUrl, { timeoutMs: 50 })).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('does not call the model when AI is disabled', async () => {
    const fake = await serve(() => completion('{}'));
    const ai = createAi(config(fake.baseUrl, { enabled: false }));
    expect(ai.available).toEqual({ text: false, decision: false });
    expect(await ai.generateObject(request)).toMatchObject({ ok: false, reason: 'disabled' });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('decide (Bielik-One /v1/systemone)', () => {
  const questions = {
    overload: {
      type: 'noul',
      instructions: 'Czy notatki wskazują na przeciążenie pracą?',
      criteria: { true: 'Tak', false: 'Nie' },
    },
    tone: {
      type: 'choice',
      instructions: 'Jaki jest wydźwięk notatek?',
      criteria: { positive: 'Pozytywny', neutral: 'Neutralny', negative: 'Negatywny' },
    },
    engagement: {
      type: 'score',
      instructions: 'Jak oceniasz zaangażowanie?',
      criteria: ['niskie', 'średnie', 'wysokie'],
    },
    signals: {
      type: 'labels',
      instructions: 'Które sygnały występują?',
      criteria: { overtime: 'Nadgodziny', conflict: 'Konflikt' },
    },
  } as const;

  const answers = {
    overload: {
      type: 'noul',
      noul: 0.82,
      probabilities: { true: 0.82, false: 0.18 },
      confidence: 0.64,
    },
    tone: {
      type: 'choice',
      choice: 'neutral',
      probabilities: { positive: 0.2, neutral: 0.7, negative: 0.1 },
      confidence: 0.55,
    },
    engagement: {
      type: 'score',
      score: 1.4,
      legend: { '0': 'niskie', '1': 'średnie', '2': 'wysokie' },
      probabilities: { '0': 0.1, '1': 0.4, '2': 0.5 },
      confidence: 0.3,
    },
    signals: {
      type: 'labels',
      probabilities: { overtime: 0.9, conflict: 0.2 },
      selected: ['overtime'],
      confidence: 0.72,
    },
  };

  it('posts typed questions and returns the answers', async () => {
    const fake = await serve(() => ({
      status: 200,
      body: { model: 'decision', answers, usage: { input_tokens: 120, output_tokens: 4 } },
    }));
    const state = 'Notatki: 12.10 nadgodziny, 20.10 nadgodziny, 3.11 odwołane szkolenie.';
    const result = await createAi(config(fake.baseUrl)).decide({ state, questions, facts: true });
    expect(result).toEqual({ ok: true, value: answers });
    expect(fake.requests[0]?.url).toBe('/v1/systemone');
    expect(fake.requests[0]?.headers.authorization).toBeUndefined();
    expect(fake.requests[0]?.body).toEqual({ model: 'decision', state, questions, facts: true });
  });

  it('rejects a response without an answer for every question', async () => {
    const fake = await serve(() => ({
      status: 200,
      body: { model: 'decision', answers: { overload: answers.overload } },
    }));
    const result = await createAi(config(fake.baseUrl)).decide({ state: 'x', questions });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('reports an invalid request from the server', async () => {
    const fake = await serve(() => ({
      status: 422,
      body: { error: 'questions.tone.criteria must be a map', code: 'INVALID_REQUEST' },
    }));
    const result = await createAi(config(fake.baseUrl)).decide({ state: 'x', questions });
    expect(result).toMatchObject({ ok: false, reason: 'rejected' });
    if (!result.ok) expect(result.message).toContain('INVALID_REQUEST');
  });

  it('is disabled when Bielik-One is not configured', async () => {
    const ai = createAi({ enabled: true, timeoutMs: 1_000, text: null, decision: null });
    expect(await ai.decide({ state: 'x', questions })).toMatchObject({
      ok: false,
      reason: 'disabled',
    });
  });
});

describe('aiConfigFromEnv', () => {
  it('turns AI off by default', () => {
    expect(aiConfigFromEnv({})).toEqual({
      enabled: false,
      timeoutMs: 60_000,
      text: null,
      decision: null,
    });
  });

  it('reads endpoints, trims trailing slashes and ignores empty variables', () => {
    expect(
      aiConfigFromEnv({
        SARMATA_AI_ENABLED: 'true',
        SARMATA_AI_TIMEOUT_MS: '30000',
        SARMATA_AI_TEXT_BASE_URL: 'http://127.0.0.1:8080/v1/',
        SARMATA_AI_TEXT_MODEL: 'bielik-11b-v3.1',
        SARMATA_AI_TEXT_API_KEY: '',
        SARMATA_AI_DECISION_BASE_URL: 'http://127.0.0.1:8026/v1',
      }),
    ).toEqual({
      enabled: true,
      timeoutMs: 30_000,
      text: { baseUrl: 'http://127.0.0.1:8080/v1', model: 'bielik-11b-v3.1', apiKey: null },
      decision: { baseUrl: 'http://127.0.0.1:8026/v1', model: 'decision', apiKey: null },
    });
  });

  it('rejects a malformed URL', () => {
    expect(() => aiConfigFromEnv({ SARMATA_AI_TEXT_BASE_URL: 'localhost:8080' })).toThrow(
      /Invalid AI configuration/,
    );
  });
});
```

- [ ] **Step 10: Granica pakietu w `eslint.config.mjs`**

Wstaw przed linią `prettier,`:

```js
  {
    files: ['backend/ai/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '@sarmata/*'],
              message: 'The AI client knows no database and no other layer, services pass it data (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
```

- [ ] **Step 11: Zaktualizuj `README.md`**

W tabeli sekcji „Zmienne środowiskowe” dopisz na końcu:

```markdown
| `SARMATA_AI_ENABLED` | `@sarmata/ai` | domyślnie `false`, AI wyłączone |
| `SARMATA_AI_TIMEOUT_MS` | `@sarmata/ai` | domyślnie `60000` |
| `SARMATA_AI_TEXT_BASE_URL`, `SARMATA_AI_TEXT_MODEL` | `@sarmata/ai`, model tekstowy zgodny z OpenAI | np. `http://127.0.0.1:8080/v1` i `bielik` przy lokalnym llama-server, bez nich model tekstowy jest wyłączony |
| `SARMATA_AI_DECISION_BASE_URL`, `SARMATA_AI_DECISION_MODEL` | `@sarmata/ai`, Bielik-One `/v1/systemone` | np. `http://127.0.0.1:8026/v1` i `decision`, bez nich decyzje są wyłączone |
| `SARMATA_AI_TEXT_API_KEY`, `SARMATA_AI_DECISION_API_KEY` | `@sarmata/ai` | tylko gdy serwer modelu wymaga klucza. To sekret: dopisz go do `secrets/dev.enc.env` przez `sops secrets/dev.enc.env`, nigdy jawnie do repo |
```

- [ ] **Step 12: Zainstaluj i commit**

```bash
rtk pnpm install
rtk pnpm exec prettier --write backend/ai eslint.config.mjs
rtk git add backend/ai eslint.config.mjs pnpm-lock.yaml README.md
rtk git commit -m "feat(ai): openai-compatible text client and bielik-one decision client" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 9: Pakiet `@sarmata/worker`

Proces Node uruchamiany przez tsx (pakiety wewnętrzne eksportują źródła TS bez builda, więc tsx jest zależnością produkcyjną workera). Start: konfiguracja z env, klient serwisowy, `regulations.syncOfficial()`, potem pętla `runWorker`. Interfejs pętli to jedna funkcja `runWorker(options, signal)`: czyta partię zadań, dla każdego wybiera handler po `type`, waliduje payload jego schematem, archiwizuje po sukcesie. Zadanie bez handlera, z błędnym payloadem albo po `maxAttempts` próbach trafia do archiwum pgmq z logiem błędu (archiwum pełni rolę dead letter). Wyjątek w handlerze zostawia zadanie, które wraca po czasie widoczności. Zamknięcie: SIGTERM albo SIGINT przerywa sen i nowe odczyty, a trwające zadanie kończy się normalnie. Kolejka to port `JobQueue` z `@sarmata/repositories` z dwoma adapterami: pgmq przez RPC i kolejka w pamięci w testach.

**Files:**
- Create: `backend/worker/package.json`, `backend/worker/tsconfig.json`, `backend/worker/src/index.ts`, `backend/worker/src/logger.ts`, `backend/worker/src/job-handler.ts`, `backend/worker/src/run-worker.ts`, `backend/worker/src/handlers/ping.ts`, `backend/worker/src/handlers/index.ts`, `backend/worker/src/config.ts`, `backend/worker/src/main.ts`, `backend/worker/src/sync-regulations.ts`
- Modify: `pnpm-workspace.yaml`, `package.json`, `scripts/termic-setup.sh`, `README.md`
- Test: `backend/worker/src/run-worker.test.ts`

- [ ] **Step 1: Zezwól na skrypt instalacyjny esbuild w `pnpm-workspace.yaml`**

tsx zależy od esbuild, który ma skrypt `postinstall`. pnpm 12 blokuje takie skrypty, dopóki nie są wpisane do `allowBuilds`. Sekcja z planu 2 ma wyglądać tak:

```yaml
# pnpm 12 blocks dependency build scripts unless listed here.
allowBuilds:
  esbuild: true
  supabase: true
```

- [ ] **Step 2: Utwórz `backend/worker/package.json` i `tsconfig.json`**

```json
{
  "name": "@sarmata/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "start": "tsx src/main.ts",
    "dev": "tsx watch src/main.ts",
    "sync-regulations": "tsx src/sync-regulations.ts",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@sarmata/repositories": "workspace:*",
    "@sarmata/services": "workspace:*",
    "tsx": "4.23.15",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Utwórz `backend/worker/src/logger.ts`**

```ts
export type LogFields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const line = (level: string, message: string, fields: LogFields = {}): string =>
  JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });

/** One JSON object per line on stdout and stderr, readable by `docker logs`. */
export const jsonLogger: Logger = {
  info: (message, fields) => {
    console.log(line('info', message, fields));
  },
  error: (message, fields) => {
    console.error(line('error', message, fields));
  },
};

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
```

- [ ] **Step 4: Utwórz `backend/worker/src/job-handler.ts`**

```ts
import { z } from 'zod';
import { type Logger } from './logger';

export interface JobContext {
  /** Aborted on shutdown. Long handlers pass it to fetch and stop early. */
  readonly signal: AbortSignal;
  readonly logger: Logger;
}

export type JobOutcome =
  { readonly status: 'done' } | { readonly status: 'invalid_payload'; readonly message: string };

/** A handler as the worker sees it: the payload is still unknown until the handler validates it. */
export interface JobHandler {
  readonly type: string;
  run(payload: unknown, context: JobContext): Promise<JobOutcome>;
}

/** Defines a handler for one job type with a zod schema of its payload. */
export function defineJobHandler<S extends z.ZodType>(definition: {
  readonly type: string;
  readonly payload: S;
  handle(payload: z.output<S>, context: JobContext): Promise<void>;
}): JobHandler {
  return {
    type: definition.type,
    async run(payload, context) {
      const parsed = definition.payload.safeParse(payload);
      if (!parsed.success)
        return { status: 'invalid_payload', message: z.prettifyError(parsed.error) };
      await definition.handle(parsed.data, context);
      return { status: 'done' };
    },
  };
}
```

- [ ] **Step 5: Utwórz `backend/worker/src/run-worker.ts`**

```ts
import { type JobQueue, type QueuedJob } from '@sarmata/repositories';
import { z } from 'zod';
import { type JobHandler } from './job-handler';
import { type Logger, describeError } from './logger';

export interface WorkerOptions {
  readonly queue: JobQueue;
  readonly handlers: readonly JobHandler[];
  readonly logger: Logger;
  readonly batchSize?: number;
  readonly visibilityTimeoutSeconds?: number;
  /** Deliveries before a failing job is archived as dead. */
  readonly maxAttempts?: number;
  /** Pause after an empty read or a queue error. */
  readonly idleDelayMs?: number;
}

const envelopeSchema = z.object({ type: z.string().min(1), payload: z.unknown() });

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

async function processJob(
  job: QueuedJob,
  handlers: ReadonlyMap<string, JobHandler>,
  options: WorkerOptions,
  signal: AbortSignal,
): Promise<void> {
  const { logger, queue } = options;
  const maxAttempts = options.maxAttempts ?? 5;
  const fields = { jobId: job.id, attempt: job.readCount };
  const envelope = envelopeSchema.safeParse(job.message);
  if (!envelope.success) {
    logger.error('malformed job archived', fields);
    await queue.archive(job.id);
    return;
  }
  const { type, payload } = envelope.data;
  const handler = handlers.get(type);
  if (handler === undefined) {
    logger.error('job without a handler archived', { ...fields, type });
    await queue.archive(job.id);
    return;
  }
  if (job.readCount > maxAttempts) {
    logger.error('job failed too many times, archived', { ...fields, type });
    await queue.archive(job.id);
    return;
  }
  try {
    const outcome = await handler.run(payload, { signal, logger });
    if (outcome.status === 'invalid_payload') {
      logger.error('job with an invalid payload archived', {
        ...fields,
        type,
        problem: outcome.message,
      });
    } else {
      logger.info('job done', { ...fields, type });
    }
    await queue.archive(job.id);
  } catch (error) {
    logger.error('job failed, it comes back after the visibility timeout', {
      ...fields,
      type,
      error: describeError(error),
    });
  }
}

/**
 * Processes jobs until `signal` is aborted. Resolves after the job in progress finishes.
 * Jobs read but not started before the abort return to the queue after the visibility timeout.
 */
export async function runWorker(options: WorkerOptions, signal: AbortSignal): Promise<void> {
  const handlers = new Map(options.handlers.map((handler) => [handler.type, handler]));
  if (handlers.size !== options.handlers.length) throw new Error('Two job handlers share a type');
  const batchSize = options.batchSize ?? 5;
  const visibilityTimeoutSeconds = options.visibilityTimeoutSeconds ?? 60;
  const idleDelayMs = options.idleDelayMs ?? 1_000;
  options.logger.info('worker started', { handlers: [...handlers.keys()] });
  // A function, so the check is re-read after every await (a plain property would stay narrowed).
  const stopping = (): boolean => signal.aborted;

  while (!stopping()) {
    let jobs: QueuedJob[];
    try {
      jobs = await options.queue.read(batchSize, visibilityTimeoutSeconds);
    } catch (error) {
      options.logger.error('queue read failed', { error: describeError(error) });
      await sleep(idleDelayMs, signal);
      continue;
    }
    if (jobs.length === 0) {
      await sleep(idleDelayMs, signal);
      continue;
    }
    for (const job of jobs) {
      if (stopping()) break;
      try {
        await processJob(job, handlers, options, signal);
      } catch (error) {
        options.logger.error('job bookkeeping failed', {
          jobId: job.id,
          error: describeError(error),
        });
      }
    }
  }
  options.logger.info('worker stopped');
}
```

- [ ] **Step 6: Utwórz handler przykładowy `backend/worker/src/handlers/ping.ts` i rejestr `handlers/index.ts`**

```ts
import { z } from 'zod';
import { defineJobHandler } from '../job-handler';

/** Liveness check: `select public.job_queue_send('{"type":"system.ping","payload":{"note":"hi"}}')`. */
export const pingHandler = defineJobHandler({
  type: 'system.ping',
  payload: z.object({ note: z.string().max(200) }),
  handle(payload, { logger }) {
    logger.info('pong', { note: payload.note });
    return Promise.resolve();
  },
});
```

```ts
import { type JobHandler } from '../job-handler';
import { pingHandler } from './ping';

/** Registry of job handlers. A new job type is a new handler added here. */
export const jobHandlers: readonly JobHandler[] = [pingHandler];
```

- [ ] **Step 7: Utwórz `backend/worker/src/config.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SARMATA_WORKER_IDLE_DELAY_MS: z.coerce.number().int().positive().default(1_000),
});

export interface WorkerConfig {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly idleDelayMs: number;
}

export function workerConfigFromEnv(env: Record<string, string | undefined>): WorkerConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid worker configuration:\n${z.prettifyError(result.error)}`);
  }
  return {
    supabaseUrl: result.data.SUPABASE_URL,
    secretKey: result.data.SUPABASE_SECRET_KEY,
    idleDelayMs: result.data.SARMATA_WORKER_IDLE_DELAY_MS,
  };
}
```

- [ ] **Step 8: Utwórz `backend/worker/src/index.ts`**

```ts
export { type WorkerConfig, workerConfigFromEnv } from './config';
export { jobHandlers } from './handlers/index';
export { type JobContext, type JobHandler, type JobOutcome, defineJobHandler } from './job-handler';
export { type Logger, jsonLogger } from './logger';
export { type WorkerOptions, runWorker } from './run-worker';
```

- [ ] **Step 9: Utwórz punkty wejścia `backend/worker/src/sync-regulations.ts` i `main.ts`**

```ts
import { createRepositories, createServiceClient } from '@sarmata/repositories';
import { createServices } from '@sarmata/services';
import { workerConfigFromEnv } from './config';
import { jsonLogger } from './logger';

// Loads official regulation versions into the database (pnpm regulations:sync, installer).
const config = workerConfigFromEnv(process.env);
const client = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });
const report = await createServices({
  repositories: createRepositories(client),
}).regulations.syncOfficial();
jsonLogger.info('official regulation versions synced', { ...report });
```

```ts
import { createJobQueue, createRepositories, createServiceClient } from '@sarmata/repositories';
import { createServices } from '@sarmata/services';
import { workerConfigFromEnv } from './config';
import { jobHandlers } from './handlers/index';
import { jsonLogger } from './logger';
import { runWorker } from './run-worker';

const config = workerConfigFromEnv(process.env);
const client = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });

// Every release restarts the worker, so the official versions known to this code reach the database
// before any job runs. A drift stops the process (ADR 0006).
const report = await createServices({
  repositories: createRepositories(client),
}).regulations.syncOfficial();
jsonLogger.info('official regulation versions synced', { ...report });

const controller = new AbortController();
for (const name of ['SIGTERM', 'SIGINT'] as const) {
  process.once(name, () => {
    jsonLogger.info('shutdown requested', { signal: name });
    controller.abort();
  });
}

await runWorker(
  {
    queue: createJobQueue(client),
    handlers: jobHandlers,
    logger: jsonLogger,
    idleDelayMs: config.idleDelayMs,
  },
  controller.signal,
);
```

- [ ] **Step 10: Napisz `backend/worker/src/run-worker.test.ts`**

```ts
import { type JobQueue, type QueuedJob } from '@sarmata/repositories';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  type JobHandler,
  type Logger,
  type WorkerOptions,
  defineJobHandler,
  jobHandlers,
  runWorker,
} from './index';

class InMemoryQueue implements JobQueue {
  readonly archived: number[] = [];
  reads = 0;
  private nextId = 1;
  private jobs: { id: number; readCount: number; message: unknown }[] = [];

  add(message: unknown): number {
    const id = this.nextId++;
    this.jobs.push({ id, readCount: 0, message });
    return id;
  }

  get pending(): number {
    return this.jobs.length;
  }

  send(message: { type: string; payload: Record<string, unknown> }): Promise<number> {
    return Promise.resolve(this.add(message));
  }

  read(batchSize: number): Promise<QueuedJob[]> {
    this.reads += 1;
    const batch = this.jobs.slice(0, batchSize);
    for (const job of batch) job.readCount += 1;
    return Promise.resolve(
      batch.map((job) => ({
        id: job.id,
        readCount: job.readCount,
        enqueuedAt: '2026-11-21T10:00:00Z',
        message: job.message,
      })),
    );
  }

  archive(id: number): Promise<void> {
    this.archived.push(id);
    this.jobs = this.jobs.filter((job) => job.id !== id);
    return Promise.resolve();
  }
}

interface LogEntry {
  level: 'info' | 'error';
  message: string;
  fields: Record<string, unknown>;
}

function recordingLogger(): Logger & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    info: (message, fields = {}) => entries.push({ level: 'info', message, fields }),
    error: (message, fields = {}) => entries.push({ level: 'error', message, fields }),
  };
}

const recordingHandler = (type = 'test.record') => {
  const payloads: unknown[] = [];
  const handler = defineJobHandler({
    type,
    payload: z.object({ value: z.number() }),
    handle(payload) {
      payloads.push(payload);
      return Promise.resolve();
    },
  });
  return { handler, payloads };
};

async function runUntil(
  options: Omit<WorkerOptions, 'logger'> & { logger?: Logger },
  done: () => boolean,
): Promise<void> {
  const controller = new AbortController();
  const running = runWorker(
    { idleDelayMs: 1, logger: recordingLogger(), ...options },
    controller.signal,
  );
  await vi.waitFor(
    () => {
      if (!done()) throw new Error('not yet');
    },
    { timeout: 2_000, interval: 5 },
  );
  controller.abort();
  await running;
}

describe('runWorker', () => {
  it('runs the handler of a known job and archives the job', async () => {
    const queue = new InMemoryQueue();
    const { handler, payloads } = recordingHandler();
    queue.add({ type: 'test.record', payload: { value: 7 } });
    await runUntil({ queue, handlers: [handler] }, () => queue.pending === 0);
    expect(payloads).toEqual([{ value: 7 }]);
    expect(queue.archived).toEqual([1]);
  });

  it('archives a job without a handler and runs nothing', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    const { handler, payloads } = recordingHandler();
    queue.add({ type: 'test.unknown', payload: {} });
    await runUntil({ queue, handlers: [handler], logger }, () => queue.pending === 0);
    expect(payloads).toEqual([]);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'job without a handler archived' }),
    );
  });

  it('archives a job whose payload does not match the schema', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    const { handler, payloads } = recordingHandler();
    queue.add({ type: 'test.record', payload: { value: 'seven' } });
    await runUntil({ queue, handlers: [handler], logger }, () => queue.pending === 0);
    expect(payloads).toEqual([]);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ message: 'job with an invalid payload archived' }),
    );
  });

  it('archives a message that is not a job envelope', async () => {
    const queue = new InMemoryQueue();
    queue.add('just a string');
    await runUntil({ queue, handlers: [] }, () => queue.pending === 0);
    expect(queue.archived).toEqual([1]);
  });

  it('retries a failing job and archives it after maxAttempts deliveries', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    let calls = 0;
    const failing = defineJobHandler({
      type: 'test.fail',
      payload: z.object({}),
      handle() {
        calls += 1;
        return Promise.reject(new Error('smtp down'));
      },
    });
    queue.add({ type: 'test.fail', payload: {} });
    await runUntil(
      { queue, handlers: [failing], logger, maxAttempts: 3 },
      () => queue.pending === 0,
    );
    expect(calls).toBe(3);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ message: 'job failed too many times, archived' }),
    );
  });

  it('finishes the job in progress before stopping and leaves the rest in the queue', async () => {
    const queue = new InMemoryQueue();
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const slow = defineJobHandler({
      type: 'test.slow',
      payload: z.object({}),
      handle: () => {
        markStarted();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    queue.add({ type: 'test.slow', payload: {} });
    queue.add({ type: 'test.slow', payload: {} });
    const controller = new AbortController();
    const running = runWorker(
      { queue, handlers: [slow], logger: recordingLogger(), idleDelayMs: 1 },
      controller.signal,
    );
    await started;
    controller.abort();
    let stopped = false;
    void running.then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    release();
    await running;
    expect(queue.archived).toEqual([1]);
    expect(queue.pending).toBe(1);
    expect(queue.reads).toBe(1);
  });

  it('stops promptly while waiting on an empty queue', async () => {
    const queue = new InMemoryQueue();
    const controller = new AbortController();
    const running = runWorker(
      { queue, handlers: [], logger: recordingLogger(), idleDelayMs: 60_000 },
      controller.signal,
    );
    await vi.waitFor(() => {
      expect(queue.reads).toBe(1);
    });
    controller.abort();
    await expect(running).resolves.toBeUndefined();
  });

  it('refuses two handlers of the same type', async () => {
    const handlers: JobHandler[] = [recordingHandler().handler, recordingHandler().handler];
    await expect(
      runWorker(
        { queue: new InMemoryQueue(), handlers, logger: recordingLogger() },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Two job handlers share a type');
  });

  it('answers system.ping with a pong log line', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    queue.add({ type: 'system.ping', payload: { note: 'hello' } });
    await runUntil({ queue, handlers: jobHandlers, logger }, () => queue.pending === 0);
    expect(logger.entries).toContainEqual({
      level: 'info',
      message: 'pong',
      fields: { note: 'hello' },
    });
  });
});
```

- [ ] **Step 11: Skrypty korzenia w `package.json`**

Zmień `db:reset` i dopisz trzy skrypty:

```json
    "db:reset": "pnpm --filter @sarmata/database reset && pnpm regulations:sync",
    "regulations:sync": "bash scripts/with-supabase-env.sh pnpm --filter @sarmata/worker sync-regulations",
    "worker:start": "bash scripts/with-supabase-env.sh pnpm --filter @sarmata/worker start",
    "worker:dev": "bash scripts/with-supabase-env.sh pnpm --filter @sarmata/worker dev",
```

- [ ] **Step 12: Synchronizacja w `scripts/termic-setup.sh`**

W bloku `if docker info ...` zaraz po linii, która uruchamia Supabase (zawiera `supabase start`), dopisz z tym samym wcięciem:

```bash
  pnpm regulations:sync
```

- [ ] **Step 13: Zaktualizuj `README.md`**

W sekcji „Jak uruchomić (dev)”, w punkcie z bazą danych, pod blokiem z `pnpm db:start` i `pnpm db:reset` dopisz (wcięcie trzech spacji):

```markdown
   `pnpm db:reset` kończy się synchronizacją oficjalnych wersji przepisów z `backend/regulations` do tabeli `regulation_versions`. To samo robi worker przy każdym starcie, a `pnpm regulations:sync` uruchamia ją osobno.
```

Na końcu numerowanej listy w tej sekcji dodaj kolejny punkt (numer o jeden większy od ostatniego, poniżej jako 8):

```markdown
8. **Worker kolejki zadań** (opcjonalnie, potrzebny dopiero dla zadań w tle):

       pnpm worker:dev

   Najpierw synchronizuje wersje przepisów, potem czyta kolejkę pgmq `jobs`. Ctrl+C kończy go po bieżącym zadaniu. Próba: `docker exec supabase_db_sarmata psql -U postgres -c "select public.job_queue_send('{\"type\":\"system.ping\",\"payload\":{\"note\":\"hi\"}}')"`, w logu pojawi się `pong`.
```

W tabeli „Skrypty” zamień wiersz `pnpm db:reset` na:

```markdown
| `pnpm db:reset` | migracje od zera, dane demo i synchronizacja oficjalnych wersji przepisów |
```

i po wierszu `pnpm test:integration` dopisz:

```markdown
| `pnpm regulations:sync` | wstawia brakujące oficjalne wersje przepisów, kończy się błędem, gdy wersja w bazie różni się od kodu |
| `pnpm worker:dev` | worker kolejki pgmq z przeładowaniem po zmianie kodu |
| `pnpm worker:start` | worker kolejki pgmq bez przeładowania |
```

W tabeli „Zmienne środowiskowe” dopisz na końcu:

```markdown
| `SARMATA_WORKER_IDLE_DELAY_MS` | worker | domyślnie `1000`, przerwa po pustym odczycie kolejki |
```

Na końcu sekcji „## Termic” dopisz akapit:

```markdown
Skrypt setup po starcie wspólnej bazy synchronizuje oficjalne wersje przepisów (`pnpm regulations:sync`).
```

- [ ] **Step 14: Zainstaluj i commit**

```bash
rtk pnpm install
rtk pnpm exec prettier --write backend/worker package.json pnpm-workspace.yaml
rtk git add backend/worker package.json pnpm-workspace.yaml pnpm-lock.yaml scripts/termic-setup.sh README.md
rtk git commit -m "feat(worker): pgmq worker with graceful shutdown and regulation sync" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 10: Dokumentacja architektury

README aktualizują zadania 6, 8 i 9 w swoich commitach. Tu zostaje mapa repo.

**Files:**
- Modify: `docs/architektura.md`

- [ ] **Step 1: W `docs/architektura.md` w bloku „Struktura repo” po linii `domain/` dopisz**

```
  regulations/    oficjalne wersje przepisów: rules.json, testy przypadków, źródła prawa (ADR 0006)
```

- [ ] **Step 2: Commit**

```bash
rtk git add docs/architektura.md
rtk git commit -m "docs: regulations package in the architecture overview" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

## Walidacja końcowa (raz, po wszystkich zadaniach)

1. `rtk pnpm install --frozen-lockfile`: bez zmian w lockfile, bez ostrzeżenia o zablokowanym skrypcie esbuild.
2. `rtk pnpm check`: PASS. ESLint i Prettier bez uwag, typecheck wszystkich pakietów, testy Vitest w `@sarmata/domain`, `@sarmata/regulations`, `@sarmata/services`, `@sarmata/ai` i `@sarmata/worker` przechodzą.
3. `rtk pnpm db:reset`: migracje i seed bez błędów, na końcu linia JSON `official regulation versions synced` z `"inserted":["regulation-2016"]`.
4. `rtk pnpm regulations:sync`: drugi przebieg daje `"inserted":[]` i `"unchanged":["regulation-2016"]`.
5. `rtk pnpm db:test`: wszystkie testy pgTAP PASS (28 w `001_office_isolation` z planu 2 bez zmian, 11 w `002_regulation_versions`, 4 w `003_job_queue`).
6. `rtk pnpm test:integration`: 7 testów PASS.
7. `rtk pnpm db:types && rtk git diff --exit-code database/src/types.ts`: brak różnic.
8. Granica warstw: utwórz `backend/services/src/probe.ts` z treścią `import '@supabase/supabase-js';`, uruchom `rtk proxy pnpm exec eslint backend/services/src/probe.ts` (oczekiwany błąd `no-restricted-imports` z komunikatem o ADR 0004), usuń plik.
9. Dryf wersji oficjalnej jest głośny:

```bash
docker exec supabase_db_sarmata psql -U postgres -c "update public.regulation_versions set document = document where code = 'regulation-2016'"
```

Expected: `ERROR:  official regulation version regulation-2016 is immutable`.

10. Worker na żywo, z zamknięciem po SIGTERM:

```bash
bash scripts/with-supabase-env.sh backend/worker/node_modules/.bin/tsx backend/worker/src/main.ts > /tmp/sarmata-worker.log 2>&1 &
WORKER=$!
sleep 4
docker exec supabase_db_sarmata psql -U postgres -c "select public.job_queue_send('{\"type\":\"system.ping\",\"payload\":{\"note\":\"smoke\"}}')"
sleep 3
kill -TERM $WORKER
wait $WORKER
rtk proxy grep -E '"message":"(official regulation versions synced|worker started|pong|job done|shutdown requested|worker stopped)"' /tmp/sarmata-worker.log
```

Expected: sześć linii w tej kolejności, `pong` z `"note":"smoke"`, proces kończy się kodem 0.

Następny plan: `2026-11-21-fundament-4-*.md` (frontend korzystający z `@sarmata/services` przez `servicesFor`).

## Przegląd codebase-design

Plan przejrzany słownikiem z `.claude/skills/codebase-design` (głębokość, szwy, interfejs jako powierzchnia testów).

Zmiany wprowadzone po przeglądzie:
- **Terminy jako jeden głęboki moduł.** Zamiast eksportować `addDays`, `isWorkingDay`, `nextWorkingDayOnOrAfter`, `mergeAbsences` i trzy funkcje strategii domena eksportuje tylko `computeDeadline(rule, facts)` i typy. Święta, Wielkanoc i sklejanie nieobecności są testowane przez ten interfejs (np. przesunięcie końca terminu przez `daysFromEvent` z jednym dniem), więc zmiana algorytmu świąt nie rusza testów.
- **Wynik `suspended` zamiast wyjątku** dla nieobecności bez końca. To normalny stan ze specu („wstrzymany do powrotu”), a nie błąd, więc jest w typie wyniku i wołający musi go obsłużyć.
- **`nominalDue` obok `due`** w wyniku. UI pokaże, że termin przesunął się z dnia wolnego (P-02: „oznaczać w UI”), bez drugiego wywołania.
- **Spójność dokumentu w schemacie, nie w serwisie.** Odwołania do kryteriów i poziomów oraz ciągłość przedziałów sprawdza `parseRegulationDocument`. Edytor reguł, repozytorium i katalog oficjalny przechodzą przez ten sam punkt.
- **Kolejka jako osobna fabryka `createJobQueue`.** `Repositories` zawiera tylko repozytoria działające z JWT użytkownika, więc fałszywe repozytoria w testach serwisów nie muszą udawać kolejki, a frontend nie dostaje w typie metody, która zawsze kończy się 42501.
- **Synchronizacja sprawdza wszystko przed zapisem.** Pierwotny szkic wstawiał wersje w pętli i mógł zostawić bazę w połowie przy dryfie.
- **`AiResult` zamiast wyjątków w `@sarmata/ai`.** Ścieżka bez AI jest wymagana przez spec, więc jest w typie wyniku. `available` pozwala serwisom ukryć funkcję zamiast wołać i dostawać `disabled`.
- **Handler sam waliduje payload** (`defineJobHandler` zwraca `run(payload: unknown)`). Rejestr ma jeden typ elementu bez `any`, a pętla workera nie zna schematów.

Rozważone i odrzucone:
- **Port kalendarza świąt wstrzykiwany do `computeDeadline`.** Jest tylko jeden adapter (ustawa o dniach wolnych), a testy nie potrzebują innego. Hipotetyczny szew.
- **Mechanizm `strategies.ts` w katalogu wersji teraz.** Wersja 2016 nie potrzebuje logiki spoza rejestru domeny, więc byłby to szew z zerem adapterów. Gdy pierwsza wersja (np. UDER102 z „miesiącem kalendarzowym upływu”) będzie go potrzebować, dojdzie wariant `custom` w schemacie reguły i parametr z rejestrem strategii wersji w `computeDeadline`.
- **Strategia `calendarMonthOfExpiry` dla UDER102.** Poza zakresem z decyzji wątku funkcjonalnego, dojdzie z katalogiem nowej wersji.
- **Zapasowe decyzje na modelu tekstowym (ADR 0005) w `decide`.** Interfejs `decide` już na to pozwala bez zmian u wołających, ale pierwsza usługa HR partnera ustali, czy wynik bez prawdopodobieństw jest akceptowalny. Odłożone do niej.
- **SDK `openai`.** Dwa POST-y z JSON nie uzasadniają zależności, a SDK nie obsługuje `/v1/systemone`.
- **Bezpośrednie połączenie workera z Postgresem i `read_with_poll`.** Uzasadnienie w zadaniu 5.
- **Testy jednostkowe repozytoriów na mockach supabase-js.** Repozytoria to cienkie adaptery na zapytaniach, a mock testowałby przeszłość interfejsu. Testy integracyjne na prawdziwej bazie sprawdzają też RLS.
- **Serwis `employees.list` jako przelotka.** Zostaje mimo testu usunięcia, bo frontend nie może importować repozytoriów (ADR 0004). Logika dojdzie z dopasowaniem pracowników (pg_trgm).
- **Typ `Employee` w domenie.** Na razie to tylko kształt wiersza bez reguł. Przeniesiemy go, gdy dojdą reguły pracownika (rodzaj stanowiska, stosunek pracy).
- **Mnożniki stopni służbowych z YAML w dokumencie wersji.** To wynagrodzenia, nie reguły oceny.
