# Cyfrowy Asystent Ocen Okresowych

Narzędzie dla urzędów służby cywilnej do prowadzenia ocen okresowych według ustawy o służbie cywilnej i rozporządzenia z 2016 r., z modułem wirtualnego HR partnera.

## Organizacja i tożsamość

**Urząd** (`Office`):
Jednostka, w której działa korpus służby cywilnej i która jest pracodawcą ocenianych. Wszystkie dane domenowe należą do dokładnie jednego urzędu.
_Avoid_: tenant, organizacja, instytucja

**Konto** (`Account`):
Dostęp do aplikacji jednej osoby, używany do logowania i ustalania, kto wykonał czynność.
_Avoid_: użytkownik (gdy chodzi o osobę z danych kadrowych)

**Pracownik** (`Employee`):
Osoba z danych kadrowych urzędu, której mogą dotyczyć oceny. Może istnieć bez konta.
_Avoid_: użytkownik, konto

**Członkostwo** (`Membership`):
Przypisanie konta do urzędu z określoną rolą (administrator, kadry albo oceniający).
_Avoid_: uprawnienie, przynależność

**Administrator** (`admin`):
Rola członka urzędu, który zarządza kontami i ustawieniami urzędu.
_Avoid_: admin (w tekstach dla użytkownika), superużytkownik

**Kadry** (`hr`):
Rola członka urzędu, który prowadzi sprawy ocen okresowych od strony komórki kadrowej.
_Avoid_: HR (w tekstach dla użytkownika), kadrowy

**Oceniający** (`evaluator`, `evaluator_account_id`):
Rola członka urzędu, który ocenia podległych pracowników. W konkretnej ocenie to konto przypięte do niej jako prowadzące ocenę, zapisane jako relacja oceny (`evaluator_account_id`). Zwykle jest nim bezpośredni przełożony ocenianego.
_Avoid_: przełożony, ewaluator, kierownik

## Przepisy

**Wersja przepisów** (`RegulationVersion`):
Komplet reguł oceny (arkusze, kryteria, skala, terminy) obowiązujący od określonej daty. Każda ocena podlega jednej wersji przepisów, ustalonej w dniu jej rozpoczęcia.
_Avoid_: konfiguracja, ustawienia, polityka

**Szkic przepisów** (`status 'draft'` w `regulation_versions`):
Lokalna wersja przepisów urzędu w edycji. Admin klonuje do niego opublikowaną wersję, zmienia parametry i publikuje z datą obowiązywania. Szkic nie może być przypięty do oceny. Po publikacji wersja jest niezmienna.
_Avoid_: kopia robocza, wersja testowa

**Przypadek testowy przepisów** (`RegulationCase`):
Przykład z oczekiwanym wynikiem, na którym sprawdzamy wersję przepisów: termin do policzenia albo arkusz do oceny. Oficjalne przypadki żyją w `backend/regulations/<wersja>/cases.json`, a szkic urzędu jest sprawdzany przypadkami oficjalnego korzenia.
_Avoid_: test jednostkowy, scenariusz

**Katalog szkoleń** (`trainingCatalog`):
Lista 249 szkoleń i działań rozwojowych służby cywilnej przypisanych do kryteriów oceny. Służy do podpowiedzi do IPRZ. Urząd nie dodaje własnych pozycji.
_Avoid_: oferta szkoleniowa, baza szkoleń

## Ocena

**Ocena** (`Evaluation`, `evaluation`):
Jedna ocena okresowa jednego pracownika, prowadzona według przypiętej wersji przepisów od rozpoczęcia do zamknięcia.
_Avoid_: ewaluacja, arkusz (arkusz to dokument oceny)

**Przełożony** (`Supervisor`, `supervisor_employee_id`):
Opcjonalny bezpośredni przełożony pracownika w drzewie urzędu. Gdy jest ustawiony i ma konto, jest domyślnym oceniającym.
_Avoid_: szef, kierownik komórki

**Oceniany** (`EvaluatedEmployee`, `employee_id`):
Pracownik, którego dotyczy ocena. Nie ma dostępu do aplikacji.
_Avoid_: użytkownik

**Zdarzenie oceny** (`EvaluationEvent`, `evaluation_event`):
Fakt z przebiegu oceny (np. rozmowa, podpis, doręczenie, sprzeciw) wpisany z datą faktyczną przez oceniającego albo kadry. Od dat zdarzeń liczy się terminy.
_Avoid_: log, akcja

**Notatka** (`Note`, `note`):
Obserwacja oceniającego z okresu oceny o konkretnym pracowniku. Czyta ją autor, kadry i bieżący oceniający otwartej oceny tego pracownika, a przy widoczności `tree` także przełożeni w drzewie. Edytuje ją tylko autor.
_Avoid_: komentarz, uwaga

**Arkusz** (`EvaluationSheet`, `evaluation_sheet`):
Treść arkusza A, B albo C jednej oceny, wypełniana w trakcie oceny. Dokument oceny, nie sama ocena.
_Avoid_: formularz, ankieta

