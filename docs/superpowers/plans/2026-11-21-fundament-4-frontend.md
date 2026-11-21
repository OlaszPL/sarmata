# Fundament 4: powłoka frontu. Plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** aplikacja Next.js w `frontend/web` z logowaniem Supabase, chronionym layoutem z nazwą urzędu i rolą konta, biblioteką `@sarmata/ui` (shadcn w barwach gov.pl), skryptem run dla Termic, testami Playwright w CI i skillem do przeklikiwania aplikacji.

**Architektura:** Server Components pobierają dane wyłącznie przez `@sarmata/services` (ADR 0004). Klient Supabase powstaje w `frontend/web` przez `@supabase/ssr` na ciasteczkach żądania i trafia do serwisu jako zależność, więc RLS działa z JWT konta. Logowanie i wylogowanie to server actions, a `src/proxy.ts` (Next.js 16, dawny middleware) odświeża sesję i przekierowuje niezalogowanych. `@sarmata/ui` trzyma komponenty wygenerowane przez CLI shadcn nietknięte w `src/shadcn/`, a nasze nakładki w `src/components/`. Konfiguracja serwera (adres i klucz Supabase) jest czytana w czasie działania i walidowana zodem, więc jeden build obsłuży dowolną instancję Supabase.

**Stack:** Next.js 16.4.6, React 19.3.1, TypeScript 6.0.3, Tailwind CSS 4.3.5, shadcn 4.23.0 (styl `radix-vega`, pakiet `radix-ui` 1.8.1), lucide-react 1.77.0, @supabase/ssr 0.12.7 z @supabase/supabase-js 2.119.2, zod 4.6.7, Open Sans (`@fontsource-variable/open-sans` 5.3.0, OFL 1.1), Playwright 1.65.1 z @axe-core/playwright 4.14.0.

**Kontekst dla wykonawcy:**
- Decyzje: `docs/adr/0004-repozytoria-supabase-js.md` (frontend woła tylko serwisy, mutacje przez server actions), `docs/adr/0003-wdrozenie-u-klienta.md` (build lokalny, jedna instancja na urząd), `docs/architektura.md`. Motyw: `docs/sources/ux-standardy/FINDINGS.md`, sekcje 2 i 9. Spec UI: `docs/spec.md` (shadcn z CLI i nakładki, lucide, Playwright ze skillem).
- Wymaga wykonanych planów 2 (Supabase `sarmata` na 554xx, hook JWT z claimami `office_id` i `office_role`, konta demo) i 3 (pakiety backendu). Zadanie 1 dokłada do backendu jeden serwis `getCurrentAccount`. Jeśli plan 3 utworzył już pakiety `@sarmata/repositories` i `@sarmata/services`, zadanie 1 tylko dopisuje pliki i eksporty (opis w kroku 1 zadania).
- Wersje sprawdzone 21.11.2026 (`pnpm view`). Next.js 16: plik `proxy.ts` z funkcją `proxy` zastępuje `middleware.ts`, `cookies()` jest asynchroniczne, `next lint` nie istnieje (ESLint wołamy sami), `next typegen` generuje `next-env.d.ts` i typy tras bez builda. `@supabase/ssr` 0.12.7: tylko `getAll` i `setAll(cookies, headers)`, sesję weryfikuje `auth.getClaims()`.
- Styl shadcn `radix-vega` używa pakietu `radix-ui` (prymitywy Radix). Monorepo z aliasami `#...` przez `imports` w `package.json` to oficjalny wariant CLI (dokumentacja „package imports”). Generowanych plików w `frontend/ui/src/shadcn/` nigdy nie edytujemy ręcznie. Zmiana wyglądu idzie przez tokeny w `globals.css` albo nakładkę w `src/components/`.
- CLI shadcn może zaimportować funkcję `cn` z lokalnego `#shadcn/lib/utils` albo z pakietu npm `cn` (nowszy wariant CLI). Oba wyniki są poprawne. Nasze nakładki nie importują `cn`, tylko przekazują `className` do komponentu wygenerowanego, który sam scala klasy.
- `exactOptionalPropertyTypes` jest wyłączone w `frontend/ui` i `frontend/web`, bo kod generowany przez shadcn nie jest pisany pod tę opcję, a web typuje pliki `@sarmata/ui` swoimi ustawieniami.
- Żaden nowy pakiet nie ma skryptu instalacyjnego (sprawdzone: `sharp` 0.35, `@tailwindcss/oxide`, `@playwright/test`), więc `allowBuilds` w `pnpm-workspace.yaml` nie wymaga zmian. Gdyby `pnpm install` zgłosił `ERR_PNPM_IGNORED_BUILDS`, wpisz wymieniony pakiet do `allowBuilds` z wartością `false` i powtórz instalację.
- Build produkcyjny: zależności czasu działania (`next`, `react`, `@supabase/ssr`, `zod`, `server-only`, fonty, pakiety `@sarmata/*`) są w `dependencies`, narzędzia budowania (Tailwind, PostCSS, typy, TypeScript) w `devDependencies`. Sposób pakowania (`pnpm deploy --prod` po buildzie albo `output: 'standalone'`) wybiera plan 6.
- Polecenia powłoki z prefiksem `rtk` (`AGENTS.md`). Proza bez półpauz i bez średników. Kod, nazwy plików i komentarze po angielsku, teksty interfejsu po polsku (forma „ty”, bez form rodzajowych, zalecenia z FINDINGS sekcja 2 „Język i treść”).
- Model wykonania: zadania po kolei, bez sprawdzeń po drodze. Sprawdzenia są w sekcji „Walidacja końcowa”. Typowe poprawki, gdyby walidacja je wykazała: Next przy pierwszym `next dev` albo `next build` może dopisać pola do `frontend/web/tsconfig.json` (zatwierdź je osobnym commitem `chore(web): tsconfig fields required by next`), a błędy `tsc` wyłącznie w plikach `.next/types` usuwa ustawienie `"verbatimModuleSyntax": false` w `frontend/web/tsconfig.json`.

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `pnpm-workspace.yaml` | katalog wersji frontu, `savePrefix: ''` (dokładne wersje także przy `pnpm add` z CLI shadcn) |
| `backend/repositories/src/{db,auth,offices}.ts` | typ klienta `Db`, odczyt zweryfikowanych claimów, nazwa urzędu |
| `backend/services/src/account/current-account.ts` | `getCurrentAccount(db)`: kto jest zalogowany, w jakim urzędzie i z jaką rolą |
| `frontend/ui/package.json`, `components.json`, `tsconfig.json` | pakiet `@sarmata/ui`, aliasy `#shadcn/...` dla CLI |
| `frontend/ui/src/shadcn/**` | komponenty i util wygenerowane przez CLI shadcn (nie edytować) |
| `frontend/ui/src/styles/globals.css` | Tailwind, tokeny gov.pl, Open Sans, widoczny fokus |
| `frontend/ui/src/components/*.tsx` | nakładki: `AppShell`, `TextField`, `FormAlert`, `SubmitButton` |
| `frontend/ui/src/index.ts` | jedyny interfejs pakietu |
| `frontend/web/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs` | aplikacja Next.js |
| `frontend/web/src/env.ts` | konfiguracja serwera walidowana zodem przy pierwszym użyciu |
| `frontend/web/src/proxy.ts` | odświeżanie sesji i przekierowania |
| `frontend/web/src/lib/{supabase,account,auth-actions,routes,product,role-labels}.ts` | klient Supabase żądania, bieżące konto, server actions, stałe |
| `frontend/web/src/app/**` | layout główny, `/logowanie`, chroniona grupa `(app)`, `/brak-urzedu` |
| `scripts/task-port.mjs`, `scripts/termic-run.sh`, `scripts/web-env.mjs` | port taska, skrypt run Termic, `.env.local` aplikacji z `supabase status` |
| `e2e/**` | `@sarmata/e2e`: konfiguracja Playwright, pomocniki, testy, przejście ze zrzutami |
| `.github/workflows/ci.yml` | job `e2e` na main i ręcznie |
| `.claude/skills/app-walkthrough/SKILL.md` | skill do przeklikiwania aplikacji |
| `eslint.config.mjs`, `.prettierignore`, `.gitignore`, `package.json`, `scripts/termic-setup.sh`, `README.md` | reguły, ignorowane pliki, skrypty korzenia, setup, dokumentacja |

---

### Task 1: Katalog wersji i serwis bieżącego konta

Serwis odpowiada na jedno pytanie: kto jest zalogowany i w jakim urzędzie. Czyta zweryfikowane claimy JWT (`office_id`, `office_role` dokłada hook z planu 2), sprawdza je zodem i dobiera nazwę urzędu zapytaniem objętym RLS. Repozytoria pozostają jedynym miejscem z wywołaniami Supabase, serwis interpretuje kontrakt claimów.

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create (albo uzupełnij, gdy istnieją): `backend/repositories/package.json`, `backend/repositories/tsconfig.json`, `backend/repositories/src/db.ts`, `backend/repositories/src/auth.ts`, `backend/repositories/src/offices.ts`, `backend/repositories/src/index.ts`, `backend/services/package.json`, `backend/services/tsconfig.json`, `backend/services/src/account/current-account.ts`, `backend/services/src/index.ts`

