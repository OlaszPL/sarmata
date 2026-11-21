# Fundament 1: monorepo i narzędzia. Plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** monorepo pnpm z Turborepo, w którym działają `pnpm check`, haki git, CI, SOPS i skrypt setup dla termic, sprawdzone na pierwszym prawdziwym kawałku domeny (`addMonths`).

**Architektura:** układ katalogów z ADR 0002 (`frontend/`, `backend/`, `database/`, `infra/`, `e2e/`). Konfiguracje wspólne (TS, ESLint, Prettier) leżą w korzeniu. Pakiety wewnętrzne eksportują źródła TS bez builda. Wersje zależności wspólnych trzyma katalog pnpm (`catalog:`).

**Stack:** Node 24, pnpm 12.21.0, Turborepo 2.11, TypeScript 6.0.3, Vitest 5.1, ESLint 10 z typescript-eslint 8.73, Prettier 3.10, Husky 9, lint-staged 17, SOPS 3.13 z age, GitHub Actions.

**Kontekst dla wykonawcy:**
- Decyzje: `docs/architektura.md`, `docs/adr/0002-uklad-repo-i-runtime.md`. Zasady pisania tekstów: `AGENTS.md` (bez półpauz i myślników, bez średników w prozie).
- **TypeScript 6.0.3, nie 7.** typescript-eslint 8.73 wymaga `typescript >=4.8.4 <6.1.0` (sprawdzone 21.11.2026). Nie podbijaj do 7 bez sprawdzenia tej zależności.
- Polecenia powłoki poprzedzaj `rtk` zgodnie z `AGENTS.md`. Tam, gdzie liczy się dokładny wynik, użyj `rtk proxy`.
- Plan nie dotyka Supabase, Next.js, AI ani instalatora. To plany 2 do 6.

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `package.json` | skrypty korzenia, zależności narzędzi, `packageManager`, `engines` |
| `pnpm-workspace.yaml` | lista workspace'ów i katalog wersji |
| `.nvmrc` | wersja Node dla nvm i CI |
| `tsconfig.base.json` | wspólne opcje kompilatora |
| `turbo.json` | zadania `build`, `typecheck`, `test` z cache |
| `eslint.config.mjs` | lint TS i granica warstw z ADR 0004 |
| `prettier.config.mjs`, `.prettierignore` | formatowanie, bez `docs/` |
| `lint-staged.config.mjs`, `.husky/pre-commit`, `.husky/pre-push` | haki git |
| `.sops.yaml`, `secrets/dev.enc.env`, `scripts/secrets-decrypt.sh` | sekrety zespołu |
| `.github/workflows/ci.yml` | CI na PR i main |
| `scripts/termic-setup.sh` | setup nowego taska termic |
| `backend/domain/**` | pierwszy pakiet: `addMonths` z testami |
| `README.md` | jak zacząć |

---

### Task 1: Korzeń monorepo

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Utwórz `.nvmrc`**

```
24
```

- [ ] **Step 2: Utwórz `pnpm-workspace.yaml`**

```yaml
packages:
  - frontend/*
  - backend/*
  - database
  - infra/*
  - e2e

catalog:
  typescript: 6.0.3
  vitest: 5.1.1
  '@types/node': 24.19.2
```

- [ ] **Step 3: Utwórz `package.json`**

```json
{
  "name": "sarmata",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.21.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  }
}
```

- [ ] **Step 4: Utwórz `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  }
}
```

`types: ["node"]` jest jawne, bo TypeScript 6 domyślnie nie dołącza już wszystkich `@types`.

- [ ] **Step 5: Dopisz na końcu `.gitignore`**

```gitignore

# sarmata
.env.local
secrets/*.env
!secrets/*.enc.env
```

- [ ] **Step 6: Zainstaluj i sprawdź**

Run: `rtk pnpm install`
Expected: kończy się bez błędu i tworzy `pnpm-lock.yaml`. Ostrzeżenie o braku workspace'ów pasujących do wzorców jest w porządku.

