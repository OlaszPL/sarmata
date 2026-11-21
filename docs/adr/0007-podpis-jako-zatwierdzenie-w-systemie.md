# Podpis arkusza to zatwierdzenie w systemie przez oceniającego

Mentorzy KPRM odpowiedzieli 21.11.2026, że podpis pod oceną w wersji cyfrowej to zatwierdzenie w systemie (`docs/wymagania-i-kontekst.md`, sekcja 21, pytanie 2). Oceniany nie ma konta w aplikacji (`docs/funkcjonalnosci.md`, sekcja „Użytkownicy i role”), więc w systemie zatwierdza oceniający, a potwierdzenia ocenianego (podpis części I, zapoznanie z oceną, odmowa podpisu) oceniający odnotowuje z faktyczną datą. Nie integrujemy profilu zaufanego, podpisu osobistego, PAdES ani Węzła Podpisu. Wydruk PDF zostaje jako opcja dla urzędu, który chce mieć egzemplarz papierowy.

## Co system zapewnia zamiast podpisu

Każde zatwierdzenie (części I, rozmowy, oceny, zapoznania) to wpis w niezmienialnym dzienniku zdarzeń oceny (`evaluation_events`, tylko dopisywanie) zawierający:

- konto, które zatwierdziło (`recorded_by`, z uwierzytelnienia Supabase Auth),
- znacznik czasu wpisu (`recorded_at`) i faktyczną datę zdarzenia (`occurred_on`),
- numer wersji arkusza i skrót SHA-256 jego treści w chwili zatwierdzenia (w `payload`), więc późniejsza zmiana treści jest wykrywalna,
- zablokowaną wersję arkusza: poprawka tylko przez administratora jako nowa wersja z powodem.

To odpowiada wymaganiom rozliczalności i integralności: § 20 rozporządzenia o Krajowych Ramach Interoperacyjności (logi z identyfikacją osób) oraz § 9 rozporządzenia MRPiPS w sprawie dokumentacji pracowniczej (ochrona integralności, identyfikacja osób, rejestr zmian dokumentacji prowadzonej elektronicznie).

## Konsekwencje

- Decyzja jest trudna do odwrócenia: dodanie podpisu kwalifikowanego albo zaufanego później wymaga nowego kroku procesu, przechowywania podpisanych plików i weryfikacji podpisu.
- Orzecznictwo (SO Łódź VIII Pa 416/24) uznało samo powiadomienie w EZD za niewystarczające zapoznanie „na piśmie”. Ryzyko przejmuje urząd. Aplikacja ułatwia wydruk do podpisu odręcznego, gdy urząd go wymaga.

## Odrzucone

- **Podpis zaufany albo kwalifikowany (PAdES) przez gov.pl:** zależność zewnętrzna, nie działa offline, PESEL zapisany w pliku, a mentorzy go nie wymagają.
- **Lekkie konto ocenianego do potwierdzeń:** odrzucone przez właściciela produktu. Aplikacja służy oceniającemu.

## Uzupełnienie 21.11.2026

- Wydruk „jako opcja dla urzędu” ma postać parametru `podpis=1` (`signatureBox`) w eksporcie arkusza i zawiadomienia: dokument dostaje puste pola na podpis odręczny, a zatwierdzenia z dziennika zostają w treści (`docs/funkcjonalnosci.md`, sekcja „Eksport”).
- Sformułowanie „tylko dopisywanie” ma jeden wyjątek: po 10 latach od końca roku ustania zatrudnienia anonimizacja pracownika usuwa jego dziennik zdarzeń w transakcji ze znacznikiem `lifecycle.purge_marker`, który ustawia wyłącznie funkcja `anonymize_employee` dla roli serwisowej. Zatwierdzenia są więc nieusuwalne przez klientów i przez właściciela bazy poza tą drogą.
