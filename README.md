# sarmata

System Automatycznej Rejestracji i Monitorowania Awansów, Terminów i Analiz. Cyfrowy asystent ocen okresowych w służbie cywilnej.

## Start

Wymagania: Node 24, pnpm 12.21.0, Docker, sops i age (sekrety zespołu). Klucz age leży w `~/.config/sops/age/keys.txt` albo pod ścieżką z `SOPS_AGE_KEY_FILE`. `pnpm doctor` sprawdza narzędzia i podaje polecenia instalacji dla macOS, Debiana/Ubuntu i Windowsa.

Opcjonalnie direnv: `direnv allow` w katalogu repo ładuje `.envrc` (ścieżka klucza age, `node_modules/.bin` w `PATH`, `.env.local`). Skrypt `scripts/termic-setup.sh` robi to sam, gdy direnv jest zainstalowany.

    pnpm install
    pnpm secrets:decrypt
    pnpm check

## Skrypty

| Skrypt                     | Co robi                                            |
| -------------------------- | -------------------------------------------------- |
| `pnpm doctor`              | sprawdza wymagane narzędzia i podpowiada instalację |
| `pnpm check`               | lint, format, typecheck i testy (to samo co CI)    |
| `pnpm test`                | testy wszystkich pakietów przez Turborepo          |
| `pnpm typecheck`           | kontrola typów                                     |
| `pnpm lint`, `pnpm format` | ESLint i Prettier                                  |
| `pnpm secrets:decrypt`     | odszyfrowuje `secrets/dev.enc.env` do `.env.local` |

## Baza danych

Wymagania: Docker. Supabase CLI 3.2.0 przychodzi z `pnpm install` (devDependency `@sarmata/database`), nie trzeba go instalować osobno.

| Skrypt | Co robi |
|---|---|
| `pnpm db:start` / `db:stop` / `db:status` | wspólna instancja `sarmata` (API 55421, DB 55422, Studio 55423, Mailpit 55424) |
| `pnpm db:reset` | migracje od zera i dane demo |
| `pnpm db:test` | testy pgTAP |
| `pnpm db:types` | typy do `database/src/types.ts` po każdej migracji |

Konta demo (hasło `Haslo-Demo-2026`): `admin@kropka.test`, `kadry@kropka.test`, `oceniajacy@kropka.test`.

## Termic

W ustawieniach projektu w Termic ustaw skrypt setup na `./scripts/termic-setup.sh`.

## Dokumentacja

Architektura: `docs/architektura.md`, decyzje: `docs/adr/`, słownik: `GLOSSARY.md`, wymagania: `docs/wymagania-i-kontekst.md`.