- [ ] **Step 1: Sprawdź, co zostawił plan 3**

Run: `rtk ls backend`

Jeśli istnieją `backend/repositories/package.json` i `backend/services/package.json`, nie twórz ich ani tsconfigów od nowa (pomiń kroki 4, 5, 9 i 10). Utwórz tylko pliki z kroków 6 do 8 i 11, dopisz linie eksportów z kroków 8 i 12 do istniejących `src/index.ts` i dodaj brakujące zależności poleceniami z kroku 13. Jeśli plan 3 ma już typ klienta bazy pod inną nazwą, nie twórz `src/db.ts` i w plikach z kroków 7, 8 i 11 użyj istniejącego typu zamiast `Db`.

- [ ] **Step 2: Ustaw dokładne wersje przy `pnpm add`**

Na początku `pnpm-workspace.yaml`, przed `packages:`, dopisz:

```yaml
savePrefix: ''

```

- [ ] **Step 3: Dopisz wersje frontu do katalogu**

W sekcji `catalog:` w `pnpm-workspace.yaml` dopisz brakujące wpisy (istniejących nie zmieniaj):

```yaml
  '@supabase/supabase-js': 2.119.2
  '@types/react': 19.3.0
  '@types/react-dom': 19.3.0
  lucide-react: 1.77.0
  react: 19.3.1
  react-dom: 19.3.1
  tailwindcss: 4.3.5
  zod: 4.6.7
```

- [ ] **Step 4: Utwórz `backend/repositories/package.json`**

```json
{
  "name": "@sarmata/repositories",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@sarmata/database": "workspace:*",
    "@supabase/supabase-js": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 5: Utwórz `backend/repositories/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 6: Utwórz `backend/repositories/src/db.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@sarmata/database';

/** Supabase client acting as the signed-in account (its JWT), so every query goes through RLS. */
export type Db = SupabaseClient<Database>;
```

- [ ] **Step 7: Utwórz `backend/repositories/src/auth.ts`**

```ts
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { Db } from './db';

/**
 * Verified JWT claims of the signed-in account, or null when nobody is signed in or the session
 * is no longer valid. Network failures are rethrown, because they do not mean a sign-out.
 */
export async function readAccountClaims(db: Db): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.auth.getClaims();
  if (error) {
    if (isAuthRetryableFetchError(error)) throw error;
    return null;
  }
  return data?.claims ?? null;
}
```

- [ ] **Step 8: Utwórz `backend/repositories/src/offices.ts` i `backend/repositories/src/index.ts`**

`backend/repositories/src/offices.ts`:

```ts
import type { Db } from './db';

/** Name of the office, or null when it does not exist or RLS hides it from the account. */
export async function findOfficeName(db: Db, officeId: string): Promise<string | null> {
  const { data, error } = await db.from('offices').select('name').eq('id', officeId).maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}
```

`backend/repositories/src/index.ts`:

```ts
export type { Database } from '@sarmata/database';
export type { Db } from './db';
export { readAccountClaims } from './auth';
export { findOfficeName } from './offices';
```

- [ ] **Step 9: Utwórz `backend/services/package.json`**

```json
{
  "name": "@sarmata/services",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@sarmata/repositories": "workspace:*",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 10: Utwórz `backend/services/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 11: Utwórz `backend/services/src/account/current-account.ts`**

```ts
import { z } from 'zod';
import { findOfficeName, readAccountClaims, type Database, type Db } from '@sarmata/repositories';

export type OfficeRole = Database['public']['Enums']['office_role'];

const officeRoles = ['admin', 'hr', 'evaluator'] as const satisfies readonly OfficeRole[];

export type MemberAccount = {
  status: 'member';
  userId: string;
  email: string;
  office: { id: string; name: string };
  role: OfficeRole;
};

export type CurrentAccount =
  | { status: 'signed-out' }
  | { status: 'no-office'; userId: string; email: string }
  | MemberAccount;

// Claim contract set by public.custom_access_token_hook (plan 2).
const claimsSchema = z.object({
  sub: z.uuid(),
  email: z.string().default(''),
  office_id: z.uuid().optional(),
  office_role: z.enum(officeRoles).optional(),
});

/**
 * Who is signed in, in which office and with which role. Reads the verified JWT through the
 * account's own client. Throws when the token breaks the claim contract or the office from the
 * token is not visible, because both mean a broken installation, not a user mistake.
 */
export async function getCurrentAccount(db: Db): Promise<CurrentAccount> {
  const claims = await readAccountClaims(db);
  if (claims === null) return { status: 'signed-out' };

  const parsed = claimsSchema.parse(claims);
  if (!parsed.office_id || !parsed.office_role) {
    return { status: 'no-office', userId: parsed.sub, email: parsed.email };
  }

  const officeName = await findOfficeName(db, parsed.office_id);
  if (officeName === null) {
    throw new Error(`Office ${parsed.office_id} from the JWT is not visible to account ${parsed.sub}`);
  }

  return {
    status: 'member',
    userId: parsed.sub,
    email: parsed.email,
    office: { id: parsed.office_id, name: officeName },
    role: parsed.office_role,
  };
}
```

- [ ] **Step 12: Utwórz `backend/services/src/index.ts`**

```ts
export type { Database, Db } from '@sarmata/repositories';
export {
  getCurrentAccount,
  type CurrentAccount,
  type MemberAccount,
  type OfficeRole,
} from './account/current-account';
```

`Database` i `Db` są reeksportowane, bo `frontend/web` importuje wyłącznie `@sarmata/services` (ADR 0004), a potrzebuje typu do utworzenia klienta.

- [ ] **Step 13: Zainstaluj**

Run: `rtk pnpm install`

Gdy pakiety pochodziły z planu 3, zamiast tego: `rtk pnpm --filter @sarmata/repositories add @supabase/supabase-js@catalog: @sarmata/database@workspace:* && rtk pnpm --filter @sarmata/services add zod@catalog: @sarmata/repositories@workspace:*`

- [ ] **Step 14: Commit**

```bash
rtk git add pnpm-workspace.yaml pnpm-lock.yaml backend/repositories backend/services
rtk git commit -m "feat(services): current account from verified jwt claims

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 2: `@sarmata/ui`: shadcn, motyw gov.pl i nakładki

Tokeny pochodzą z palety gov.pl (FINDINGS sekcja 2). Tekst: Black #1b1b1b. Akcja główna: Dark blue #0052a5 (7,64:1). Tekst pomocniczy: Gray 1 #656565 (5,83:1). Błędy: Dark red #a7162d (7,51:1). Obramowanie pól: Gray 2 #767676 (4,54:1), bo granica pola musi mieć co najmniej 3:1 (WCAG 1.4.11), a Gray 3a #dadada zostaje tylko na linie dekoracyjne. Zielony #598527 nie jest użyty jako tekst (4,37:1). Fokus to 3 px Dark blue z odstępem, poza warstwami Tailwinda, więc wygrywa z `outline-none` w komponentach. Tryb ciemny pomijamy (opcjonalny w zakresie), wariant `dark` zostaje tylko dlatego, że używają go klasy wygenerowanych komponentów.

**Files:**
- Create: `frontend/ui/package.json`, `frontend/ui/tsconfig.json`, `frontend/ui/components.json`, `frontend/ui/src/styles/globals.css`, `frontend/ui/src/components/app-shell.tsx`, `frontend/ui/src/components/text-field.tsx`, `frontend/ui/src/components/form-alert.tsx`, `frontend/ui/src/components/submit-button.tsx`, `frontend/ui/src/index.ts`
- Generated (CLI): `frontend/ui/src/shadcn/**`

- [ ] **Step 1: Utwórz `frontend/ui/package.json`**

```json
{
  "name": "@sarmata/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "imports": {
    "#shadcn/ui/*": "./src/shadcn/ui/*.tsx",
    "#shadcn/lib/*": "./src/shadcn/lib/*.ts",
    "#shadcn/hooks/*": "./src/shadcn/hooks/*.ts",
    "#components/*": "./src/components/*.tsx"
  },
  "exports": {
    ".": "./src/index.ts",
    "./globals.css": "./src/styles/globals.css"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "lucide-react": "catalog:",
    "radix-ui": "1.8.1",
    "tailwind-merge": "3.7.1"
  },
  "peerDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "shadcn": "4.23.0",
    "tailwindcss": "catalog:",
    "tw-animate-css": "1.4.0",
    "typescript": "catalog:"
  }
}
```

`./globals.css` to jedyny eksport poza `src/index.ts`, bo arkusz stylów nie jest modułem TS. `shadcn`, `tailwindcss` i `tw-animate-css` są potrzebne przy budowaniu (importy w CSS), więc są w `devDependencies`.

- [ ] **Step 2: Utwórz `frontend/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "exactOptionalPropertyTypes": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Utwórz `frontend/ui/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-vega",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "#shadcn/ui",
    "ui": "#shadcn/ui",
    "lib": "#shadcn/lib",
    "hooks": "#shadcn/hooks",
    "utils": "#shadcn/lib/utils"
  }
}
```

Wszystkie aliasy CLI wskazują `src/shadcn/`, więc cokolwiek wygeneruje CLI, trafia do jednego katalogu, a nasze nakładki w `src/components/` są poza jego zasięgiem.

- [ ] **Step 4: Utwórz `frontend/ui/src/styles/globals.css`**

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';

/* Class sources: this package and the web app (relative to this file). */
@source '../';
@source '../../../web/src';

