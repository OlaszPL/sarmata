# Reguły prawne jako wersjonowane dane ze slotami strategii

Przepisy o ocenach mają się wkrótce zmienić (projekt UDER102: cykl 12 miesięcy liczony w miesiącu kalendarzowym, skala 3 poziomów, 4 do 6 kompetencji), a przepisy przejściowe wymagają, żeby przez co najmniej jeden cykl obsługiwać oba reżimy naraz. Dlatego reguły trzymamy w tabeli `regulation_versions` jako dokument jsonb walidowany zodem. Dokument ma parametry (skale, progi, terminy, arkusze, kryteria) i sloty strategii, np. `evaluationDeadline: { strategy: "monthsFromEvent", months: 24 }`. Strategie to nazwane i przetestowane funkcje w `backend/domain`. Każda ocena przypina wersję przepisów obowiązującą w dniu jej rozpoczęcia. Graf reguł w UI ze specu jest widokiem i edytorem tych slotów, a jego szczegóły ustalimy w wątku funkcjonalnym. Dane startowe pochodzą z `docs/legal/oceny-okresowe-dane.yaml`.

## Odrzucone

- **Ogólny silnik reguł** (json-rules-engine, JSONLogic): pełna dowolność wyrażeń, ale reguły byłyby nieczytelne dla kadr i trudne do przetestowania na przypadkach z `liczenie terminów.docx`.
- **Reguły w kodzie, w konfiguracji tylko stałe:** nowelizacja zmienia strukturę reguł, a nie tylko liczby, więc wymagałaby nowego wydania kodu.