- [ ] **Step 7: Commit**

```bash
rtk git add package.json pnpm-workspace.yaml pnpm-lock.yaml .nvmrc tsconfig.base.json .gitignore
rtk git commit -m "chore: monorepo root with pnpm workspace and base tsconfig"
```

---

### Task 2: Pakiet `@sarmata/domain`: `CalendarDate` i `addMonths` (TDD)

Pierwszy prawdziwy kod domeny. Termin w miesiącach według art. 112 Kc i zasad KPRM (`docs/zasoby-kprm/6. Materiały dodatkowe/liczenie terminów.docx`): kończy się w dniu miesiąca odpowiadającym dniowi początkowemu, a gdy takiego dnia nie ma, w ostatnim dniu miesiąca. Przesunięcie z dni wolnych to plan 3.

Projekt modułu: data bez czasu i strefy to typ `CalendarDate` (string z marką). Tworzy go tylko `calendarDate(iso)`, który waliduje format i istnienie dnia, więc każda funkcja terminów dostaje już poprawną datę i nie powtarza walidacji. Pakiet eksportuje tylko `index.ts`. Pomocnicze `toParts` i `fromParts` są wewnętrzne, a testy przechodzą przez interfejs publiczny.

**Files:**
- Create: `backend/domain/package.json`, `backend/domain/tsconfig.json`, `backend/domain/src/index.ts`, `backend/domain/src/deadlines/calendar-date.ts`, `backend/domain/src/deadlines/add-months.ts`
- Test: `backend/domain/src/deadlines/calendar-date.test.ts`, `backend/domain/src/deadlines/add-months.test.ts`

- [ ] **Step 1: Utwórz `backend/domain/package.json`**

```json
{
  "name": "@sarmata/domain",
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
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Utwórz `backend/domain/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Napisz testy przez interfejs publiczny**

`backend/domain/src/deadlines/calendar-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calendarDate } from '../index';

describe('calendarDate', () => {
  it('przyjmuje istniejącą datę RRRR-MM-DD', () => {
    expect(calendarDate('2024-02-29')).toBe('2024-02-29');
  });

  it.each(['2024-02-30', '2023-02-29', '2024-13-01', '16.03.2024', '2024-3-16'])(
    'odrzuca %s',
    (zla) => {
      expect(() => calendarDate(zla)).toThrow(RangeError);
    },
  );
});
```

`backend/domain/src/deadlines/add-months.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calendarDate, addMonths } from '../index';

describe('addMonths (art. 112 Kc, zasady liczenia terminów KPRM)', () => {
  it.each([
    ['2024-03-16', 24, '2026-03-16'],
    ['2024-01-31', 13, '2025-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2016-04-04', 24, '2018-04-04'],
    ['2025-11-30', 3, '2026-02-28'],
    ['2025-12-15', 1, '2026-01-15'],
  ])('%s + %i mies. = %s', (od, miesiace, oczekiwana) => {
    expect(addMonths(calendarDate(od), miesiace)).toBe(oczekiwana);
  });

  it('odrzuca ujemną albo ułamkową liczbę miesięcy', () => {
    const od = calendarDate('2024-03-16');
    expect(() => addMonths(od, -1)).toThrow(RangeError);
    expect(() => addMonths(od, 1.5)).toThrow(RangeError);
  });
});
```

Przypadki 1 do 3 w `addMonths` pochodzą wprost z dokumentu KPRM, przypadek 4 z DSC FAQ 10.

- [ ] **Step 4: Zainstaluj zależności pakietu i uruchom testy**

Run: `rtk pnpm install && rtk pnpm --filter @sarmata/domain test`
Expected: FAIL, Vitest nie znajduje modułu `../index`.

- [ ] **Step 5: Zaimplementuj `backend/domain/src/deadlines/calendar-date.ts`**