/* Used by classes in generated shadcn components. The app has no dark theme. */
@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: 'Open Sans Variable', 'Open Sans', system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Gov.pl palette (docs/sources/ux-standardy/FINDINGS.md, section 2). Contrast is against white. */
:root {
  --radius: 0.375rem;
  --background: #ffffff;
  --foreground: #1b1b1b; /* Black */
  --card: #ffffff;
  --card-foreground: #1b1b1b;
  --popover: #ffffff;
  --popover-foreground: #1b1b1b;
  --primary: #0052a5; /* Dark blue, 7.64:1 */
  --primary-foreground: #ffffff;
  --secondary: #f1f1f1; /* Gray 4 */
  --secondary-foreground: #1b1b1b;
  --muted: #f1f1f1;
  --muted-foreground: #656565; /* Gray 1, 5.83:1 */
  --accent: #f1f1f1;
  --accent-foreground: #00468d; /* Navy blue */
  --destructive: #a7162d; /* Dark red, 7.51:1 */
  --border: #dadada; /* Gray 3a, decorative lines only */
  --input: #767676; /* Gray 2, 4.54:1, field borders need 3:1 (WCAG 1.4.11) */
  --ring: #006cd7; /* Light blue, 5.09:1 */
  --focus: #0052a5;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-size: 1rem;
    line-height: 1.5;
  }

  h1,
  h2,
  h3,
  h4 {
    line-height: 1.25;
  }
}

/*
 * Deliberately outside any layer: unlayered rules win over Tailwind utilities such as
 * outline-none, so every focusable element keeps a visible focus indicator (WCAG 2.4.7 and 1.4.11).
 */
:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Zainstaluj i zatwierdź szkielet przed uruchomieniem CLI**

```bash
rtk pnpm install
rtk git add frontend/ui pnpm-lock.yaml
rtk git commit -m "chore(ui): ui package with shadcn config and gov.pl theme

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

Commit przed CLI pozwala w następnym kroku jednym poleceniem cofnąć ewentualne zmiany CLI w naszych plikach.

- [ ] **Step 6: Wygeneruj komponenty CLI shadcn**

Run: `rtk pnpm --filter @sarmata/ui exec shadcn add button input label card alert badge --yes`

Expected: pliki w `frontend/ui/src/shadcn/ui/` (`button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `badge.tsx`) i ewentualnie `frontend/ui/src/shadcn/lib/utils.ts`.

- [ ] **Step 7: Przywróć nasze pliki, jeśli CLI je zmieniło**

Run: `rtk git diff --stat -- frontend/ui/src/styles/globals.css frontend/ui/package.json`

Jeśli `globals.css` się zmienił: `rtk git checkout -- frontend/ui/src/styles/globals.css` (motyw definiuje wszystkie tokeny potrzebne tym komponentom).

Jeśli zmienił się `package.json`: przywróć postać z kroku 1. Gdy CLI dodało pakiet spoza tej listy (np. `cn`), zostaw go w `dependencies` z dokładną wersją bez `^`. Potem `rtk pnpm install`.

- [ ] **Step 8: Zatwierdź kod wygenerowany osobnym commitem**

```bash
rtk git add frontend/ui pnpm-lock.yaml
rtk git commit -m "chore(ui): generate shadcn button, input, label, card, alert and badge

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

Osobny commit z samym kodem wygenerowanym pokazuje później w historii, że nikt go ręcznie nie zmieniał.

- [ ] **Step 9a: Utwórz `frontend/ui/src/components/brand-mark.tsx`**

Znak produktu: tarcza w granacie gov.pl z czerwonym pasem i pióropusz czapli spięty szkofią (motyw sarmacki). Źródło: `docs/brand/sarmata-znak.svg` i `docs/brand/sarmata-logo.svg` (decyzja użytkownika: własny znak w barwach gov.pl zamiast godła i znaku KPRM). Inline SVG, żeby nie zależał od ścieżek publicznych i dziedziczył `className`.

```tsx
type BrandMarkProps = {
  className?: string;
};

/** Product mark: gov.pl navy shield with a heron plume held by a jewel (Sarmatian motif). Decorative. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <path
        d="M9 4h46a3 3 0 0 1 3 3v24c0 15.6-11.3 25.3-26 29.4C17.3 56.3 6 46.6 6 31V7a3 3 0 0 1 3-3z"
        fill="#0052a5"
      />
      <path d="M9 4h46a3 3 0 0 1 3 3v4H6V7a3 3 0 0 1 3-3z" fill="#d5233f" />
      <path
        d="M23 46.5C19.6 36.8 22.6 24.4 32.4 17.6 39.6 12.6 48.6 13.2 52.6 19.2 47.4 17.2 41.8 18.6 38 22.6 31.8 29.2 28.8 38.4 23 46.5z"
        fill="#ffffff"
      />
      <path
        d="M23 46.5C24.6 37.4 28.2 28.6 34.4 22.2 39.6 17 46 15.8 52.6 19.2"
        fill="none"
        stroke="#0052a5"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="23" cy="46.5" r="5.4" fill="#eba828" stroke="#ffffff" strokeWidth="1.4" />
      <circle cx="23" cy="46.5" r="3" fill="#d5233f" />
      <circle cx="22" cy="45.4" r="0.9" fill="#ffffff" />
    </svg>
  );
}
```

- [ ] **Step 9: Utwórz `frontend/ui/src/components/app-shell.tsx`**

```tsx
import type { ReactNode } from 'react';
import { BrandMark } from '#components/brand-mark';

type AppShellProps = {
  productName: string;
  productTagline: string;
  /** Right side of the header, e.g. the signed-in account and the sign-out button. */
  account?: ReactNode;
  children: ReactNode;
};

/** Page frame: skip link, header with the product name and the main landmark. */
export function AppShell({ productName, productTagline, account, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2"
      >
        Przejdź do treści
      </a>
      <header className="border-b-4 border-primary bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10 shrink-0" />
            <div>
              <p className="text-lg leading-tight font-bold">{productName}</p>
              <p className="text-sm text-muted-foreground">{productTagline}</p>
            </div>
          </div>
          {account}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 10: Utwórz `frontend/ui/src/components/text-field.tsx`**

```tsx
import type { ComponentProps } from 'react';
import { Input } from '#shadcn/ui/input';
import { Label } from '#shadcn/ui/label';

type TextFieldProps = Omit<ComponentProps<typeof Input>, 'id' | 'aria-describedby' | 'aria-invalid'> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Labelled text input with an optional hint and error message, both linked to the input for
 * screen readers. The error sits above the input (GOV.UK and gov.pl field pattern).
 */
export function TextField({ id, label, hint, error, className, ...inputProps }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-base font-semibold">
        {label}
      </Label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-destructive">
          <span className="sr-only">Błąd: </span>
          {error}
        </p>
      ) : null}
      <Input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={['h-11 text-base', className].filter(Boolean).join(' ')}
        {...inputProps}
      />
    </div>
  );
}
```

- [ ] **Step 11: Utwórz `frontend/ui/src/components/form-alert.tsx`**

```tsx
import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '#shadcn/ui/alert';

type FormAlertProps = {
  title: string;
  children: ReactNode;
};

/** Error message above a form. Always with an icon (gov.pl) and announced by screen readers. */
export function FormAlert({ title, children }: FormAlertProps) {
  return (
    <Alert variant="destructive" className="border-l-4 border-destructive text-base">
      <CircleAlert aria-hidden />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 12: Utwórz `frontend/ui/src/components/submit-button.tsx`**

```tsx
'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { Button } from '#shadcn/ui/button';

type SubmitButtonProps = {
  children: ReactNode;
  /** Label shown while the form is being sent, e.g. "Logowanie…". */
  pendingLabel: string;
  className?: string;
};

/**
 * Primary submit button of a form. While sending it stays focusable and announces the pending
 * label instead of becoming disabled (UX recommendation 11 in FINDINGS).
 */
export function SubmitButton({ children, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const ignoreWhilePending = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) event.preventDefault();
  };

  return (
    <Button
      type="submit"
      aria-disabled={pending}
      onClick={ignoreWhilePending}
      className={['h-11 px-5 text-base', className].filter(Boolean).join(' ')}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

- [ ] **Step 13: Utwórz `frontend/ui/src/index.ts` (jedyny interfejs pakietu)**

```ts
// Generated shadcn components used as they are.
export { Badge } from '#shadcn/ui/badge';
export { Button } from '#shadcn/ui/button';
export { Card, CardContent, CardDescription, CardHeader } from '#shadcn/ui/card';

// Our overlays on top of the generated components.
export { AppShell } from '#components/app-shell';
export { BrandMark } from '#components/brand-mark';
export { FormAlert } from '#components/form-alert';
export { SubmitButton } from '#components/submit-button';
export { TextField } from '#components/text-field';
```

- [ ] **Step 14: Commit**

```bash
rtk git add frontend/ui
rtk git commit -m "feat(ui): app shell, text field, form alert and submit button overlays

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 3: Szkielet `@sarmata/web` i reguły lintu

**Files:**
- Create: `frontend/web/package.json`, `frontend/web/tsconfig.json`, `frontend/web/next.config.mjs`, `frontend/web/postcss.config.mjs`, `frontend/web/src/env.ts`, `frontend/web/src/lib/routes.ts`, `frontend/web/src/lib/product.ts`, `frontend/web/src/types/assets.d.ts`, `frontend/web/src/app/layout.tsx`
- Modify: `eslint.config.mjs`, `.prettierignore`, `.gitignore`, `package.json`

- [ ] **Step 1: Utwórz `frontend/web/package.json`**

```json
{
  "name": "@sarmata/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "next typegen && tsc -p tsconfig.json"
  },
  "dependencies": {
    "@fontsource-variable/open-sans": "5.3.0",
    "@sarmata/services": "workspace:*",
    "@sarmata/ui": "workspace:*",
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "catalog:",
    "lucide-react": "catalog:",
    "next": "16.4.6",
    "react": "catalog:",
    "react-dom": "catalog:",
    "server-only": "0.0.1",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.5",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "tailwindcss": "catalog:",
    "typescript": "catalog:"
  }
}
```

`@supabase/supabase-js` jest zadeklarowane, bo to peer `@supabase/ssr`, a katalog gwarantuje tę samą wersję co w repozytoriach (inaczej typ klienta z `@supabase/ssr` nie pasowałby do `Db`). Kod frontu nadal nie może go importować (reguła ESLint z ADR 0004).

- [ ] **Step 2: Utwórz `frontend/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "allowJs": true,
    "incremental": true,
    "exactOptionalPropertyTypes": false,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"]
}
```

`allowJs` i `incremental` są jawne, bo Next dopisuje je przy pierwszym uruchomieniu, a wtedy plik zmieniałby się poza commitem.

- [ ] **Step 3: Utwórz `frontend/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages export TypeScript sources, Next compiles them with the app.
  transpilePackages: [
    '@sarmata/ui',
    '@sarmata/services',
    '@sarmata/repositories',
    '@sarmata/database',
    '@sarmata/domain',
  ],
  poweredByHeader: false,
};

