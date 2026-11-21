# sarmata

System Automatycznej Rejestracji i Monitorowania Awansów, Terminów i Analiz. Cyfrowy asystent ocen okresowych w służbie cywilnej.

## Start

Wymagania: Node 24, pnpm 12.21.0, sops i age (sekrety zespołu). Klucz age leży w `~/.config/sops/age/keys.txt` albo pod ścieżką z `SOPS_AGE_KEY_FILE`.

    pnpm install
    pnpm secrets:decrypt
    pnpm check

## Skrypty

| Skrypt                     | Co robi                                            |
| -------------------------- | -------------------------------------------------- |
| `pnpm check`               | lint, format, typecheck i testy (to samo co CI)    |
| `pnpm test`                | testy wszystkich pakietów przez Turborepo          |
| `pnpm typecheck`           | kontrola typów                                     |
| `pnpm lint`, `pnpm format` | ESLint i Prettier                                  |
| `pnpm secrets:decrypt`     | odszyfrowuje `secrets/dev.enc.env` do `.env.local` |

## Baza danych

Wymagania: Docker i Supabase CLI 3.2.0 (`brew install supabase/tap/supabase`).

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
