# Każda tabela domenowa ma office_id od pierwszej migracji

Domyślnie wdrażamy jedną instalację na urząd, ale research (`docs/sources/it-administracji/FINDINGS.md`, sekcja 6.1) wskazuje też wariant centralny prowadzony przez KPRM lub COI dla urzędów bez działu IT. Dlatego każda tabela z danymi domenowymi ma kolumnę `office_id`, a polityki RLS izolują dane między urzędami. Dodanie tej kolumny po fakcie wymagałoby migracji danych i przepisania wszystkich polityk RLS, więc koszt robimy od razu.

## Wyjątek: dane referencyjne

Oficjalne wersje przepisów w `regulation_versions` są wspólne dla wszystkich urzędów, więc mają `office_id` równe `null` i `is_official = true`. Czyta je każde konto należące do urzędu, a zmienić ich nie może nikt, także rola serwisowa (wyzwalacz w bazie, ADR 0006). Lokalne klony wersji przepisów mają `office_id` urzędu jak każda inna tabela domenowa. Decyzję o dostępie do obu rodzajów nadal podejmuje `access.can`. Kolejne tabele referencyjne bez `office_id` wymagają dopisania ich tutaj.
