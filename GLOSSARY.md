# Cyfrowy Asystent Ocen Okresowych

Narzędzie dla urzędów służby cywilnej do prowadzenia ocen okresowych według ustawy o służbie cywilnej i rozporządzenia z 2016 r., z modułem wirtualnego HR partnera.

## Organizacja i tożsamość

**Urząd**:
Jednostka, w której działa korpus służby cywilnej i która jest pracodawcą ocenianych. Wszystkie dane domenowe należą do dokładnie jednego urzędu.
_Avoid_: tenant, organizacja, instytucja

**Konto**:
Dostęp do aplikacji jednej osoby, używany do logowania i ustalania, kto wykonał czynność.
_Avoid_: użytkownik (gdy chodzi o osobę z danych kadrowych)

**Pracownik**:
Osoba z danych kadrowych urzędu, której mogą dotyczyć oceny. Może istnieć bez konta.
_Avoid_: użytkownik, konto

**Członkostwo**:
Przypisanie konta do urzędu z określoną rolą (np. kadry, administrator).
_Avoid_: uprawnienie, przynależność

## Przepisy

**Wersja przepisów**:
Komplet reguł oceny (arkusze, kryteria, skala, terminy) obowiązujący od określonej daty. Każda ocena podlega jednej wersji przepisów, ustalonej w dniu jej rozpoczęcia.
_Avoid_: konfiguracja, ustawienia, polityka