export default nextConfig;
```

- [ ] **Step 4: Utwórz `frontend/web/postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 5: Utwórz `frontend/web/src/env.ts`**

```ts
import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Public address of the app, for links in auth e-mails (invites, password reset). */
  SITE_URL: z.url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Server configuration, validated on first use and not at import, so `next build` needs no
 * Supabase address and one build serves any Supabase instance (ADR 0003).
 */
export function env(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid environment for @sarmata/web:\n${z.prettifyError(result.error)}\n` +
        'For the local Supabase run "pnpm web:env".',
    );
  }
  cached = result.data;
  return cached;
}
```

- [ ] **Step 6: Utwórz `frontend/web/src/lib/routes.ts` i `frontend/web/src/lib/product.ts`**

`frontend/web/src/lib/routes.ts`:

```ts
/** Paths the proxy, server actions and pages agree on. URLs are user-facing, so they are Polish. */
export const routes = {
  home: '/',
  signIn: '/logowanie',
  noOffice: '/brak-urzedu',
} as const;
```

`frontend/web/src/lib/product.ts`:

```ts
export const product = {
  name: 'Sarmata',
  tagline: 'Oceny okresowe w służbie cywilnej',
} as const;
```

- [ ] **Step 7: Utwórz `frontend/web/src/types/assets.d.ts`**

```ts
// Side-effect imports of stylesheets and fonts. TypeScript 6 checks such imports by default.
declare module '*.css';
declare module '@fontsource-variable/open-sans';
```

- [ ] **Step 8: Utwórz `frontend/web/src/app/layout.tsx`**

```tsx
import '@fontsource-variable/open-sans';
import '@sarmata/ui/globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { product } from '@/lib/product';

export const metadata: Metadata = {
  title: { default: product.name, template: `%s | ${product.name}` },
  description: 'Cyfrowy asystent ocen okresowych w służbie cywilnej',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
```

Open Sans jest dołączany z paczki fontsource (SIL OFL 1.1), bez pobierania z Google w czasie budowania, więc build działa w sieci urzędu bez dostępu do internetu.

- [ ] **Step 8a: Ikona strony ze znaku produktu**

Run: `cp docs/brand/sarmata-znak.svg frontend/web/src/app/icon.svg`

Next.js sam podpina `app/icon.svg` jako ikonę karty przeglądarki.

- [ ] **Step 9: Zainstaluj zależności lintu w korzeniu**

Run: `rtk pnpm add -Dw @next/eslint-plugin-next@16.4.6 eslint-plugin-react-hooks@7.1.1`

`eslint-config-next` i `eslint-plugin-jsx-a11y` odpadają, bo ciągną wtyczki bez wsparcia ESLint 10 (jsx-a11y 6.10.2 ma peer `eslint ^9`). Dostępność sprawdza axe w testach e2e (zadanie 6).

- [ ] **Step 10: Rozszerz `eslint.config.mjs`**

Pod istniejącymi importami dopisz:

```js
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
```

Do listy w `globalIgnores([...])` dopisz:

```js
    'frontend/ui/src/shadcn/**',
    '**/next-env.d.ts',
    'e2e/playwright-report/**',
    'e2e/test-results/**',
```

Bezpośrednio przed ostatnim elementem `prettier,` wstaw dwa bloki:

```js
  {
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    settings: { next: { rootDir: 'frontend/web/' } },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['frontend/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sarmata/*', '@supabase/*', 'next', 'next/*', '**/backend/**'],
              message: '@sarmata/ui is presentation only: no data, auth or Next.js imports.',
            },
          ],
        },
      ],
    },
  },
```

Drugi blok zastępuje dla `frontend/ui/**` regułę z bloku `frontend/**` (w flat config późniejsza konfiguracja reguły nadpisuje wcześniejszą), dlatego jego wzorce obejmują też wszystko, co blok frontu zabrania.

- [ ] **Step 11: Dopisz do `.prettierignore`**

```
frontend/ui/src/shadcn/
**/next-env.d.ts
e2e/playwright-report/
e2e/test-results/
e2e/.screenshots/
```

Prettier nie może formatować kodu wygenerowanego, bo wtedy przestałby być nietknięty.

- [ ] **Step 12: Dopisz na końcu `.gitignore`**

```gitignore

# frontend and e2e
.next/
e2e/test-results/
e2e/playwright-report/
e2e/.screenshots/
```

`frontend/web/.env.local` i `next-env.d.ts` są już ignorowane (`.env*.local`, `next-env.d.ts`).

- [ ] **Step 13: Dodaj skrypt `dev` do korzenia `package.json`**

W `scripts` dopisz:

```json
    "dev": "pnpm --filter @sarmata/web dev",
```

- [ ] **Step 14: Zainstaluj i zatwierdź**

```bash
rtk pnpm install
rtk git add frontend/web eslint.config.mjs .prettierignore .gitignore package.json pnpm-lock.yaml
rtk git commit -m "feat(web): next.js app skeleton with validated env and lint rules

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 4: Logowanie, sesja i chroniony layout

Moduł `src/lib/account.ts` jest jedynym miejscem, które łączy klienta Supabase żądania z serwisem i decyduje o przekierowaniach. Strony wołają `requireMember()` i dostają konto z urzędem albo nie renderują się wcale. Dzięki `cache` z Reacta layout i strona w jednym żądaniu robią jedno wywołanie serwisu.

Wylogowanie używa `scope: 'local'`, więc kończy tylko bieżącą sesję. Domyślny zakres globalny unieważniałby sesje tego samego konta demo w innych kartach i w równoległych testach.

**Files:**
- Create: `frontend/web/src/lib/supabase.ts`, `frontend/web/src/lib/account.ts`, `frontend/web/src/lib/auth-actions.ts`, `frontend/web/src/lib/role-labels.ts`, `frontend/web/src/proxy.ts`, `frontend/web/src/app/logowanie/page.tsx`, `frontend/web/src/app/logowanie/login-form.tsx`, `frontend/web/src/app/(app)/layout.tsx`, `frontend/web/src/app/(app)/page.tsx`, `frontend/web/src/app/brak-urzedu/page.tsx`, `frontend/web/src/components/account-bar.tsx`

- [ ] **Step 1: Utwórz `frontend/web/src/lib/supabase.ts`**

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database, Db } from '@sarmata/services';
import { env } from '@/env';

