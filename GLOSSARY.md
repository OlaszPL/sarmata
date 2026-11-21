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

**Wersja przepisów urzędu** (`regulation_versions` z `office_id`, `is_official = false`):
Lokalna wersja przepisów powstała w edytorze reguł jako klon wersji oficjalnej i opublikowana z datą obowiązywania. Obowiązuje ta wersja (oficjalna albo urzędu) z najpóźniejszą datą nie późniejszą niż dzień rozpoczęcia oceny, przy równej dacie wygrywa wersja urzędu. Wersja oficjalna (`is_official = true`, bez `office_id`) jest wspólna dla urzędów i niezmienna.
_Avoid_: własne przepisy, nadpisanie reguł

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

**Zdarzenie oceny** (`EvaluationEvent`, `evaluation_events`):
Fakt z przebiegu oceny (np. rozmowa, podpis, doręczenie, sprzeciw) wpisany z datą faktyczną przez oceniającego albo kadry. Od dat zdarzeń liczy się terminy. Zdarzenia tworzą dziennik zdarzeń oceny, który jest tylko do dopisywania.
_Avoid_: log, akcja

**Stan oceny** (`EvaluationStatus`, `evaluations.status`):
Etap oceny: `criteria`, `criteria_awaiting_signature`, `period`, `interview`, `drafted`, `delivered`, `closed`, `objection` albo `interrupted`. Każde przejście to zdarzenie w dzienniku z datą faktyczną, a tabela przejść jest jedna (`evaluationTransitions` w `@sarmata/domain` i `evaluation_transitions()` w SQL). `closed` i `interrupted` są końcowe.
_Avoid_: status oceny, faza

**Zatwierdzenie** (`part_one_approved`, `sheet_approved` i pokrewne zdarzenia):
Czynność oceniającego w systemie zamiast podpisu (ADR 0007): zalogowane konto, znacznik czasu, numer wersji arkusza i skrót SHA-256 jego treści. Potwierdzenia ocenianego (podpis części I, zapoznanie, odmowa podpisu) oceniający odnotowuje z faktyczną datą.
_Avoid_: podpis elektroniczny, podpis cyfrowy

**Sprzeciw** (`objection`, zdarzenie `objection_filed`, stan `objection`):
Sprzeciw ocenianego od oceny wniesiony w 7 dni od zapoznania (art. 83 ust. 1 ustawy). Całą ścieżkę rejestrują kadry. Wynik (`ObjectionOutcome`) to `rejected` (ocena zostaje), `changed` (nowa wersja arkusza, bez obniżenia oceny, zamyka ocenę) albo `redraft` (wersja anulowana, ocena wraca do rozmowy oceniającej). Adresat sprzeciwu to parametr arkusza.
_Avoid_: odwołanie (odwołanie do sądu pracy to osobne pojęcie), reklamacja

**Termin** (`DeadlineSlot`, `evaluation_deadlines`):
Zapisany termin kroku oceny (np. rozmowa rozpoczynająca, sporządzenie oceny, sprzeciw, decyzja DG, stopień z mocy prawa) liczony silnikiem terminów z dat faktycznych według strategii z wersji przepisów. Zbieracz powiadomień czyta zapisane terminy, nie liczy ich od nowa. Termin może być wstrzymany (długotrwała nieobecność).
_Avoid_: deadline, data graniczna

**Ocena archiwalna** (`ArchivedEvaluation`):
Ocena sprzed wdrożenia systemu wpisana ręcznie przez kadry albo oceniającego: data sporządzenia, wynik, poziom, opcjonalnie oceny cząstkowe. Nie ma przebiegu ani arkusza, wlicza się do sygnału stopnia z mocy prawa i do statystyk.
_Avoid_: import historii, skan oceny

**Teczka sprawy** (`case_file`, adres `teczka`):
Archiwum ZIP jednej oceny do sprzeciwu i sądu: bieżący arkusz, wszystkie wersje arkusza, dziennik zdarzeń w PDF i CSV, zawiadomienia o zmianie terminu i `manifest.json` ze skrótami SHA-256. Powstaje na żądanie, nie jest przechowywana.
_Avoid_: akta, paczka dokumentów

**Archiwum teczek pracownika** (`exportEmployeeArchive`):
ZIP z teczką sprawy każdej oceny pracownika i manifestem. Kadry pobierają je przed anonimizacją po ustaniu zatrudnienia.
_Avoid_: kopia zapasowa

