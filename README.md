# sarmata

System Automatycznej Rejestracji i Monitorowania Awansów, Terminów i Analiz. Cyfrowy asystent ocen okresowych w służbie cywilnej.

## Jak uruchomić (dev)

Krok po kroku, od czystej maszyny do działającego środowiska.

1. **Narzędzia systemowe:** Node 24, pnpm 12.21.0, Docker (działający), sops, age, opcjonalnie direnv. Sprawdzenie i polecenia instalacji dla macOS, Debiana/Ubuntu i Windowsa:

       pnpm run doctor

   (`pnpm doctor` bez `run` to wbudowana komenda pnpm 12, nie nasz skrypt.)

2. **Klucz age zespołu** w `~/.config/sops/age/keys.txt` (albo ścieżka w `SOPS_AGE_KEY_FILE`). Nowa osoba generuje klucz `age-keygen -o ~/.config/sops/age/keys.txt`, przekazuje klucz publiczny, a ktoś z zespołu dopisuje go do `.sops.yaml` i robi `sops updatekeys secrets/dev.enc.env`.

3. **Zależności:**

       pnpm install

   Supabase CLI 3.2.0 przychodzi z tym krokiem (devDependency `@sarmata/database`).

4. **Sekrety i zmienne środowiskowe.** Pliki `.env*` nigdy nie trafiają do repo. `.env.local` w korzeniu powstaje z `secrets/dev.enc.env` (SOPS):
   - z direnv: `direnv allow` (raz na worktree). Od tej pory direnv sam odszyfrowuje `.env.local`, gdy plik nie istnieje albo zaszyfrowany plik jest nowszy, i ładuje go do powłoki,
   - bez direnv: `pnpm secrets:decrypt`.

5. **Baza danych** (wspólna instancja `sarmata` dla wszystkich worktree, nie koliduje z innymi stackami Supabase na portach 54321 do 54323):

       pnpm db:start
       pnpm db:reset

6. **Aplikacja web** (po `pnpm db:start`):

       pnpm web:env
       pnpm --filter @sarmata/e2e exec playwright install chromium
       pnpm dev

   `web:env` zapisuje `frontend/web/.env.local` z adresem i kluczem lokalnego Supabase (oraz `AI_BASE_URL`, `AI_MODEL`, `AI_DECISION_URL` z `.env.ai.local`, jeśli istnieje). Przeglądarka Chromium służy testom e2e i skillowi `app-walkthrough`. Aplikacja działa na `http://localhost:3000`.

7. **Sprawdzenie całości** (to samo co CI):

       pnpm check
       pnpm db:test

Konta demo (hasło `Haslo-Demo-2026`): `admin@kropka.test`, `kadry@kropka.test`, `oceniajacy@kropka.test`.

## Skrypty

| Skrypt | Co robi |
|---|---|
| `pnpm run doctor` | sprawdza wymagane narzędzia i podpowiada instalację |
| `pnpm check` | lint, format, typecheck i testy (to samo co CI) |
| `pnpm test` | testy wszystkich pakietów przez Turborepo |
| `pnpm typecheck` | kontrola typów |
| `pnpm lint`, `pnpm format` | ESLint i Prettier |
| `pnpm secrets:decrypt` | odszyfrowuje `secrets/dev.enc.env` do `.env.local` |
| `pnpm db:start` / `db:stop` / `db:status` | instancja `sarmata`: API 55421, DB 55422, Studio 55423, Mailpit 55424 |
| `pnpm db:reset` | migracje od zera i dane demo |
| `pnpm db:test` | testy pgTAP |
| `pnpm db:types` | typy do `database/src/types.ts`, po każdej migracji |

## Aplikacja web

| Skrypt | Co robi |
|---|---|
| `pnpm web:env` | zapisuje `frontend/web/.env.local` z adresem i kluczem publicznym lokalnego Supabase |
| `pnpm dev` | Next.js w trybie deweloperskim (port ze zmiennej `PORT`, domyślnie 3000) |
| `pnpm e2e` | testy Playwright: logowanie i wylogowanie każdym kontem demo, dostępność (axe, WCAG 2.1 AA) |
| `pnpm e2e:ui` | te same testy w trybie UI Playwright |
| `pnpm e2e:walk` | zrzuty ekranów dla wybranych kont i ścieżek (`WALK_ACCOUNTS`, `WALK_PATHS`), opis w `.claude/skills/app-walkthrough/SKILL.md` |

Font Open Sans jest na licencji SIL Open Font License 1.1.

## Pliki konfiguracyjne

- W repo: `.envrc`, `.sops.yaml`, `secrets/*.enc.env` (zaszyfrowane), `.mcp.json`, `.claude/`, `.agents/`, `.codex/`, `scripts/termic-*.sh`, `database/supabase/config.toml`.
- Poza repo: `.env`, `.env.local` i inne `.env*` (powstają z SOPS albo ze skryptów), klucze age, `.termic/customization-manifest.json` (generuje go Termic).

## Termic

W ustawieniach projektu sarmata w Termic ustaw:

- skrypt setup: `./scripts/termic-setup.sh`. Robi kroki 3 do 6 automatycznie: instalacja, `direnv allow`, sekrety, start wspólnej bazy, `web:env`, Chromium dla Playwright, ostrzeżenia z `doctor`.
- skrypt run: `./scripts/termic-run.sh`

Skrypt run uruchamia `pnpm dev` na porcie wyliczonym z nazwy taska (`$TERMIC_TASK`, zakres 3001 do 3999, poza Termic port 3000) i ustawia `SITE_URL` aplikacji na ten sam adres. Port bieżącego taska pokazuje `node scripts/task-port.mjs`.

## Dokumentacja

Architektura: `docs/architektura.md`, decyzje: `docs/adr/`, słownik: `GLOSSARY.md`, wymagania: `docs/wymagania-i-kontekst.md`, plany implementacji: `docs/superpowers/plans/`, znak i logo: `docs/brand/`.