```ts
declare const marka: unique symbol;

/** Data bez czasu i strefy w formacie `RRRR-MM-DD`. Tworzy ją tylko `calendarDate`, więc zawsze istnieje. */
export type CalendarDate = string & { readonly [marka]: 'CalendarDate' };

const FORMAT_DATY = /^(\d{4})-(\d{2})-(\d{2})$/;

const dwieCyfry = (n: number): string => String(n).padStart(2, '0');

export const lastDayOfMonth = (rok: number, miesiac: number): number =>
  new Date(Date.UTC(rok, miesiac, 0)).getUTCDate();

/** Waliduje format i istnienie dnia. Rzuca `RangeError` dla złej daty. */
export function calendarDate(iso: string): CalendarDate {
  const dopasowanie = FORMAT_DATY.exec(iso);
  if (!dopasowanie) throw new RangeError(`Niepoprawny format daty: ${iso}`);
  return fromParts(Number(dopasowanie[1]), Number(dopasowanie[2]), Number(dopasowanie[3]));
}

/** Wewnętrzne: rok, miesiąc (1 do 12) i dzień z poprawnej daty. */
export function toParts(data: CalendarDate): { rok: number; miesiac: number; dzien: number } {
  return {
    rok: Number(data.slice(0, 4)),
    miesiac: Number(data.slice(5, 7)),
    dzien: Number(data.slice(8, 10)),
  };
}

/** Wewnętrzne: buduje datę ze składowych, rzuca `RangeError`, gdy dzień nie istnieje. */
export function fromParts(rok: number, miesiac: number, dzien: number): CalendarDate {
  if (miesiac < 1 || miesiac > 12 || dzien < 1 || dzien > lastDayOfMonth(rok, miesiac)) {
    throw new RangeError(`Data nie istnieje: ${rok}-${dwieCyfry(miesiac)}-${dwieCyfry(dzien)}`);
  }
  return `${rok}-${dwieCyfry(miesiac)}-${dwieCyfry(dzien)}` as CalendarDate;
}
```

- [ ] **Step 6: Zaimplementuj `backend/domain/src/deadlines/add-months.ts`**

```ts
import {
  type CalendarDate,
  lastDayOfMonth,
  toParts,
  fromParts,
} from './calendar-date';

/**
 * Koniec terminu liczonego w miesiącach (art. 112 Kc): dzień odpowiadający datą dniowi
 * początkowemu, a gdy go nie ma, ostatni dzień miesiąca.
 */
export function addMonths(od: CalendarDate, miesiace: number): CalendarDate {
  if (!Number.isInteger(miesiace) || miesiace < 0) {
    throw new RangeError(`Liczba miesięcy musi być nieujemną liczbą całkowitą: ${miesiace}`);
  }
  const { rok, miesiac, dzien } = toParts(od);
  const indeks = rok * 12 + (miesiac - 1) + miesiace;
  const nowyRok = Math.floor(indeks / 12);
  const nowyMiesiac = (indeks % 12) + 1;
  return fromParts(nowyRok, nowyMiesiac, Math.min(dzien, lastDayOfMonth(nowyRok, nowyMiesiac)));
}
```

- [ ] **Step 7: Utwórz `backend/domain/src/index.ts` (jedyny interfejs pakietu)**

```ts
export { type CalendarDate, calendarDate } from './terminy/calendar-date';
export { addMonths } from './terminy/add-months';
```

- [ ] **Step 8: Uruchom testy i typecheck**

Run: `rtk pnpm --filter @sarmata/domain test && rtk pnpm --filter @sarmata/domain typecheck`
Expected: 19 testów PASS (8 dla `calendarDate`, 11 dla `addMonths`), `tsc` bez błędów.

- [ ] **Step 9: Commit**

```bash
rtk git add backend/domain pnpm-lock.yaml
rtk git commit -m "feat(domain): calendar date type and month-based deadline per art. 112 Kc"
```

---

### Task 3: Turborepo

**Files:**
- Create: `turbo.json`
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Zainstaluj turbo w korzeniu**

Run: `rtk pnpm add -Dw turbo@2.11.13`

