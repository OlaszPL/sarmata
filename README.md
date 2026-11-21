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

   `pnpm db:reset` kończy się synchronizacją oficjalnych wersji przepisów z `backend/regulations` do tabeli `regulation_versions`. To samo robi worker przy każdym starcie, a `pnpm regulations:sync` uruchamia ją osobno.

6. **AI lokalnie (opcjonalne, Mac z Apple Silicon).** Runtime LLM działa natywnie, bez Dockera (ADR 0005). Pierwsze `ai:setup` pobiera przypięty llama.cpp v1.0.0 z Metal (17 MB) i Bielik-11B-v3.1 Q4_K_M (6,7 GB) z kontrolą SHA-256 do `~/Library/Application Support/sarmata/ai` (wspólne dla wszystkich worktree, logi w `logs/`):

       pnpm ai:setup
       pnpm ai:start

   Serwer działa w tle pod `http://127.0.0.1:55490/v1`, zatrzymuje go `pnpm ai:stop`. Oba skrypty zapisują ustawienia `SARMATA_AI_*` (włączenie, adres i model, kontrakt z `backend/ai/src/config.ts`) do wygenerowanego `.env.ai.local` w korzeniu, który direnv ładuje zaraz po `.env.local` (bez direnv: `set -a; . ./.env.ai.local; set +a`). Na słabszym sprzęcie: `SARMATA_AI_MODEL=bielik-4.5b-v3.0-q8_0 pnpm ai:setup`. Sekretów ani tokenu Hugging Face nie trzeba, repozytoria modeli są publiczne. Pobieranie robi się raz na maszynę: w kolejnym worktree wystarczy `pnpm ai:env` (zapisuje tylko `.env.ai.local`, bez pobierania i bez startu serwera), a skrypt setup dla Termic woła go sam. Powtórne `ai:setup` też niczego nie ściąga, jeśli pliki mają poprawne sumy.

7. **Aplikacja web** (po `pnpm db:start`):

       pnpm web:env
       pnpm --filter @sarmata/e2e exec playwright install chromium
       pnpm dev

   `web:env` zapisuje `frontend/web/.env.local` z adresem i kluczem lokalnego Supabase (oraz wszystkie `SARMATA_AI_*` z `.env.ai.local`, jeśli istnieje). Przeglądarka Chromium służy testom e2e i skillowi `app-walkthrough`. Aplikacja działa na `http://localhost:3000`.

8. **Worker kolejki zadań** (opcjonalnie, potrzebny dopiero dla zadań w tle):

       pnpm worker:dev

   Najpierw synchronizuje wersje przepisów, potem czyta kolejkę pgmq `jobs`. Ctrl+C kończy go po bieżącym zadaniu. Próba: `docker exec supabase_db_sarmata psql -U postgres -c "select public.job_queue_send('{\"type\":\"system.ping\",\"payload\":{\"note\":\"hi\"}}')"`, w logu pojawi się `pong`.

9. **Sprawdzenie całości** (to samo co CI):

       pnpm check
       pnpm db:test
       pnpm test:integration

   `pnpm test:integration` to testy repozytoriów na działającej bazie, z kontami demo. CI ich nie uruchamia.

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
| `pnpm db:reset` | migracje od zera, dane demo i synchronizacja oficjalnych wersji przepisów |
| `pnpm db:test` | testy pgTAP |
| `pnpm db:types` | typy do `database/src/types.ts`, po każdej migracji |
| `pnpm test:integration` | testy repozytoriów na lokalnym Supabase, wymagają `pnpm db:reset` |
| `pnpm regulations:sync` | wstawia brakujące oficjalne wersje przepisów, kończy się błędem, gdy wersja w bazie różni się od kodu |
| `pnpm worker:dev` | worker kolejki pgmq z przeładowaniem po zmianie kodu |
| `pnpm worker:start` | worker kolejki pgmq bez przeładowania |
| `pnpm ai:setup` | llama.cpp i model Bielik do katalogu danych AI, wybór urządzenia, zapis `.env.ai.local` |
| `pnpm ai:env` | `.env.ai.local` dla tego worktree z już pobranego AI, bez pobierania |
| `pnpm ai:start` / `ai:stop` | wspólny llama-server w tle na porcie 55490 |
| `pnpm --filter @sarmata/deploy test` | testy instalatora (plany kroków, compose, sekrety, skróty) bez Dockera |
| `pnpm --filter @sarmata/deploy vendor:supabase [TAG]` | odświeża przypiętą kopię self-hosted Supabase w `infra/deploy/supabase/` |