/**
 * Supabase client acting as the account from the request cookies, for Server Components and
 * server actions. A new client per request (Supabase SSR guide).
 */
export async function createSupabase(): Promise<Db> {
  const cookieStore = await cookies();
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}
```

- [ ] **Step 2: Utwórz `frontend/web/src/lib/account.ts`**

```ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAccount, type CurrentAccount, type MemberAccount } from '@sarmata/services';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

/** The account of this request. React `cache` makes it one service call per request. */
export const currentAccount = cache(
  async (): Promise<CurrentAccount> => getCurrentAccount(await createSupabase()),
);

/**
 * The account with an office and a role. Redirects to the sign-in page when nobody is signed in
 * and to the no-office page when the account has no membership.
 */
export async function requireMember(): Promise<MemberAccount> {
  const account = await currentAccount();
  if (account.status === 'signed-out') redirect(routes.signIn);
  if (account.status === 'no-office') redirect(routes.noOffice);
  return account;
}
```

- [ ] **Step 3: Utwórz `frontend/web/src/lib/auth-actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

export type SignInState = {
  values: { email: string };
  fieldErrors: { email?: string; password?: string };
  formError?: string;
};

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Wpisz adres e-mail.')
    .pipe(z.email('Wpisz adres e-mail w poprawnym formacie, np. jan.kowalski@urzad.gov.pl.')),
  password: z.string().min(1, 'Wpisz hasło.'),
});

/** Signs in with e-mail and password. On success the session cookies are set and the user goes home. */
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const input = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };

  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      values: { email: input.email },
      fieldErrors: { email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] },
    };
  }

  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code !== 'invalid_credentials') console.error('Sign-in failed', error);
    return {
      values: { email: input.email },
      fieldErrors: {},
      formError:
        error.code === 'invalid_credentials'
          ? 'Nieprawidłowy adres e-mail lub hasło. Sprawdź dane i spróbuj ponownie.'
          : 'Nie udało się połączyć z usługą logowania. Spróbuj ponownie za chwilę.',
    };
  }

  redirect(routes.home);
}

/** Ends the session in this browser only, so other sessions of the same account stay valid. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabase();
  await supabase.auth.signOut({ scope: 'local' });
  redirect(routes.signIn);
}
```

- [ ] **Step 4: Utwórz `frontend/web/src/lib/role-labels.ts`**

```ts
import type { OfficeRole } from '@sarmata/services';

/** Role names shown in the UI (docs/funkcjonalnosci.md: oceniający, kadry, admin). */
export const roleLabels: Record<OfficeRole, string> = {
  admin: 'Administrator',
  hr: 'Kadry',
  evaluator: 'Oceniający',
};
```

- [ ] **Step 5: Utwórz `frontend/web/src/proxy.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@sarmata/services';
import { env } from '@/env';
import { routes } from '@/lib/routes';

// Headers that keep CDNs and reverse proxies from caching a response that sets session cookies.
const SESSION_HEADERS = ['cache-control', 'expires', 'pragma'];

/** Refreshes the Supabase session on every request and keeps signed-out visitors on the sign-in page. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env();

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Nothing may run between createServerClient and getClaims, otherwise sessions get lost.
  const { data } = await supabase.auth.getClaims();
  const signedIn = data?.claims != null;
  const onSignInPage = request.nextUrl.pathname === routes.signIn;

  if (!signedIn && !onSignInPage) return redirectKeepingSession(request, routes.signIn, response);
  if (signedIn && onSignInPage) return redirectKeepingSession(request, routes.home, response);
  return response;
}

function redirectKeepingSession(
  request: NextRequest,
  pathname: string,
  session: NextResponse,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  const redirect = NextResponse.redirect(url);
  for (const cookie of session.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of SESSION_HEADERS) {
    const value = session.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|__nextjs|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
```

- [ ] **Step 6: Utwórz `frontend/web/src/app/logowanie/login-form.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { FormAlert, SubmitButton, TextField } from '@sarmata/ui';
import { signIn, type SignInState } from '@/lib/auth-actions';

const initialState: SignInState = { values: { email: '' }, fieldErrors: {} };

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);
  const fieldErrors = Object.entries(state.fieldErrors).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {state.formError ? (
        <FormAlert title="Nie udało się zalogować">{state.formError}</FormAlert>
      ) : null}
      {fieldErrors.length > 0 ? (
        <FormAlert title="Popraw dane w formularzu">
          <ul className="list-disc pl-5">
            {fieldErrors.map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </FormAlert>
      ) : null}
      <TextField
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        label="Adres e-mail"
        defaultValue={state.values.email}
        error={state.fieldErrors.email}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        label="Hasło"
        error={state.fieldErrors.password}
      />
      <SubmitButton pendingLabel="Logowanie…">Zaloguj się</SubmitButton>
    </form>
  );
}
```

`noValidate` wyłącza dymki przeglądarki, więc błędy pokazują się według wzorca GOV.UK: podsumowanie z linkami do pól na górze i komunikat przy polu.

- [ ] **Step 7: Utwórz `frontend/web/src/app/logowanie/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { AppShell, Card, CardContent, CardDescription, CardHeader } from '@sarmata/ui';
import { product } from '@/lib/product';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Logowanie' };

export default function SignInPage() {
  return (
    <AppShell productName={product.name} productTagline={product.tagline}>
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Zaloguj się</h1>
            <CardDescription className="text-base">
              Użyj adresu e-mail i hasła konta w aplikacji urzędu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 8: Utwórz `frontend/web/src/components/account-bar.tsx`**

```tsx
import { LogOut } from 'lucide-react';
import { Badge, Button } from '@sarmata/ui';
import type { MemberAccount } from '@sarmata/services';
import { signOut } from '@/lib/auth-actions';
import { roleLabels } from '@/lib/role-labels';

/** Office, account and role from the JWT claims, with the sign-out button. */
export function AccountBar({ account }: { account: MemberAccount }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="text-sm">
        <p className="font-semibold">{account.office.name}</p>
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span>{account.email}</span>
          <Badge variant="secondary">
            <span className="sr-only">Rola: </span>
            {roleLabels[account.role]}
          </Badge>
        </p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 text-base">
          <LogOut aria-hidden />
          Wyloguj się
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 9: Utwórz `frontend/web/src/app/(app)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { AppShell } from '@sarmata/ui';
import { AccountBar } from '@/components/account-bar';
import { requireMember } from '@/lib/account';
import { product } from '@/lib/product';

/** Layout of every signed-in screen. Domain screens of the functional thread go into this group. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const account = await requireMember();

  return (
    <AppShell
      productName={product.name}
      productTagline={product.tagline}
      account={<AccountBar account={account} />}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 10: Utwórz `frontend/web/src/app/(app)/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { requireMember } from '@/lib/account';
import { roleLabels } from '@/lib/role-labels';

export const metadata: Metadata = { title: 'Start' };

export default async function HomePage() {
  const account = await requireMember();

  return (
    <section aria-labelledby="start-heading">
      <h1 id="start-heading" className="text-3xl font-bold">
        Start
      </h1>
      <p className="mt-4 max-w-prose">
        Pracujesz w urzędzie {account.office.name} z rolą {roleLabels[account.role]}. Tu pojawią
        się Twoje oceny okresowe i terminy.
      </p>
    </section>
  );
}
```

- [ ] **Step 11: Utwórz `frontend/web/src/app/brak-urzedu/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell, Button } from '@sarmata/ui';
import { currentAccount } from '@/lib/account';
import { signOut } from '@/lib/auth-actions';
import { product } from '@/lib/product';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Brak urzędu' };

export default async function NoOfficePage() {
  const account = await currentAccount();
  if (account.status === 'signed-out') redirect(routes.signIn);
  if (account.status === 'member') redirect(routes.home);

  return (
    <AppShell productName={product.name} productTagline={product.tagline}>
      <h1 className="text-3xl font-bold">Konto bez przypisanego urzędu</h1>
      <p className="mt-4 max-w-prose">
        Konto {account.email} nie ma jeszcze urzędu ani roli. Poproś administratora urzędu o nadanie
        dostępu, a potem zaloguj się ponownie.
      </p>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="outline" className="h-11 text-base">
          Wyloguj się
        </Button>
      </form>
    </AppShell>
  );
}
```

- [ ] **Step 12: Commit**

```bash
rtk git add frontend/web
rtk git commit -m "feat(web): supabase sign-in, session refresh proxy and protected layout

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 5: Port taska, skrypt run dla Termic i środowisko aplikacji

Port liczy jedna funkcja w `scripts/task-port.mjs`. Woła ją skrypt run i konfiguracja Playwright, więc testy i skill trafiają na ten sam serwer, który Termic uruchomił dla taska. Next.js 16 nie pozwala na dwa `next dev` w jednym katalogu, więc wspólny port jest warunkiem, a nie wygodą.

Instancja Supabase jest wspólna dla wszystkich worktree, więc jej `site_url` nie może zależeć od taska. Plan 2 dopuścił już przekierowania na `http://localhost:*/**`. Skrypt run ustawia więc `SITE_URL` aplikacji, a nie Supabase.