- [ ] **Step 2: Utwórz `turbo.json`**

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    }
  }
}
```

- [ ] **Step 3: Sprawdź uruchomienie i cache**

Run: `rtk pnpm turbo run typecheck test`, potem drugi raz to samo.
Expected: pierwsze uruchomienie PASS dla `@sarmata/domain`. Drugie kończy się szybciej z informacją `FULL TURBO` (wszystko z cache).

- [ ] **Step 4: Commit**

```bash
rtk git add turbo.json package.json pnpm-lock.yaml
rtk git commit -m "chore: turborepo tasks for build, typecheck and test"
```

---

### Task 4: ESLint i Prettier z granicą warstw

Szwy z ADR 0004 pilnowane regułą `no-restricted-imports`: `backend/domain` nie importuje nic z I/O ani innych pakietów `@sarmata/*`, `backend/services` nie woła `@supabase/*` bezpośrednio, a `frontend/**` nie importuje `@sarmata/repositories`. Pakietów jeszcze nie ma, ale reguły działają na nazwę importu.

**Files:**
- Create: `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`
- Modify: `package.json` (scripts, devDependencies)

- [ ] **Step 1: Zainstaluj narzędzia**

Run: `rtk pnpm add -Dw eslint@10.15.0 @eslint/js@10.0.1 typescript-eslint@8.73.0 eslint-config-prettier@10.1.8 globals@17.14.0 prettier@3.10.1 typescript@6.0.3`

- [ ] **Step 2: Utwórz `eslint.config.mjs`**

```js
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    'docs/**',
    'archive/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['backend/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '@sarmata/*'],
              message: 'Domena jest czysta: bez I/O i bez innych pakietów (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/services/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*'],
              message: 'Serwisy wołają bazę tylko przez @sarmata/repositories (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sarmata/repositories', '@sarmata/repositories/*'],
              message: 'Frontend korzysta tylko z @sarmata/services (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
```

- [ ] **Step 3: Utwórz `prettier.config.mjs`**

```js
/** @type {import('prettier').Config} */
export default {
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  printWidth: 100,
};
```

- [ ] **Step 4: Utwórz `.prettierignore`**

```
docs/
archive/
pnpm-lock.yaml
.turbo/
**/.next/
```

`docs/` jest wyłączone, bo Prettier przepisałby tabele i akapity tworzone według zasad z `AGENTS.md`.

- [ ] **Step 5: Dodaj skrypty do `package.json`**

W `scripts` dodaj:

```json
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "pnpm lint && pnpm format:check && turbo run typecheck test"
```

- [ ] **Step 6: Sformatuj repo i uruchom pełne sprawdzenie**

Run: `rtk pnpm format && rtk pnpm check`
Expected: `eslint` bez błędów, `prettier --check` bez różnic, typecheck i testy PASS.

- [ ] **Step 7: Sprawdź, że granica warstw działa**

Utwórz tymczasowy plik `frontend/web/granica.ts`:

```ts
import { cos } from '@sarmata/repositories';
export const x = cos;
```

Run: `rtk proxy pnpm exec eslint frontend/web/granica.ts`
Expected: błąd `no-restricted-imports` z komunikatem „Frontend korzysta tylko z @sarmata/services (ADR 0004).”

Usuń plik: `rm -r frontend`

- [ ] **Step 8: Commit**

```bash
rtk git add -A
rtk git commit -m "chore: eslint and prettier with layer boundary rule"
```

---

### Task 5: Husky i lint-staged

pre-commit: ESLint i Prettier na plikach w stage. pre-push: typecheck i testy pakietów objętych zmianą.

**Files:**
- Create: `lint-staged.config.mjs`, `.husky/pre-commit`, `.husky/pre-push`
- Modify: `package.json`

- [ ] **Step 1: Zainstaluj i zainicjuj Husky**

Run: `rtk pnpm add -Dw husky@9.1.7 lint-staged@17.6.1 && rtk pnpm exec husky init`
Expected: powstaje `.husky/pre-commit`, a w `package.json` skrypt `"prepare": "husky"`.

- [ ] **Step 2: Utwórz `lint-staged.config.mjs`**

```js
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,yml,yaml,css}': ['prettier --write'],
};
```

- [ ] **Step 3: Nadpisz `.husky/pre-commit`**

```sh
pnpm exec lint-staged
```

- [ ] **Step 4: Utwórz `.husky/pre-push`**

```sh
pnpm exec turbo run typecheck test --affected
```

Run: `chmod +x .husky/pre-commit .husky/pre-push`

- [ ] **Step 5: Sprawdź lint-staged bez commitu**

Dopisz na końcu `backend/domain/src/index.ts` linię z celowo złym formatowaniem: `export const   probaHaka=1`.

Run: `rtk git add backend/domain/src/index.ts && rtk pnpm exec lint-staged && tail -1 backend/domain/src/index.ts`
Expected: ostatnia linia brzmi `export const probaHaka = 1;` (Prettier ją poprawił).

Cofnij próbę: `rtk git restore --staged backend/domain/src/index.ts && rtk git checkout backend/domain/src/index.ts`

- [ ] **Step 6: Commit**

```bash
rtk git add .husky lint-staged.config.mjs package.json pnpm-lock.yaml
rtk git commit -m "chore: husky pre-commit lint-staged and pre-push affected checks"
```

Expected: hak pre-commit przechodzi bez zmian w plikach.

---

### Task 6: SOPS z age

Tylko dla sekretów zespołu i CI (ADR 0003). Instalacje w urzędach nie używają SOPS.

**Files:**
- Create: `.sops.yaml`, `secrets/dev.enc.env`, `scripts/secrets-decrypt.sh`
- Modify: `package.json`

- [ ] **Step 1: Sprawdź klucz age**

Run: `test -f ~/.config/sops/age/keys.txt && age-keygen -y ~/.config/sops/age/keys.txt`
Expected: jedna linia zaczynająca się od `age1`. Gdy pliku nie ma: `mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt` i powtórz.

- [ ] **Step 2: Utwórz `.sops.yaml` z kluczem publicznym**

Run:

```bash
cat > .sops.yaml <<EOF
creation_rules:
  - path_regex: secrets/.*\.enc\.env$
    age: >-
      $(age-keygen -y ~/.config/sops/age/keys.txt)
