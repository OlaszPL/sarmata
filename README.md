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

6. **AI lokalnie (opcjonalne, Mac z Apple Silicon).** Runtime LLM działa natywnie, bez Dockera (ADR 0005). Pierwsze `ai:setup` pobiera przypięty llama.cpp v1.0.0 z Metal (17 MB) i Bielik-11B-v3.1 Q4_K_M (6,7 GB) z kontrolą SHA-256 do `~/Library/Application Support/sarmata/ai` (wspólne dla wszystkich worktree, logi w `logs/`):

       pnpm ai:setup
       pnpm ai:start

   Serwer działa w tle pod `http://127.0.0.1:55490/v1`, zatrzymuje go `pnpm ai:stop`. Oba skrypty zapisują `AI_BASE_URL` i `AI_MODEL` do wygenerowanego `.env.ai.local` w korzeniu, który direnv ładuje zaraz po `.env.local` (bez direnv: `set -a; . ./.env.ai.local; set +a`). Na słabszym sprzęcie: `SARMATA_AI_MODEL=bielik-4.5b-v3.0-q8_0 pnpm ai:setup`. Sekretów ani tokenu Hugging Face nie trzeba, repozytoria modeli są publiczne. Pobieranie robi się raz na maszynę: w kolejnym worktree wystarczy `pnpm ai:env` (zapisuje tylko `.env.ai.local`, bez pobierania i bez startu serwera), a skrypt setup dla Termic woła go sam. Powtórne `ai:setup` też niczego nie ściąga, jeśli pliki mają poprawne sumy.

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
| `pnpm ai:setup` | llama.cpp i model Bielik do katalogu danych AI, wybór urządzenia, zapis `.env.ai.local` |
| `pnpm ai:env` | `.env.ai.local` dla tego worktree z już pobranego AI, bez pobierania |
| `pnpm ai:start` / `ai:stop` | wspólny llama-server w tle na porcie 55490 |

## Pliki konfiguracyjne

- W repo: `.envrc`, `.sops.yaml`, `secrets/*.enc.env` (zaszyfrowane), `.mcp.json`, `.claude/`, `.agents/`, `.codex/`, `scripts/termic-*.sh`, `database/supabase/config.toml`.
- Poza repo: `.env`, `.env.local` i inne `.env*` (powstają z SOPS albo ze skryptów, np. `.env.ai.local` z `pnpm ai:setup`), klucze age, katalog danych AI `~/Library/Application Support/sarmata/ai` (llama.cpp, modele, logi), `.termic/customization-manifest.json` (generuje go Termic).

## Termic

W ustawieniach projektu sarmata w Termic ustaw skrypt setup na `./scripts/termic-setup.sh`. Robi kroki 3 do 5 automatycznie: instalacja, `direnv allow`, sekrety, start wspólnej bazy, ostrzeżenia z `doctor`.

## Dokumentacja

Architektura: `docs/architektura.md`, decyzje: `docs/adr/`, słownik: `GLOSSARY.md`, wymagania: `docs/wymagania-i-kontekst.md`, znak i logo: `docs/brand/`.