**Wersja arkusza** (`version`):
Numer wersji arkusza. Edycje roboczej wersji nadpisują ją w miejscu. Zablokowanie arkusza nie zmienia numeru. Nowa wersja powstaje dopiero przy korekcie albo sprzeciwie, a poprzednie zostają do odczytu.
_Avoid_: kopia, edycja

**Rodzaj stanowiska** (`PositionKind`, `position_kind`):
Cecha stanowiska pracownika (szef urzędu, stanowisko z kierowaniem ludźmi albo inne), która wyznacza, jaki arkusz obowiązuje.
_Avoid_: typ stanowiska, poziom

**Rodzaj notatki** (`NoteKind`, `note_kind`):
Typ notatki: obserwacja, rozmowa bieżąca, docenienie albo fakt obciążenia.
_Avoid_: kategoria notatki

**Wersja notatki** (`NoteVersion`, `note_versions`):
Poprzednia treść notatki zachowana po edycji. Czas wpisu notatki się nie zmienia.
_Avoid_: kopia notatki

**Ustawienia urzędu** (`OfficeSettings`, `office_settings`):
Jeden wiersz na urząd: przełącznik AI, okres przechowywania notatek, wyprzedzenie przypomnień, SMTP, domyślna miejscowość i adresat sprzeciwu na arkuszu A. Zmienia je admin. Hasło SMTP leży w Supabase Vault i nie wraca do klienta.
_Avoid_: konfiguracja

**Powiadomienie** (`Notification`, `notifications`):
Przypomnienie albo zadanie w skrzynce konta, powstające raz dziennie z terminów ocen. Czyta je tylko adresat, także bez SMTP.
_Avoid_: alert, komunikat

**Zadanie kadr** (`NotificationCategory 'task'`):
Powiadomienie, które zostaje otwarte do chwili, gdy jego termin przestaje obowiązywać: termin po upływie, decyzja w sprawie sprzeciwu albo stopień z mocy prawa. Zbieracz sam zamyka je ze statusem `resolved`.
_Avoid_: ticket

**Zbiorczy mail** (`notification_digests`):
Jedna wiadomość e-mail na konto i dzień z liczbą zadań, najbliższym terminem i linkiem do skrzynki. Bez danych osobowych i bez treści oceny.
_Avoid_: newsletter

**Zamknięcie automatyczne** (`closed` z `payload.automatic = true`):
Zamknięcie oceny doręczonej, w której po 7 dniach nie wniesiono sprzeciwu. Wykonuje je system (autor systemowy), a wpis trafia do dziennika zdarzeń i do logu workera.
_Avoid_: archiwizacja

**Wynik oceny** (`EvaluationResult`, `evaluation_results`):
Poziom i wynik bieżącej zablokowanej wersji arkusza, liczone przez kalkulator w `@sarmata/domain`. Przechowywane tylko na potrzeby statystyk, przeliczane przy każdym raporcie, więc po korekcie arkusza stary wiersz się nie liczy.
_Avoid_: ocena końcowa, punktacja

**Odwołanie do sądu pracy** (`labour_court_appeal`):
Zdarzenie oceny po nieuwzględnionym sprzeciwie (art. 83 ust. 5 ustawy). Zapisują je tylko kadry. Źródło pytania 14 sprawozdania DSC-OCK.
_Avoid_: pozew, skarga

**Przyznanie stopnia** (`GradeGrant`, `grade_grants`):
Wpis kadr o przyznaniu urzędnikowi kolejnego stopnia służbowego. Podstawa `on_request` to art. 89 ust. 1 ustawy (na wniosek), `by_law` to art. 89 ust. 2 (z mocy prawa, po kolejnych ocenach na wymaganym poziomie). Zmienia stopień pracownika i zamyka zadanie kadr.
_Avoid_: awans, podwyżka

**Przebieg AI** (`AiRun`, `ai_runs`):
Jedno wywołanie usługi AI (szkic arkusza, kontrola jakości, strażnik danych wrażliwych, przygotowanie rozmowy, propozycje kryteriów, momenty docenienia, sygnały HR partnera, asystent procedury). Naraz wpis dziennika użycia AI i stan zadania w kolejce: kto prosił, kiedy, migawka wejścia, wynik albo przyczyna porażki, wersja promptu. Wynik to sugestia.
_Avoid_: zapytanie AI, log AI

**Decyzja o fragmencie AI** (`AiFragmentDecision`, `ai_fragment_decisions`):
Przyjęcie, edycja albo odrzucenie jednego fragmentu wyniku przebiegu AI przez człowieka, z tekstem po edycji. Ostatnia decyzja o fragmencie wygrywa.
_Avoid_: akceptacja AI

**Sygnał HR partnera** (`hr_signals`):
Sugestia dla oceniającego o sentymencie, przeciążeniu, spadku zaangażowania albo ryzyku wypalenia, z prawdopodobieństwem i fragmentami notatek źródłowych. Nigdy diagnoza. Decyduje człowiek.
_Avoid_: diagnoza, ocena stanu pracownika