EOF
```

Kolejnych członków zespołu dodaje się jako kolejne klucze po przecinku w `age`, a potem `sops updatekeys secrets/dev.enc.env`.

- [ ] **Step 3: Utwórz zaszyfrowany plik sekretów**

```bash
mkdir -p secrets
printf 'SARMATA_SECRETS_OK=1\n' > secrets/dev.env
sops --encrypt --filename-override secrets/dev.enc.env secrets/dev.env > secrets/dev.enc.env
rm secrets/dev.env
```

Expected: `secrets/dev.enc.env` zawiera `SARMATA_SECRETS_OK=ENC[...]` i metadane `sops_`.

- [ ] **Step 4: Utwórz `scripts/secrets-decrypt.sh`**

```bash
#!/usr/bin/env bash
# Odszyfrowuje sekrety zespołu do .env.local (ignorowany przez git).
set -euo pipefail
cd "$(dirname "$0")/.."
sops --decrypt secrets/dev.enc.env > .env.local
echo "Zapisano .env.local"
```

Run: `chmod +x scripts/secrets-decrypt.sh`

- [ ] **Step 5: Dodaj skrypt do `package.json`**

```json
    "secrets:decrypt": "bash scripts/secrets-decrypt.sh"
```

- [ ] **Step 6: Sprawdź**

Run: `rtk pnpm secrets:decrypt && grep SARMATA_SECRETS_OK .env.local && rtk git check-ignore .env.local`
Expected: `SARMATA_SECRETS_OK=1` oraz `.env.local` (plik ignorowany).

- [ ] **Step 7: Commit**

```bash
rtk git add .sops.yaml secrets/dev.enc.env scripts/secrets-decrypt.sh package.json
rtk git commit -m "chore: sops with age for team secrets"
```

---

### Task 7: CI w GitHub Actions

Szybkie sprawdzenie na każdym PR i push do main. pgTAP i e2e dojdą w planach 2 i 4.

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Utwórz `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@v6
        with:
          path: .turbo/cache
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: turbo-${{ runner.os }}-
      - run: pnpm check
        env:
          TURBO_CACHE_DIR: .turbo/cache
