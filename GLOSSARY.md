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
Obserwacja oceniającego z okresu oceny o konkretnym pracowniku. Czyta ją autor i kadry.
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