**Paczka EZD** (`ezd_package`, adres `paczka-ezd`):
ZIP zatwierdzonej oceny z arkuszem i zawiadomieniami w PDF/A-2a oraz metadanymi XML (w tym znak sprawy wpisany ręcznie). Przekazanie do systemu EZD urzędu.
_Avoid_: eksport do EZD

**Długotrwała nieobecność** (`recordAbsence`, art. 81 ust. 7 ustawy):
Okres nieobecności ocenianego albo oceniającego wpisany jako zdarzenie boczne oceny: od, opcjonalnie do. Okresy rozdzielone tylko dniami wolnymi się sklejają. Bez daty końca termin jest wstrzymany, po powrocie przesuwa się o dni nieobecności.
_Avoid_: urlop, zwolnienie lekarskie

**Strażnik danych wrażliwych** (`sensitiveDataWarnings`, usługa AI `sensitive_data`):
Kontrola treści notatki pod kątem zdrowia, rodziny, religii i diagnoz. Przed zapisem front woła `notes.check`: słownik słów kluczowych odpowiada od razu, a przebieg AI zwraca ostrzeżenia i propozycję przeformułowania całej notatki, którą autor przyjmuje, edytuje albo odrzuca. Sam zapis blokuje tylko słownik (`sensitive_data`, potwierdzenie przez `acceptWarnings`).
_Avoid_: cenzura, filtr


**Notatka** (`Note`, `note`):
Obserwacja oceniającego z okresu oceny o konkretnym pracowniku. Czyta ją autor, kadry i bieżący oceniający otwartej oceny tego pracownika, a przy widoczności `tree` także przełożeni w drzewie. Edytuje ją tylko autor.
_Avoid_: komentarz, uwaga

**Arkusz** (`EvaluationSheet`, `evaluation_sheet`):
Treść arkusza A, B albo C jednej oceny, wypełniana w trakcie oceny. Dokument oceny, nie sama ocena.
_Avoid_: formularz, ankieta

**Wersja arkusza** (`version`, stany `draft`, `locked`, `superseded`, `cancelled`):
Numer wersji arkusza. Edycje roboczej wersji nadpisują ją w miejscu. Zablokowanie arkusza nie zmienia numeru. Nowa wersja powstaje dopiero przy korekcie zablokowanych pól (tylko admin, z powodem) albo sprzeciwie, a poprzednie zostają do odczytu jako zastąpione (`superseded`) albo anulowane po ponownym sporządzeniu (`cancelled`).
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
Jeden wiersz na urząd: przełącznik AI, okres przechowywania notatek, wyprzedzenie przypomnień, próg „długo bez docenienia”, progi flag per oceniający, SMTP, domyślna miejscowość i adresat sprzeciwu na arkuszu A. Zmienia je admin. Hasło SMTP leży w Supabase Vault i nie wraca do klienta.
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

**Ustanie zatrudnienia** (`employees.employment_ended_on`, `employee_retention`):
Oznaczenie przez kadry, że stosunek pracy pracownika się zakończył. Przerywa otwarte oceny, kończy dostęp konta i uruchamia zegar przechowywania dokumentacji: 10 lat od końca roku kalendarzowego ustania (art. 94 pkt 9b KP).
_Avoid_: zwolnienie, usunięcie pracownika

**Retencja treści** (`purge_expired_content`):
Usuwanie notatek oraz treści przebiegów AI po okresie z ustawień urzędu (`notesRetentionMonths`). Metadane przebiegów AI zostają. Skrócenie okresu działa wstecz.
_Avoid_: czyszczenie bazy, archiwizacja notatek

**Anonimizacja pracownika** (`anonymize_employee`):
Jednorazowa operacja po upływie 10 lat: usuwa oceny, arkusze, dziennik zdarzeń, notatki, treść AI, dane osobowe rekordu i konto logowania, zostawia fakty do statystyk. Rekord pracownika zostaje jako anonimowy, z tym samym identyfikatorem.
_Avoid_: usunięcie danych, kasowanie konta

**Fakty zachowane** (`retained_evaluation_facts`, `retained_grade_grants`):
Dane oceny i przyznania stopnia bez osoby (rok, komórka, poziom, wynik, punkty cząstkowe), które zostają po anonimizacji i zasilają raporty statystyk.
_Avoid_: kopia oceny
