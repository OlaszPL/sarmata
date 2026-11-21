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

**Oceniający** (`evaluator`):
Rola członka urzędu, który ocenia podległych pracowników.
_Avoid_: przełożony, ewaluator

## Przepisy

**Wersja przepisów** (`RegulationVersion`):
Komplet reguł oceny (arkusze, kryteria, skala, terminy) obowiązujący od określonej daty. Każda ocena podlega jednej wersji przepisów, ustalonej w dniu jej rozpoczęcia.
_Avoid_: konfiguracja, ustawienia, polityka

## Ocena

**Ocena**:
Jedna ocena okresowa jednego pracownika, prowadzona według przypiętej wersji przepisów od rozpoczęcia do zamknięcia.
_Avoid_: ewaluacja, arkusz (arkusz to dokument oceny)

**Oceniający**:
Konto przypięte do konkretnej oceny, które ją prowadzi. To bezpośredni przełożony ocenianego, zapisany jako relacja oceny, nie rola w urzędzie.
_Avoid_: kierownik

**Przełożony**:
Opcjonalny bezpośredni przełożony pracownika w drzewie urzędu. Gdy jest ustawiony i ma konto, jest domyślnym oceniającym.
_Avoid_: szef, kierownik komórki

**Oceniany**:
Pracownik, którego dotyczy ocena. Nie ma dostępu do aplikacji.
_Avoid_: użytkownik

**Rola**:
Uprawnienie członkostwa w urzędzie: oceniający, kadry albo admin.
_Avoid_: grupa, poziom dostępu

**Zdarzenie oceny**:
Fakt z przebiegu oceny (np. rozmowa, podpis, doręczenie, sprzeciw) wpisany z datą faktyczną przez oceniającego albo kadry. Od dat zdarzeń liczy się terminy.
_Avoid_: log, akcja

**Notatka**:
Obserwacja oceniającego z okresu oceny o konkretnym pracowniku. Czyta ją autor i kadry.
_Avoid_: komentarz, uwaga

**Arkusz**:
Treść arkusza A, B albo C jednej oceny, wypełniana w trakcie oceny. Dokument oceny, nie sama ocena.
_Avoid_: formularz, ankieta

**Wersja arkusza**:
Kolejny numer zapisu arkusza. Każda zmiana tworzy nową wersję, a poprzednie zostają do odczytu.
_Avoid_: kopia, edycja

**Rodzaj stanowiska**:
Cecha stanowiska pracownika (szef urzędu, stanowisko z kierowaniem ludźmi albo inne), która wyznacza, jaki arkusz obowiązuje.
_Avoid_: typ stanowiska, poziom
