# Warstwy backendu: repozytoria na supabase-js, serwisy z logiką

Backend dzieli się na pakiety per warstwa: `backend/domain` (typy, reguły, schematy zod, bez I/O), `backend/repositories` (jedyne miejsce z zapytaniami do bazy), `backend/services` (logika, woła repozytoria), `backend/ai` i `backend/worker`. `frontend/web` importuje tylko `services`, a granice pilnuje ESLint. Repozytoria używają supabase-js z JWT zalogowanego użytkownika, więc RLS działa bez ręcznego ustawiania roli i claimów. Typy pochodzą z `supabase gen types`.

## Konsekwencje

- Złożone zapytania (joiny, agregaty, raporty) trafiają do widoków SQL albo funkcji RPC w migracjach, a repozytorium je wywołuje. SQL nadal leży w jednym miejscu: w `database/` i w repozytoriach.
- Odrzucone: Kysely albo surowy SQL na postgres.js, które dawały pełny SQL w TS kosztem ręcznego przekazywania claimów JWT do transakcji.
- Pobieranie danych: Server Components wołają serwisy, złożone ekrany biorą dane jednym wywołaniem widoku SQL albo RPC, mutacje idą przez server actions z `revalidateTag`. TanStack Query tylko w miejscach naprawdę interaktywnych (np. edytor oceny z autozapisem).
- Tożsamość w fundamencie: konto logowania (`auth.users`) jest osobne od rekordu pracownika (`employees`, opcjonalne `user_id`, dopasowanie po e-mailu), role trzyma tabela `memberships(user_id, office_id, role)`, a hook Supabase wkłada `office_id` i rolę do JWT. Każda polityka RLS pyta jedną funkcję `access.can(action, resource, office_id)` w schemacie `access`, więc reguły dostępu zmienia się w jednym miejscu. W fundamencie funkcja rozstrzyga tylko izolację urzędów. Kto co widzi w ramach urzędu ustalimy w wątku funkcjonalnym.
