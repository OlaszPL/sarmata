# Każda tabela domenowa ma urzad_id od pierwszej migracji

Domyślnie wdrażamy jedną instalację na urząd, ale research (`docs/sources/it-administracji/FINDINGS.md`, sekcja 6.1) wskazuje też wariant centralny prowadzony przez KPRM lub COI dla urzędów bez działu IT. Dlatego każda tabela z danymi domenowymi ma kolumnę `urzad_id`, a polityki RLS izolują dane między urzędami. Dodanie tej kolumny po fakcie wymagałoby migracji danych i przepisania wszystkich polityk RLS, więc koszt robimy od razu.