**Files:**
- Create: `scripts/task-port.mjs`, `scripts/termic-run.sh`, `scripts/web-env.mjs`
- Modify: `scripts/termic-setup.sh`, `package.json`, `README.md`

- [ ] **Step 1: Utwórz `scripts/task-port.mjs`**

```js
// Port of the Next.js dev server for this worktree: 3000 outside Termic, otherwise derived from
// the task name so parallel tasks do not collide. Used by scripts/termic-run.sh and
// e2e/playwright.config.ts, so the app, the e2e tests and the walkthrough skill agree.

/**
 * @param {string | undefined} task Termic task name, defaults to $TERMIC_TASK.
 * @returns {number}
 */
export function taskPort(task = process.env.TERMIC_TASK) {
  if (!task) return 3000;
  let hash = 0;
  for (const char of task) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return 3001 + (hash % 999);
}

if (import.meta.main) console.log(taskPort());
```

- [ ] **Step 2: Utwórz `scripts/web-env.mjs`**

```js
// Writes frontend/web/.env.local with the address and publishable key of the shared local
// Supabase instance "sarmata" (plan 2). Run after `pnpm db:start`.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const status = JSON.parse(
  execFileSync('supabase', ['status', '-o', 'json'], {
    cwd: `${root}/database`,
    encoding: 'utf8',
  }),
);
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

if (!status.API_URL || !key) {
  throw new Error('supabase status returned no API_URL or key. Is the stack running (pnpm db:start)?');
}

writeFileSync(
  `${root}/frontend/web/.env.local`,
  [
    '# Generated by `pnpm web:env` from `supabase status`. Not committed.',
    `SUPABASE_URL=${status.API_URL}`,
    `SUPABASE_PUBLISHABLE_KEY=${key}`,
    '',
  ].join('\n'),
);
console.log('Wrote frontend/web/.env.local');
```

- [ ] **Step 3: Utwórz `scripts/termic-run.sh`**

```bash
#!/usr/bin/env bash
# Run script for a termic task: Next.js dev server on a port derived from the task name.
set -euo pipefail
cd "$(dirname "$0")/.."

port="$(node scripts/task-port.mjs)"
export PORT="$port"
export SITE_URL="http://localhost:$port"

if [ ! -f frontend/web/.env.local ]; then
  pnpm web:env
fi

echo "sarmata: $SITE_URL"
exec pnpm dev
```

Run: `chmod +x scripts/termic-run.sh`

`next dev` czyta port ze zmiennej `PORT`, a zmienne procesu mają pierwszeństwo przed `.env.local`.

- [ ] **Step 4: Dodaj skrypt `web:env` do korzenia `package.json`**

W `scripts` dopisz:

```json
    "web:env": "node scripts/web-env.mjs",
```

- [ ] **Step 5: Zastąp `scripts/termic-setup.sh`**

```bash
#!/usr/bin/env bash
# Setup for a new termic task: dependencies, team secrets, Supabase and the web app env.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

pnpm secrets:decrypt

# Shared Supabase instance "sarmata" for all worktrees (ADR 0002), then the web app env from it.
if docker info >/dev/null 2>&1; then
  (cd database && { supabase status >/dev/null 2>&1 || supabase start; })
  pnpm web:env
else
  echo "Docker is not running, skipping Supabase start and frontend/web/.env.local"
fi

# Browser for the e2e tests and the app-walkthrough skill. Shared cache, fast after the first run.
pnpm --filter @sarmata/e2e exec playwright install chromium
```

Pakiet `@sarmata/e2e` powstaje w zadaniu 6, a skrypt setup działa dopiero w nowym tasku, więc kolejność jest bezpieczna.

- [ ] **Step 6: Zaktualizuj `README.md`**

Przed sekcją „## Termic” dopisz:

```markdown
## Aplikacja web

| Skrypt | Co robi |
|---|---|
| `pnpm web:env` | zapisuje `frontend/web/.env.local` z adresem i kluczem publicznym lokalnego Supabase |
| `pnpm dev` | Next.js w trybie deweloperskim (port ze zmiennej `PORT`, domyślnie 3000) |
| `pnpm e2e` | testy Playwright: logowanie i wylogowanie każdym kontem demo, dostępność (axe, WCAG 2.1 AA) |
| `pnpm e2e:ui` | te same testy w trybie UI Playwright |
| `pnpm e2e:walk` | zrzuty ekranów dla wybranych kont i ścieżek (`WALK_ACCOUNTS`, `WALK_PATHS`), opis w `.claude/skills/app-walkthrough/SKILL.md` |

Przeglądarkę do testów instaluje skrypt setup (`pnpm --filter @sarmata/e2e exec playwright install chromium`). Font Open Sans jest na licencji SIL Open Font License 1.1.
```

Sekcję „## Termic” zastąp:

```markdown
## Termic

W ustawieniach projektu w Termic ustaw:

- skrypt setup: `./scripts/termic-setup.sh`
- skrypt run: `./scripts/termic-run.sh`

Skrypt run uruchamia `pnpm dev` na porcie wyliczonym z nazwy taska (`$TERMIC_TASK`, zakres 3001 do 3999, poza Termic port 3000) i ustawia `SITE_URL` aplikacji na ten sam adres. Port bieżącego taska pokazuje `node scripts/task-port.mjs`.
```

- [ ] **Step 7: Commit**

```bash
rtk git add scripts/task-port.mjs scripts/termic-run.sh scripts/web-env.mjs scripts/termic-setup.sh package.json README.md
rtk git commit -m "chore: termic run script on a per-task port and web env from supabase status

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 6: Pakiet `@sarmata/e2e` z Playwright

Projekt `chromium` to testy. Projekt `walk` to przejście po aplikacji ze zrzutami dla skilla z zadania 8. Oba korzystają z tych samych pomocników logowania, więc ścieżkę klikamy w kodzie raz.

**Files:**
- Create: `e2e/package.json`, `e2e/tsconfig.json`, `e2e/playwright.config.ts`, `e2e/src/demo-accounts.ts`, `e2e/src/session.ts`, `e2e/tests/auth.spec.ts`, `e2e/tests/a11y.spec.ts`, `e2e/walk/walk.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Utwórz `e2e/package.json`**

```json
{
  "name": "@sarmata/e2e",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "e2e": "playwright test --project=chromium",
    "e2e:ui": "playwright test --ui",
    "walk": "playwright test --project=walk",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.14.0",
    "@playwright/test": "1.65.1",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

Pakiet nie ma `exports`, bo nic go nie importuje. Nie ma też skryptu `test`, więc `turbo run test` w `pnpm check` go pomija, a typecheck nadal obejmuje.

- [ ] **Step 2: Utwórz `e2e/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM"],
    "allowJs": true
  },
  "include": ["playwright.config.ts", "src", "tests", "walk"]
}
```

`allowJs` pozwala zaimportować `scripts/task-port.mjs` z typami wyprowadzonymi z JSDoc.

- [ ] **Step 3: Utwórz `e2e/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { taskPort } from '../scripts/task-port.mjs';

const ci = Boolean(process.env.CI);
const port = taskPort();
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  outputDir: 'test-results',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'pl-PL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testDir: './tests', use: { ...devices['Desktop Chrome'] } },
    { name: 'walk', testDir: './walk', use: { ...devices['Desktop Chrome'] } },
  ],
  // Locally: reuse the server of this task (termic run) or start it the same way.
  // CI: the production build started by `next start`.
  webServer: {
    command: ci ? 'pnpm --filter @sarmata/web start' : 'bash scripts/termic-run.sh',
    cwd: '..',
    url: `${baseURL}/logowanie`,
    reuseExistingServer: !ci,
    timeout: 180_000,
    env: { PORT: String(port) },
  },
});
```

- [ ] **Step 4: Utwórz `e2e/src/demo-accounts.ts`**

```ts
// Demo data from database/supabase/seed.sql (plan 2). Keep both in sync.
export const DEMO_PASSWORD = 'Haslo-Demo-2026';
export const DEMO_OFFICE_NAME = 'Urząd Ministerstwa Testowego w Kropce Wielkopolskiej';

export const demoAccounts = [
  { role: 'admin', email: 'admin@kropka.test', roleLabel: 'Administrator' },
  { role: 'hr', email: 'kadry@kropka.test', roleLabel: 'Kadry' },
  { role: 'evaluator', email: 'oceniajacy@kropka.test', roleLabel: 'Oceniający' },
] as const;

export type DemoAccount = (typeof demoAccounts)[number];

export function demoAccount(role: string): DemoAccount {
  const account = demoAccounts.find((candidate) => candidate.role === role);
  if (!account) {
    const known = demoAccounts.map((candidate) => candidate.role).join(', ');
    throw new Error(`Unknown demo account role "${role}". Use one of: ${known}`);
  }
  return account;
}
```

- [ ] **Step 5: Utwórz `e2e/src/session.ts`**

```ts
import { expect, type Page } from '@playwright/test';
import { DEMO_PASSWORD, type DemoAccount } from './demo-accounts';

