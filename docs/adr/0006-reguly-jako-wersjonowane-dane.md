# Reguły prawne jako wersjonowane dane ze slotami strategii

Przepisy o ocenach mają się wkrótce zmienić (projekt UDER102: cykl 12 miesięcy liczony w miesiącu kalendarzowym, skala 3 poziomów, 4 do 6 kompetencji), a przepisy przejściowe wymagają, żeby przez co najmniej jeden cykl obsługiwać oba reżimy naraz. Dlatego reguły trzymamy w tabeli `regulation_versions` jako dokument jsonb walidowany zodem. Dokument ma parametry (skale, progi, terminy, arkusze, kryteria) i sloty strategii, np. `evaluationDeadline: { strategy: "monthsFromEvent", months: 24 }`. Strategie to nazwane i przetestowane funkcje w `backend/domain`. Każda ocena przypina wersję przepisów obowiązującą w dniu jej rozpoczęcia. Graf reguł w UI ze specu jest widokiem i edytorem tych slotów, a jego szczegóły ustalimy w wątku funkcjonalnym. Dane startowe pochodzą z `docs/legal/oceny-okresowe-dane.yaml`, z którego powstaje `rules.json` oficjalnych wersji (patrz sekcja o module w repo, to `rules.json` zasila `regulation_versions`).

## Odrzucone

- **Ogólny silnik reguł** (json-rules-engine, JSONLogic): pełna dowolność wyrażeń, ale reguły byłyby nieczytelne dla kadr i trudne do przetestowania na przypadkach z `liczenie terminów.docx`.
- **Reguły w kodzie, w konfiguracji tylko stałe:** nowelizacja zmienia strukturę reguł, a nie tylko liczby, więc wymagałaby nowego wydania kodu.

## Oficjalne wersje przepisów jako moduł w repo (uzupełnienie z wątku funkcjonalnego)

Oficjalne wersje przepisów żyją w kodzie, w katalogu `backend/regulations/<wersja>/`: plik `rules.json` walidowany schematem zod z `backend/domain`, z podstawą prawną przy każdej regule, opcjonalny `strategies.ts` rejestrowany w katalogu strategii, testy przypadków oraz teksty prawne do RAG. Przy migracji albo starcie systemu oficjalne wersje trafiają do tabeli `regulation_versions` jako niezmienne. Aktualizacja przepisów to dodanie nowego katalogu i wydanie. Edytor administratora tworzy w bazie lokalne klony oficjalnych wersji i to one są edytowalne. Seed zawiera tylko przepisy obowiązujące (ustawa o służbie cywilnej t.j. 2026, rozporządzenie z 2016 r., zarządzenie nr 6 Szefa SC). Projekt UDER102 dojdzie jako nowy katalog, gdy wejdzie w życie.

## Szkice i pierwszeństwo wersji urzędu (uzupełnienie z wątku edytora reguł)

Admin urzędu klonuje opublikowaną wersję do szkicu (`status = 'draft'`), zmienia ją i publikuje z datą obowiązywania nie wcześniejszą niż dziś. Opublikowana wersja urzędu jest niezmienna, pilnuje tego trigger. Dokument niezgodny ze schematem zod nigdy nie trafia do bazy. Szkic z nieudanymi przypadkami testowymi można opublikować tylko z jawnym potwierdzeniem admina, a zaakceptowane wyniki zapisują się razem z wersją.

Kandydaci na wersję obowiązującą to wersje oficjalne i opublikowane wersje urzędu. Obowiązuje ta z najpóźniejszą datą obowiązywania nie późniejszą niż dzień rozpoczęcia oceny. Przy równej dacie wygrywa wersja urzędu. Nowsza wersja oficjalna wypiera więc lokalną poprawkę od swojej daty, a admin klonuje wtedy nową wersję oficjalną. Ocena przypina wersję przy starcie, więc publikacja nie zmienia ocen w toku.
