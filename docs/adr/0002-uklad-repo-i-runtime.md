# Monorepo pogrupowane po warstwach, trzy runtime'y

Repo jest monorepo pnpm z katalogami pogrupowanymi po warstwie: `frontend/` (web, ui), `backend/` (domain, repositories, services, ai, worker), `database/` (supabase), `infra/` (deploy, ai-runtime), `e2e/`, `docs/`. Działają trzy runtime'y: Next.js na Node, który wywołuje `backend/services` w tym samym procesie, stack Supabase (Postgres z `pg_cron` jako scheduler terminów i przypomnień, auth, REST, storage) oraz llama-server z API zgodnym z OpenAI.

Pakiet `@sarmata/ui` eksportuje oprócz `index.ts` także arkusz `globals.css`: style importuje się po ścieżce (`@sarmata/ui/globals.css`), bo CSS nie przechodzi przez moduł TypeScript.

Prace w tle (długie zadania AI, seryjne PDF, powiadomienia) planuje `pg_cron`, trzyma kolejka pgmq w Postgresie, a wykonuje osobny proces worker na Node z tym samym kodem `backend/services`. Worker działa w osobnym kontenerze w każdym profilu, także w light, bo tylko on dostaje klucz serwisowy (ADR 0003 i 0004). PDF arkuszy generuje Typst jako natywny moduł Node (`@myriaddreamin/typst-ts-node-compiler`, napi) w procesie aplikacji, bez osobnego serwisu. Wariant WASM odpada, bo jego API JS nie pozwala ustawić standardu PDF, a moduł natywny ustawia PDF/UA-1 (arkusz do pobrania) i PDF/A-2a (paczka EZD). `pdfStandard` przyjmuje jeden standard, więc PDF/UA-1 i PDF/A nie łączą się w jednym pliku i paczka EZD dostaje osobny render. Krój dokumentów to Open Sans (SIL OFL 1.1), pliki leżą w `backend/exports/fonts/open-sans/`, a nazwę trzyma stała `PDF_FONT_FAMILY`. DOCX generuje biblioteka `docx` (MIT), też w procesie, z tą samą nazwą kroju.

## Odrzucone

- **Supabase Edge Functions:** działają w Deno, więc kod TS byłby dzielony między dwa runtime'y i trudniej byłoby go testować w monorepo.
- **Osobny serwis API** (np. Hono): dodaje proces i drugie miejsce obsługi auth bez zysku przy tej skali.
- **gRPC między mikroserwisami:** jedyny zewnętrzny serwis to model AI, a dla niego standardem jest HTTP zgodne z OpenAI.
- **Redis i BullMQ:** dodatkowy kontener, a pgmq daje kolejkę w bazie, którą już mamy.
- **WeasyPrint i Chromium do PDF:** WeasyPrint to dodatkowy runtime w Pythonie, a Chromium waży około 1 GB i nie deklaruje PDF/UA. Typst daje PDF/UA-1 bez nowego procesu, kosztem szablonów w osobnym języku.