## Aplikacja web

| Skrypt | Co robi |
|---|---|
| `pnpm web:env` | zapisuje `frontend/web/.env.local` z adresem i kluczem publicznym lokalnego Supabase |
| `pnpm dev` | Next.js w trybie deweloperskim (port ze zmiennej `PORT`, domyślnie 3000) |
| `pnpm e2e` | testy Playwright: logowanie i wylogowanie każdym kontem demo, dostępność (axe, WCAG 2.1 AA) |
| `pnpm e2e:ui` | te same testy w trybie UI Playwright |
| `pnpm e2e:walk` | zrzuty ekranów dla wybranych kont i ścieżek (`WALK_ACCOUNTS`, `WALK_PATHS`), opis w `.claude/skills/app-walkthrough/SKILL.md` |

Font Open Sans jest na licencji SIL Open Font License 1.1.

## Zmienne środowiskowe

Żadna z nich nie jest sekretem zespołu. Lokalne klucze Supabase podaje `supabase status`, więc nie trafiają do `secrets/dev.enc.env`. W instalacji u klienta ustawia je kreator.

| Zmienna | Kto używa | Skąd w dev |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | testy integracyjne, worker | `scripts/with-supabase-env.sh` czyta je z `supabase status`, chyba że `SUPABASE_URL` jest już ustawione (zewnętrzna instancja) |
| `SARMATA_AI_ENABLED` | `@sarmata/ai` | domyślnie `false`, AI wyłączone |
| `SARMATA_AI_TIMEOUT_MS` | `@sarmata/ai` | domyślnie `60000` |
| `SARMATA_AI_TEXT_BASE_URL`, `SARMATA_AI_TEXT_MODEL` | `@sarmata/ai`, model tekstowy zgodny z OpenAI | np. `http://127.0.0.1:8080/v1` i `bielik` przy lokalnym llama-server, bez nich model tekstowy jest wyłączony |
| `SARMATA_AI_DECISION_BASE_URL`, `SARMATA_AI_DECISION_MODEL` | `@sarmata/ai`, Bielik-One `/v1/systemone` | np. `http://127.0.0.1:8026/v1` i `decision`, bez nich decyzje są wyłączone |
| `SARMATA_AI_TEXT_API_KEY`, `SARMATA_AI_DECISION_API_KEY` | `@sarmata/ai` | tylko gdy serwer modelu wymaga klucza. To sekret: dopisz go do `secrets/dev.enc.env` przez `sops secrets/dev.enc.env`, nigdy jawnie do repo |
| `SARMATA_WORKER_IDLE_DELAY_MS` | worker | domyślnie `1000`, przerwa po pustym odczycie kolejki |

## Pliki konfiguracyjne

- W repo: `.envrc`, `.sops.yaml`, `secrets/*.enc.env` (zaszyfrowane), `.mcp.json`, `.claude/`, `.agents/`, `.codex/`, `scripts/termic-*.sh`, `database/supabase/config.toml`, `infra/deploy/supabase/` (kopia `docker/` z supabase/supabase, nie edytować ręcznie).
- Poza repo: `.env`, `.env.local` i inne `.env*` (powstają z SOPS albo ze skryptów, np. `.env.ai.local` z `pnpm ai:setup`), klucze age, katalog danych AI `~/Library/Application Support/sarmata/ai` (llama.cpp, modele, logi), `.termic/customization-manifest.json` (generuje go Termic).

## Termic

W ustawieniach projektu sarmata w Termic ustaw:

- skrypt setup: `./scripts/termic-setup.sh`. Robi kroki 3 do 6 automatycznie: instalacja, `direnv allow`, sekrety, start wspólnej bazy, `web:env`, Chromium dla Playwright, ostrzeżenia z `doctor`.
- skrypt run: `./scripts/termic-run.sh`

Skrypt run uruchamia `pnpm dev` na porcie wyliczonym z nazwy taska (`$TERMIC_TASK`, zakres 3001 do 3999, poza Termic port 3000) i ustawia `SITE_URL` aplikacji na ten sam adres. Port bieżącego taska pokazuje `node scripts/task-port.mjs`.

Skrypt setup po starcie wspólnej bazy synchronizuje oficjalne wersje przepisów (`pnpm regulations:sync`).

## Dokumentacja

Architektura: `docs/architektura.md`, decyzje: `docs/adr/`, słownik: `GLOSSARY.md`, wymagania: `docs/wymagania-i-kontekst.md`, znak i logo: `docs/brand/`.
