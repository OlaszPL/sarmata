# Monorepo pogrupowane po warstwach, trzy runtime'y

Repo jest monorepo pnpm z katalogami pogrupowanymi po warstwie: `frontend/` (web, ui), `backend/` (domain, repositories, services, ai, worker), `database/` (supabase), `infra/` (deploy, ai-runtime), `e2e/`, `docs/`. Działają trzy runtime'y: Next.js na Node, który wywołuje `backend/services` w tym samym procesie, stack Supabase (Postgres z `pg_cron` jako scheduler terminów i przypomnień, auth, REST, storage) oraz llama-server z API zgodnym z OpenAI.

Prace w tle (długie zadania AI, seryjne PDF, powiadomienia) planuje `pg_cron`, trzyma kolejka pgmq w Postgresie, a wykonuje osobny proces worker na Node z tym samym kodem `backend/services`. W profilu light worker może działać w kontenerze web. PDF arkuszy (PDF/UA-1) generuje Typst przez WASM w procesie Node, bez osobnego serwisu. DOCX generuje biblioteka `docx` (MIT), też w procesie. Paczka do EZD potrzebuje PDF/A: Typst obsługuje standardy PDF/A, a to, czy PDF/A i PDF/UA-1 dadzą się połączyć w jednym pliku, sprawdzamy przy implementacji PDF. Jeśli nie, paczka EZD dostaje osobny render PDF/A.

## Odrzucone

- **Supabase Edge Functions:** działają w Deno, więc kod TS byłby dzielony między dwa runtime'y i trudniej byłoby go testować w monorepo.
- **Osobny serwis API** (np. Hono): dodaje proces i drugie miejsce obsługi auth bez zysku przy tej skali.
- **gRPC między mikroserwisami:** jedyny zewnętrzny serwis to model AI, a dla niego standardem jest HTTP zgodne z OpenAI.
- **Redis i BullMQ:** dodatkowy kontener, a pgmq daje kolejkę w bazie, którą już mamy.
- **WeasyPrint i Chromium do PDF:** WeasyPrint to dodatkowy runtime w Pythonie, a Chromium waży około 1 GB i nie deklaruje PDF/UA. Typst daje PDF/UA-1 bez nowego procesu, kosztem szablonów w osobnym języku.
