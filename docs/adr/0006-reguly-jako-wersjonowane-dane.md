# Reguły prawne jako wersjonowane dane ze slotami strategii

Przepisy o ocenach mają się wkrótce zmienić (projekt UDER102: cykl 12 miesięcy liczony w miesiącu kalendarzowym, skala 3 poziomów, 4 do 6 kompetencji), a przepisy przejściowe wymagają, żeby przez co najmniej jeden cykl obsługiwać oba reżimy naraz. Dlatego reguły trzymamy w tabeli `regulation_versions` jako dokument jsonb walidowany zodem. Dokument ma parametry (skale, progi, terminy, arkusze, kryteria) i sloty strategii, np. `evaluationDeadline: { strategy: "monthsFromEvent", months: 24 }`. Strategie to nazwane i przetestowane funkcje w `backend/domain`. Każda ocena przypina wersję przepisów obowiązującą w dniu jej rozpoczęcia. Graf reguł w UI ze specu jest widokiem i edytorem tych slotów, a jego szczegóły ustalimy w wątku funkcjonalnym. Dane startowe pochodzą z `docs/legal/oceny-okresowe-dane.yaml`.

## Odrzucone

- **Ogólny silnik reguł** (json-rules-engine, JSONLogic): pełna dowolność wyrażeń, ale reguły byłyby nieczytelne dla kadr i trudne do przetestowania na przypadkach z `liczenie terminów.docx`.
- **Reguły w kodzie, w konfiguracji tylko stałe:** nowelizacja zmienia strukturę reguł, a nie tylko liczby, więc wymagałaby nowego wydania kodu.

## Oficjalne wersje przepisów jako moduł w repo (uzupełnienie z wątku funkcjonalnego)

Oficjalne wersje przepisów żyją w kodzie, w katalogu `backend/regulations/<wersja>/`: plik `rules.json` walidowany schematem zod z `backend/domain`, z podstawą prawną przy każdej regule, opcjonalny `strategies.ts` rejestrowany w katalogu strategii, testy przypadków oraz teksty prawne do RAG. Przy migracji albo starcie systemu oficjalne wersje trafiają do tabeli `regulation_versions` jako niezmienne. Aktualizacja przepisów to dodanie nowego katalogu i wydanie. Edytor administratora tworzy w bazie lokalne klony oficjalnych wersji i to one są edytowalne. Seed zawiera tylko przepisy obowiązujące (ustawa o służbie cywilnej t.j. 2026, rozporządzenie z 2016 r., zarządzenie nr 6 Szefa SC). Projekt UDER102 dojdzie jako nowy katalog, gdy wejdzie w życie.