```

CI woła ten sam `pnpm check` co deweloper, więc lista sprawdzeń żyje w jednym miejscu (`package.json`). `fetch-depth: 0` jest potrzebne, żeby później działało `turbo --affected`.

- [ ] **Step 2: Sprawdź składnię lokalnie**

Run: `rtk pnpm exec prettier --check .github/workflows/ci.yml`
Expected: bez różnic.

- [ ] **Step 3: Commit**

```bash
rtk git add .github/workflows/ci.yml
rtk git commit -m "ci: lint, format, typecheck and tests on PR and main"
```

Push i weryfikacja w Actions tylko na wyraźne polecenie użytkownika.

---

### Task 8: Setup dla termic i README

Termic trzyma skrypty setup i run w ustawieniach projektu w aplikacji, nie w repo. Repo dostarcza skrypt, a użytkownik wkleja ścieżkę w ustawieniach. Skrypt run (unikalny port dla `pnpm dev`) dojdzie w planie 4 razem z Next.js. Start Supabase dojdzie w planie 2.

**Files:**
- Create: `scripts/termic-setup.sh`
- Modify: `README.md`

- [ ] **Step 1: Utwórz `scripts/termic-setup.sh`**

```bash
#!/usr/bin/env bash
# Setup nowego taska termic: zależności i sekrety zespołu.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

klucz="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
if [ -f "$klucz" ]; then
  pnpm secrets:decrypt
else
  echo "Brak klucza age ($klucz), pomijam odszyfrowanie sekretów"
fi
```

Run: `chmod +x scripts/termic-setup.sh && bash scripts/termic-setup.sh`
Expected: instalacja bez zmian w lockfile i komunikat „Zapisano .env.local”.

- [ ] **Step 2: Zastąp `README.md`**

```markdown
# sarmata

System Automatycznej Rejestracji i Monitorowania Awansów, Terminów i Analiz. Cyfrowy asystent ocen okresowych w służbie cywilnej.

## Start

Wymagania: Node 24, pnpm 12.21.0, sops i age (sekrety zespołu).

    pnpm install
    pnpm secrets:decrypt
    pnpm check

## Skrypty

| Skrypt | Co robi |
|---|---|
| `pnpm check` | lint, format, typecheck i testy (to samo co CI) |
| `pnpm test` | testy wszystkich pakietów przez Turborepo |
| `pnpm typecheck` | kontrola typów |
| `pnpm lint`, `pnpm format` | ESLint i Prettier |
| `pnpm secrets:decrypt` | odszyfrowuje `secrets/dev.enc.env` do `.env.local` |

## Termic

W ustawieniach projektu w Termic ustaw skrypt setup na `./scripts/termic-setup.sh`.

## Dokumentacja

Architektura: `docs/architektura.md`, decyzje: `docs/adr/`, słownik: `GLOSSARY.md`, wymagania: `docs/wymagania-i-kontekst.md`.
```

- [ ] **Step 3: Sprawdź całość**

Run: `rtk pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/termic-setup.sh README.md
rtk git commit -m "chore: termic setup script and README"
```

---

## Po wykonaniu

- Poproś użytkownika o wpisanie `./scripts/termic-setup.sh` jako skryptu setup projektu sarmata w Termic (ustawienia aplikacji, nie edytować plików Termic ręcznie).
- Następny plan: `2026-11-21-fundament-2-baza.md` (Supabase `sarmata` na portach 554xx, migracje bazowe z `urzad_id`, hook JWT, RLS, pgTAP, seed kont demo, typy, `pg_cron` i pgmq).