export async function signIn(page: Page, account: DemoAccount): Promise<void> {
  await page.goto('/logowanie');
  await page.getByLabel('Adres e-mail').fill(account.email);
  await page.getByLabel('Hasło', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page.getByRole('button', { name: 'Wyloguj się' })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeVisible();
}
```

- [ ] **Step 6: Utwórz `e2e/tests/auth.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { DEMO_OFFICE_NAME, demoAccounts } from '../src/demo-accounts';
import { signIn, signOut } from '../src/session';

test('redirects a signed-out visitor to the sign-in page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Zaloguj się' })).toBeVisible();
});

for (const account of demoAccounts) {
  test(`signs in and out as ${account.email}`, async ({ page }) => {
    await signIn(page, account);
    await expect(page).toHaveURL(/\/$/);

    const header = page.getByRole('banner');
    await expect(header).toContainText(DEMO_OFFICE_NAME);
    await expect(header).toContainText(account.email);
    await expect(header).toContainText(account.roleLabel);

    await signOut(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/logowanie$/);
  });
}

test('rejects a wrong password with a message', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByLabel('Adres e-mail').fill('kadry@kropka.test');
  await page.getByLabel('Hasło', { exact: true }).fill('zle-haslo');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Nie udało się zalogować' });
  await expect(alert).toContainText('Nieprawidłowy adres e-mail lub hasło');
  await expect(page).toHaveURL(/\/logowanie$/);
  await expect(page.getByLabel('Adres e-mail')).toHaveValue('kadry@kropka.test');
});

test('lists field errors for an empty form', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  const summary = page.getByRole('alert').filter({ hasText: 'Popraw dane w formularzu' });
  await expect(summary).toContainText('Wpisz adres e-mail.');
  await expect(summary).toContainText('Wpisz hasło.');
  await expect(page.getByLabel('Adres e-mail')).toHaveAttribute('aria-invalid', 'true');
});
```

Filtr po tekście przy `getByRole('alert')` jest potrzebny, bo Next.js ma własny element z tą rolą (ogłaszanie zmiany trasy).

- [ ] **Step 7: Utwórz `e2e/tests/a11y.spec.ts`**

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

// WCAG 2.1 AA: the legal minimum (docs/sources/ux-standardy/FINDINGS.md, section 1).
const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  expect(results.violations).toEqual([]);
}

test('sign-in page meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/logowanie');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expectNoViolations(page);
});

test('sign-in page with errors meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/logowanie');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page.getByText('Popraw dane w formularzu')).toBeVisible();
  await expectNoViolations(page);
});

test('signed-in shell meets WCAG 2.1 AA', async ({ page }) => {
  await signIn(page, demoAccount('hr'));
  await expectNoViolations(page);
});
```

- [ ] **Step 8: Utwórz `e2e/walk/walk.spec.ts`**

```ts
// Walkthrough for agents (.claude/skills/app-walkthrough/SKILL.md): signs in as each requested demo
// account, opens each path and saves full-page screenshots. Driven by environment variables:
//   WALK_ACCOUNTS  comma-separated roles: admin, hr, evaluator (default: all)
//   WALK_PATHS     comma-separated paths (default: /)
//   WALK_OUT       output directory (default: e2e/.screenshots)
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { demoAccount, demoAccounts, type DemoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

const outDir = process.env.WALK_OUT ?? path.join(import.meta.dirname, '..', '.screenshots');
const accounts: DemoAccount[] = process.env.WALK_ACCOUNTS
  ? process.env.WALK_ACCOUNTS.split(',').map((role) => demoAccount(role.trim()))
  : [...demoAccounts];
const paths = process.env.WALK_PATHS
  ? process.env.WALK_PATHS.split(',').map((route) => route.trim())
  : ['/'];

function screenshotName(route: string): string {
  const slug = route.replace(/^\/+|\/+$/g, '').replace(/[^\p{L}\p{N}]+/gu, '-');
  return `${slug || 'start'}.png`;
}

test('sign-in page', async ({ page }) => {
  await page.goto('/logowanie');
  const file = path.join(outDir, 'logowanie.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[walk] /logowanie -> ${file}`);
});

for (const account of accounts) {
  test(`as ${account.role}`, async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));

    await signIn(page, account);
    for (const route of paths) {
      const response = await page.goto(route);
      await page.waitForLoadState('networkidle');
      const file = path.join(outDir, account.role, screenshotName(route));
      await page.screenshot({ path: file, fullPage: true });
      console.log(`[walk] ${account.role} ${route} -> ${file} (HTTP ${response?.status() ?? '?'})`);
    }

    for (const problem of problems) console.log(`[walk] ${account.role} ${problem}`);
    expect(problems, 'browser errors during the walk').toEqual([]);
  });
}
```

- [ ] **Step 9: Dodaj skrypty do korzenia `package.json`**

W `scripts` dopisz:

```json
    "e2e": "pnpm --filter @sarmata/e2e e2e",
    "e2e:ui": "pnpm --filter @sarmata/e2e e2e:ui",
    "e2e:walk": "pnpm --filter @sarmata/e2e walk",
```

- [ ] **Step 10: Zainstaluj, pobierz przeglądarkę i zatwierdź**

```bash
rtk pnpm install
rtk pnpm --filter @sarmata/e2e exec playwright install chromium
rtk git add e2e package.json pnpm-lock.yaml
rtk git commit -m "test(e2e): playwright sign-in, sign-out, axe checks and walkthrough project

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 7: Job `e2e` w CI

Job działa na main i ręcznie (`workflow_dispatch` dodał plan 2), tak jak `baza`. PR-y zostają szybkie (`docs/architektura.md`, narzędzia). Supabase startuje bez usług, których front nie używa.

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Dodaj job na końcu sekcji `jobs:`**

```yaml
  e2e:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      NEXT_TELEMETRY_DISABLED: '1'
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: supabase/setup-cli@v3
        with:
          version: 3.2.0
      - name: Supabase (db, auth, rest)
        working-directory: database
        run: supabase start -x realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
      - run: pnpm web:env
      - run: pnpm --filter @sarmata/e2e exec playwright install --with-deps chromium
      - run: pnpm --filter @sarmata/web build
      - run: pnpm e2e
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: playwright-report
          path: e2e/playwright-report
          retention-days: 7
```

Playwright sam uruchamia `next start` (konfiguracja z zadania 6 przy `CI=true`), a seed z kontami demo wgrywa `supabase start`.

- [ ] **Step 2: Commit**

```bash
rtk git add .github/workflows/ci.yml
rtk git commit -m "ci: e2e job with local supabase on main and manual runs

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 8: Skill do przeklikiwania aplikacji

Spec prosi o skill poprawiany iteracyjnie. Skill wskazuje gotowe skrypty zamiast opisywać kliknięcia, a sekcja „Common mistakes” jest miejscem na poprawki po każdym potknięciu. Format według `.claude/skills/writing-skills/SKILL.md`: opis zaczyna się od „Use when” i mówi tylko, kiedy go użyć, treść poniżej 500 słów. Pozostałe skille w `.claude/skills/` są po angielsku, więc ten też.

**Files:**
- Create: `.claude/skills/app-walkthrough/SKILL.md`

- [ ] **Step 1: Utwórz `.claude/skills/app-walkthrough/SKILL.md`**

````markdown
---
name: app-walkthrough
description: Use when you need to see the sarmata web app working in a real browser, such as checking a UI change before calling it done, reproducing a UI bug, signing in as a demo account (admin, kadry, oceniający) or taking screenshots for review.
---

# App walkthrough

## Overview

Repeatable clicks live in code (`e2e/src`, `e2e/walk`), not in your head. Run the walk, read the screenshots, and turn any path you click twice into a helper or a test.

## Before you start

| Check | Command | Fix |
|---|---|---|
| Supabase runs | `pnpm db:status` | `pnpm db:start` |
| App env exists | `test -f frontend/web/.env.local` | `pnpm web:env` |
| Browser installed | `pnpm --filter @sarmata/e2e exec playwright install chromium` | same command |

## Start the app

- Port of this task: `node scripts/task-port.mjs` (3000 outside Termic). URL: `http://localhost:<port>`.
- In Termic start the task's run script with the termic `task_run` tool. Elsewhere run `bash scripts/termic-run.sh` in the background.
- Ready when `curl -s -o /dev/null -w '%{http_code}' http://localhost:<port>/logowanie` prints `200`.
- You may skip this: `pnpm e2e` and `pnpm e2e:walk` reuse the running server or start it themselves.

## Demo accounts

Password for all: `Haslo-Demo-2026`. Office: Urząd Ministerstwa Testowego w Kropce Wielkopolskiej.

| Role (`WALK_ACCOUNTS`) | E-mail | Label in the UI |
|---|---|---|
| `admin` | `admin@kropka.test` | Administrator |
| `hr` | `kadry@kropka.test` | Kadry |
| `evaluator` | `oceniajacy@kropka.test` | Oceniający |

## Screenshots

```bash
WALK_ACCOUNTS=hr,evaluator WALK_PATHS=/ pnpm e2e:walk
```

