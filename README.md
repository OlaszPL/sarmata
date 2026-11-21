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

## Termic

W ustawieniach projektu w Termic ustaw skrypt setup na `./scripts/termic-setup.sh`.

## Dokumentacja

Architektura: `docs/architektura.md`, decyzje: `docs/adr/`, słownik: `GLOSSARY.md`, wymagania: `docs/wymagania-i-kontekst.md`.