- Output: `e2e/.screenshots/logowanie.png` and `e2e/.screenshots/<role>/<path-slug>.png` (`/` is `start.png`). Open them with the Read tool.
- The run fails on browser console errors and prints them with a `[walk]` prefix.
- New screen: add its path to `WALK_PATHS`. Needs a form filled first? Add a helper to `e2e/src/` and call it from `e2e/walk/walk.spec.ts`.

## Interactive exploration

When the Playwright MCP tools are available, use `browser_navigate` to `http://localhost:<port>/logowanie`, sign in with the table above and use `browser_snapshot` to read the page. Once a path works, move it into `e2e/src` so the next agent does not click it again.

## Tests

- `pnpm e2e`: sign-in and sign-out for every demo account, axe WCAG 2.1 AA checks.
- `pnpm e2e:ui`: the same in Playwright UI mode.
- A flow you verified by hand belongs in `e2e/tests/` as a spec that uses the helpers from `e2e/src/session.ts`.

## Common mistakes

| Symptom | Cause and fix |
|---|---|
| Second `next dev` fails with a lock error | Next.js 16 allows one dev server per directory. Use the running one on the task port. |
| Redirect loop or signed out right away | Mixed `localhost` and `127.0.0.1`. Always use `http://localhost:<port>`. |
| `Invalid environment for @sarmata/web` | Run `pnpm web:env` after Supabase started. |
| Sign-in returns 429 | Supabase limits sign-ins per IP (30 per 5 minutes). Wait or sign in less often. |
| Data from an earlier run on screenshots | `pnpm db:reset` restores the demo seed. |

## Keep this skill honest

When a step here fails, misleads you or you find a faster path, fix this file in the same change and add the lesson to "Common mistakes".
````

- [ ] **Step 2: Commit**

```bash
rtk git add .claude/skills/app-walkthrough/SKILL.md
rtk git commit -m "docs: app-walkthrough skill for clicking through the web app

Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

## Walidacja końcowa (raz, po wszystkich zadaniach)

1. `rtk pnpm install --frozen-lockfile`: bez zmian w lockfile i bez `ERR_PNPM_IGNORED_BUILDS`.
2. `rtk proxy grep -n -E '"\^|"~' frontend/ui/package.json frontend/web/package.json e2e/package.json backend/services/package.json backend/repositories/package.json`: brak wyników (wszystkie wersje dokładne albo `catalog:` i `workspace:*`).
3. `rtk pnpm check`: PASS (ESLint, Prettier, typecheck wszystkich pakietów, w tym `next typegen && tsc` dla web).
4. `rtk pnpm db:status && rtk pnpm web:env && rtk pnpm --filter @sarmata/web build`: build PASS, na liście tras są `/`, `/logowanie` i `/brak-urzedu`, a obok nich wpis proxy.
5. `rtk pnpm e2e`: 9 testów PASS (6 w `auth.spec.ts`, 3 w `a11y.spec.ts`).
6. `WALK_ACCOUNTS=hr rtk pnpm e2e:walk && ls e2e/.screenshots e2e/.screenshots/hr`: 2 testy PASS, pliki `logowanie.png` i `hr/start.png`. Obejrzyj oba narzędziem Read: nagłówek z nazwą urzędu, adresem `kadry@kropka.test`, etykietą „Kadry” i przyciskiem „Wyloguj się”, kolory gov.pl, font Open Sans.
7. Skrypt run na porcie taska:

```bash
port=$(TERMIC_TASK=walidacja-planu-4 node scripts/task-port.mjs) && echo "$port"
(TERMIC_TASK=walidacja-planu-4 bash scripts/termic-run.sh > /tmp/sarmata-run.log 2>&1 &)
sleep 20
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:$port/logowanie"
lsof -ti "tcp:$port" -sTCP:LISTEN | xargs kill
head -3 /tmp/sarmata-run.log
```

Expected: ten sam port w zakresie 3001 do 3999 przy każdym wywołaniu, kod `200`, w logu linia `sarmata: http://localhost:<port>`.

8. Granice warstw: utwórz `frontend/web/src/boundary-check.ts` z treścią `import { findOfficeName } from '@sarmata/repositories'; export const x = findOfficeName;` oraz `frontend/ui/src/boundary-check.ts` z treścią `import { redirect } from 'next/navigation'; export const y = redirect;`. Run: `rtk proxy pnpm exec eslint frontend/web/src/boundary-check.ts frontend/ui/src/boundary-check.ts`. Expected: dwa błędy `no-restricted-imports` z komunikatami „The frontend uses only @sarmata/services (ADR 0004).” i „@sarmata/ui is presentation only: no data, auth or Next.js imports.”. Usuń oba pliki.
9. Kod wygenerowany nietknięty: `rtk git log --format=%s -- frontend/ui/src/shadcn` pokazuje tylko commit „chore(ui): generate shadcn button, input, label, card, alert and badge”.
10. `rtk git status`: czyste drzewo (Next nie dopisał nic do `tsconfig.json`, a jeśli dopisał, patrz „Kontekst dla wykonawcy”).

## Po wykonaniu

- Poproś użytkownika o wpisanie `./scripts/termic-run.sh` jako skryptu run projektu sarmata w ustawieniach Termic (nie edytuj plików Termic ręcznie).
- Job `e2e` w GitHub Actions sprawdzi się po pushu na main albo ręcznym uruchomieniu. Push tylko na wyraźne polecenie użytkownika.
- Ekrany domenowe dochodzą w grupie `frontend/web/src/app/(app)/` według ustaleń wątku funkcjonalnego, a każdy nowy ekran dostaje ścieżkę w `WALK_PATHS` i test w `e2e/tests/`.

## Przegląd codebase-design

Plan przejrzany pod kątem głębokości modułów, szwów i testowania przez interfejs.

**Zmiany wprowadzone po przeglądzie:**
- `getCurrentAccount` nie jest przelotką do repozytorium: interpretuje kontrakt claimów hooka (walidacja zodem, trzy stany konta, błąd przy niespójnej instalacji). Repozytoria zostały cienkim adapterem Supabase, bo to jedyne miejsce zapytań (ADR 0004).
- Moduł `frontend/web/src/lib/account.ts` ukrywa klienta Supabase żądania, serwis, `cache` Reacta i przekierowania za dwiema funkcjami (`currentAccount`, `requireMember`). Strony nie znają Supabase ani ciasteczek.
- Ścieżki aplikacji żyją w jednym `routes.ts`, wspólnym dla proxy, akcji i stron.
- Port taska liczy jedna funkcja (`scripts/task-port.mjs`) wołana przez skrypt run i Playwright, zamiast dwóch implementacji hasza w bashu i TS.
- Logowanie w testach i w przejściu ze zrzutami korzysta z tych samych pomocników `e2e/src/session.ts`, więc zmiana formularza logowania to jedna poprawka.
- Nakładki UI nie importują `cn`, tylko przekazują `className` do komponentu wygenerowanego. Dzięki temu nie zależą od tego, czy CLI wygeneruje lokalny util, czy użyje pakietu `cn`.
- Aliasy CLI shadcn wskazują jeden katalog `src/shadcn/`, więc granica między kodem wygenerowanym a naszym to jeden katalog, wykluczony z ESLint i Prettier jednym wpisem.
- `@sarmata/ui` ma regułę ESLint zabraniającą importu danych, auth i Next.js, więc pozostaje modułem czysto prezentacyjnym.

**Odrzucone pomysły:**
- Port i adapter dla auth w serwisach (fałszywy klient Supabase w testach): jest tylko jeden prawdziwy adapter, a lokalne Supabase to zamiennik kategorii „local-substitutable”. Serwis sprawdzają testy e2e na prawdziwej bazie.
- Testy Vitest dla `getCurrentAccount`: wymagają działającego Supabase, którego job `check` nie ma. Ścieżkę pokrywa job `e2e` (logowanie trzema rolami, nazwa urzędu i rola w nagłówku). Testy serwisów na bazie to temat planu 3.
- Klient Supabase w przeglądarce: niepotrzebny, logowanie przez server action działa też bez JavaScriptu.
- Tryb ciemny: opcjonalny w zakresie, a kontrasty palety gov.pl są policzone tylko dla jasnego tła.
- Menu konta w dropdownie: na razie trzy informacje i jeden przycisk mieszczą się w nagłówku.
- `eslint-config-next` i `eslint-plugin-jsx-a11y`: brak wsparcia ESLint 10. Dostępność pilnuje axe w e2e.
- `output: 'standalone'` w Next: sposób pakowania obrazu wybiera plan 6.
- Godło albo znak służby cywilnej w nagłówku: używanie godła reguluje ustawa, a FINDINGS odradza elementy portalu gov.pl. Po decyzji użytkownika nagłówek ma własny znak produktu `BrandMark` (tarcza gov.pl z pióropuszem czapli, `docs/brand/`), a ikona strony to ten sam znak.
- Parametr `next` (powrót po logowaniu na pierwotną stronę): YAGNI, dopóki nie ma ekranów domenowych.
