# Cyfrowy Asystent Ocen Okresowych: wymagania, kontekst i podstawa prawna

Zbiorczy dokument roboczy. Łączy treść wyzwania z [general-info.md](general-info.md), wymagania wynikające z przepisów i materiały ze stron służby cywilnej. Każdy fakt prawny ma wskazany przepis albo źródło. Stan prawny na 21.11.2026.

**Akty prawne z general-info w czystym Markdown** (podstawa całego projektu):

- [legal/ustawa-o-sluzbie-cywilnej-tj-2026.md](legal/ustawa-o-sluzbie-cywilnej-tj-2026.md): ustawa o SC, Dz.U. 2026 poz. 590 t.j., pełny tekst, artykuły jako nagłówki (kluczowe: art. 81 do 83, 89, 108),
- [legal/rozporzadzenie-oceny-okresowe-2016.md](legal/rozporzadzenie-oceny-okresowe-2016.md): rozporządzenie PRM, Dz.U. 2016 poz. 470, § 1 do 14, wykaz 14 kryteriów, struktura arkuszy A, B, C z dosłownymi przypisami,
- [legal/zarzadzenie-6-szefa-sc-2020-standardy-zzl.md](legal/zarzadzenie-6-szefa-sc-2020-standardy-zzl.md): standardy ZZL, części I do VII (system informacji zwrotnej: cz. IV pkt 6),
- [legal/oceny-okresowe-dane.yaml](legal/oceny-okresowe-dane.yaml): reguły w formie maszynowej.

Pozostałe akty (KP, RODO, AI Act, KRI i inne) jako tekst w `archive/docs/legal/text/`, oryginały PDF w `archive/docs/legal/raw/` (oba foldery w `.gitignore`). Notatki tematyczne: `sources/*/FINDINGS.md`, mapa w [sources/README.md](sources/README.md).

Spis treści

1. Wyzwanie w skrócie
2. Kontekst i problemy, które rozwiązujemy
3. Użytkownicy i role
4. Wymagania funkcjonalne z wyzwania
5. Wymagania techniczne i niefunkcjonalne
6. Zgłoszenie, walidacja, kryteria oceny jury
7. Proces oceny okresowej według przepisów
8. Arkusze A, B, C: pola formularzy
9. Kryteria oceny (14) z opisami
10. Reguły biznesowe do zakodowania
11. Indywidualny program rozwoju zawodowego, szkolenia, stopnie służbowe
12. Pierwsza ocena (proces pokrewny)
13. Standardy ZZL i system informacji zwrotnej (zarządzenie nr 6 Szefa SC)
14. Planowane zmiany przepisów
15. Strategia ZZL w służbie cywilnej do 2034 r.
16. Materiały i praktyka Departamentu Służby Cywilnej
17. Dokumentacja pracownicza w postaci elektronicznej i podpisy
18. Ochrona danych osobowych
19. AI Act i polska ustawa o systemach AI
20. Dostępność cyfrowa, interoperacyjność, bezpieczeństwo
21. Otwarte pytania do mentorów
22. Rejestr źródeł i status pobrania
23. Kontakty

---

## 1. Wyzwanie w skrócie

Organizator: KPRM, Departament Służby Cywilnej. Zadanie: zbudować cyfrowe rozwiązanie do ocen okresowych w służbie cywilnej z modułem wirtualnego HR partnera.

Rozwiązanie ma:

- zautomatyzować i scyfryzować proces oceny, uprościć formalności,
- analizować dane i rekomendować działania, czyli wspierać osoby zarządzające ludźmi jako wirtualny HR partner,
- prowadzić cały proces: wybór arkusza i kryteriów, rozmowy, notatki z okresu oceny, cyfrowa wersja oceny, rekomendacje rozwojowe,
- być dostępne dla wszystkich urzędów służby cywilnej, tak aby każdy urząd mógł je wdrożyć u siebie.

Cel jakościowy: ocena ma przestać być obowiązkiem administracyjnym i stać się narzędziem rozwoju i zarządzania zespołem.

KPRM planuje wdrożyć najlepsze rozwiązania w całości lub w części. Najlepszy zespół zostanie zaproszony do dalszego rozwoju projektu.

Dlaczego teraz (szczegóły w sekcjach 14 i 15):

- Strategia ZZL w SC do 2034 r. ma inicjatywę 7.4 „HACKATHON kadrowy” (2026 do 2028, budżet 100 000 zł) oraz cel cyfrowych narzędzi ZZL udostępnianych urzędom przez Szefa SC.
- Projekt nowelizacji ustawy o SC (UDER102) skraca cykl ocen do 12 miesięcy, zmienia skalę na 3 poziomy i dopuszcza arkusz elektroniczny. Uzasadnienie zapowiada narzędzie cyfrowe do ocen dla urzędów.
- Projekt TSI z lipca 2026 r. ma już katalog wymagań biznesowych dla cyfrowej oceny okresowej (WB.OO-1 do WB.OO-4).

## 2. Kontekst i problemy, które rozwiązujemy

Skala (general-info, sekcja 1):

- ok. 1743 urzędy z korpusem służby cywilnej,
- ok. 123 tys. osób,
- bardzo różne instytucje: ministerstwa, urzędy centralne, urzędy wojewódzkie, urzędy skarbowe, inspekcje, komendy, również jednostki terenowe na szczeblu wojewódzkim i powiatowym.

Stan obecny według organizatora:

- ocena najczęściej papierowa, czasem odręczna. Dla wielu urzędów problemem jest obieg dokumentacji cyfrowej i poświadczeń (podpisów),
- oceniający traktują ocenę jako formalny obowiązek,
- uwaga idzie na terminy, formularze i zgodność z przepisami zamiast na jakość oceny,
- oceniającym brakuje kompetencji do dawania wartościowej informacji zwrotnej (komunikacja, zarządzanie ludźmi, motywowanie, rozwój).

Konkretne trudności oceniających:

1. wybór dodatkowych kryteriów oceny,
2. sformułowanie wymagań (oczekiwań) w zakresie kryteriów,
3. informacja zwrotna w czasie rozmowy oceniającej,
4. obiektywność ocen,
5. planowanie działań rozwojowych (wnioski do IPRZ).

Dodatkowe wyzwania: dobrostan pracowników, sygnały przeciążenia i ryzyko wypalenia zawodowego.

## 3. Użytkownicy i role

Z wyzwania (general-info, sekcja 3):

| Rola | Kto | Co robi w procesie |
|---|---|---|
| Oceniający | bezpośredni przełożony ocenianego (art. 81 ust. 1 ustawy o SC, § 2 ust. 1 rozporządzenia) | wybiera kryteria dodatkowe, prowadzi rozmowy, obserwuje, sporządza ocenę, formułuje wnioski do IPRZ, może wnioskować o stopień służbowy |
| Oceniany | urzędnik SC albo pracownik SC na umowie na czas nieokreślony (art. 81 ust. 1) | uczestniczy w rozmowach, podpisuje potwierdzenia, może złożyć sprzeciw, może wnioskować o zmianę terminu oceny (art. 81 ust. 8 pkt 4) |
| Komórka kadrowa (HR) | pracownicy kadr urzędu | koordynuje proces, pilnuje terminów, prowadzi akta osobowe, do których trafia oryginał arkusza (§ 6 ust. 3, § 12 ust. 2 rozporządzenia) |
| Dyrektor generalny urzędu (albo kierownik urzędu, gdy nie ma stanowiska DG) | | rozpatruje sprzeciw w 14 dni (art. 83), zatwierdza IPRZ (art. 108 ust. 2), wgląd w statystyki |
| Kierujący komórką organizacyjną | | akceptuje IPRZ (art. 108 ust. 2) |
| Inne osoby z wglądem w statystyki | np. dyrektor generalny, kierownik urzędu | dane zagregowane |

Uwagi do modelu ról:

- Arkusz A dotyczy kierownika urzędu, gdy jego stanowisko jest stanowiskiem w służbie cywilnej. Oceniającym jest wtedy jego przełożony spoza urzędu, a pole „sprzeciw do:” w pouczeniu arkusza A jest do uzupełnienia (nie ma tam domyślnie dyrektora generalnego). Źródło: wzór arkusza A, załącznik nr 2 do rozporządzenia.
- Przy zmianie oceniającego w trakcie okresu ocena jest sporządzana na podstawie wcześniej wybranych kryteriów (§ 9 ust. 3 rozporządzenia). Oceniający może też w tej sytuacji zmienić termin oceny (art. 81 ust. 8 pkt 1).
- Osoby na wyższych stanowiskach w SC nie mają ustalanego IPRZ (art. 108 ust. 1).

## 4. Wymagania funkcjonalne z wyzwania

Identyfikatory nadane na potrzeby pracy zespołu. Źródło wszystkich pozycji: general-info, sekcja 3.

### 4.1. Moduł ocen okresowych (automatyzacja procesu)

| ID | Wymaganie |
|---|---|
| F-01 | Cały proces oceny w formie cyfrowej, bez dokumentów papierowych |
| F-02 | Odwzorowanie wszystkich pól arkuszy (A, B, C, w tym część III z wnioskiem o stopień służbowy) |
| F-03 | Wgląd do arkuszy dla uprawnionych osób i możliwość edycji |
| F-04 | Wydruk formularza oceny |
| F-05 | Wybór odpowiedniego arkusza A, B albo C zależnie od rodzaju stanowiska |
| F-06 | Wybór kryteriów dodatkowych, maksymalnie 3 |
| F-07 | Przygotowanie do rozmowy rozpoczynającej ocenę i do rozmowy oceniającej: cel rozmowy, propozycje pytań i tematów, podpowiedzi komunikacyjne (np. trudne sytuacje), plan przebiegu, uporządkowanie treści |
| F-08 | Wsparcie bieżących rozmów z informacją zwrotną (nieobowiązkowe w przepisach, ale zalecany standard ZZL, przypis 2 general-info) |
| F-09 | Notatki i obserwacje w trakcie okresu oceny (co do zasady 24 miesiące), wykorzystywane potem do oceny i do przygotowania rozmowy oceniającej |
| F-10 | Wsparcie w formułowaniu treści oceny na podstawie obserwacji, danych i decyzji oceniającego. Asystent nie zastępuje przełożonego. Porządkuje informacje, wskazuje elementy wymagane przepisami, pomaga jasno i spójnie opisać wyniki, może wskazywać zależności i na co zwrócić uwagę |
| F-11 | Eksport oceny do pliku |
| F-12 | Obsługa sytuacji kadrowych i ich konsekwencji: zmiana oceniającego, zmiana zadań (stanowiska), długotrwała nieobecność |
| F-13 | Integracja albo współpraca z systemami elektronicznego zarządzania dokumentacją (EZD) lub programami e-mail |

### 4.2. Część rozwojowa oceny

| ID | Wymaganie |
|---|---|
| F-20 | Podpowiedzi, jak formułować konstruktywną informację zwrotną |
| F-21 | Sugestie szkoleń, form wsparcia i działań rozwojowych na podstawie obszarów do rozwoju |
| F-22 | Pomoc w opisie mocnych stron i obszarów do rozwoju |
| F-23 | Wskazówki, jak przełożyć wyniki oceny na codzienne zarządzanie zespołem |

### 4.3. Automatyzacja i uproszczenie formalności

| ID | Wymaganie |
|---|---|
| F-30 | Przypomnienia o terminach |
| F-31 | Automatyczne podpowiadanie wymaganych elementów oceny |
| F-32 | Minimalizacja ryzyka błędów formalnych |
| F-33 | Prowadzenie użytkownika krok po kroku przez etapy oceny |
| F-34 | Generowanie treści zgodnych z przepisami |

### 4.4. Moduł wirtualnego HR partnera (element innowacyjny, osobno oceniany)

Wspiera przełożonego w zarządzaniu ludźmi szerzej niż sama ocena. Może używać AI do analizy sytuacji pracownika, wskazywania ryzyk, sugerowania działań i wsparcia decyzji.

| ID | Wymaganie |
|---|---|
| F-40 | Analiza danych o zadaniach pracownika i ich realizacji (charakter zadań, zmiany zakresu obowiązków) |
| F-41 | Wsparcie rozmów o kondycji pracownika |
| F-42 | Podpowiedzi działań wspierających dobrostan (zmiana priorytetów, przerwa w projektach, rozmowa wspierająca) |
| F-43 | Działania rozwojowe przeciwdziałające wypaleniu |
| F-44 | Wskazywanie sygnałów przeciążenia, spadku motywacji, ryzyka wypalenia |
| F-45 | Sugestie rozwiązań organizacyjnych (podział zadań, wsparcie zespołu, mentoring) |
| F-46 | Działania prewencyjne, zanim pojawią się problemy |
| F-47 | Kultura doceniania: sygnalizowanie momentów, w których warto wzmocnić pozytywne zachowania, i działań budujących zaangażowanie i poczucie wartości |

Ograniczenia prawne dla tego modułu opisuje sekcja 19 (zakaz rozpoznawania emocji w miejscu pracy, system wysokiego ryzyka).

## 5. Wymagania techniczne i niefunkcjonalne

Źródło: general-info, sekcja 5.

| ID | Wymaganie | Uwagi |
|---|---|---|
| T-01 | Neutralność technologiczna: działa w różnych środowiskach IT, bez płatnych licencji | dotyczy też modeli AI i komponentów (np. baza danych, system operacyjny, biblioteki) |
| T-02 | Łatwe wdrożenie w każdym urzędzie: prosta instalacja lub uruchomienie, krótka konfiguracja, bez specjalistycznego szkolenia | |
| T-03 | Działa w małych i dużych urzędach, o wysokim i niskim poziomie cyfryzacji | od kilku do tysięcy pracowników w urzędzie |
| T-04 | Łatwa aktualizacja: szybkie poprawki błędów, zmiany działania, nowe potrzeby | |
| T-05 | Zgodność z ustawą o SC i przepisami o ochronie danych | sekcje 7 do 10 i 18 |
| T-06 | Elastyczność na zmiany przepisów: moduły oparte na regulacjach łatwe do zmiany bez przebudowy całości. Np. zmiana częstotliwości ocen, zasad wyznaczania terminów, elementów oceny nie może blokować narzędzia (przypis 3 general-info) | w praktyce: arkusze, kryteria, skala, terminy i reguły jako konfiguracja albo dane wersjonowane, nie kod na sztywno. Zob. sekcja 14 |
| T-07 | Bezpieczeństwo danych: kontrola dostępu, ochrona danych osobowych, anonimizacja przy przetwarzaniu poza infrastrukturą użytkownika | dotyczy szczególnie wywołań zewnętrznych modeli AI |

## 6. Zgłoszenie, walidacja, kryteria oceny jury

### 6.1. Co trzeba oddać (general-info, sekcja 4)

Obowiązkowo:

- tytuł projektu,
- opis proponowanego rozwiązania,
- identyfikacja problemu i sposobu jego rozwiązania,
- prezentacja PDF, maksymalnie 15 slajdów,
- materiał demonstracyjny (prototyp narzędzia).

Opcjonalnie: repozytorium kodu, zrzuty ekranu, link do demo, dokumentacja techniczna, materiały graficzne.

### 6.2. Jak będzie testowane (general-info, sekcja 6)

Na prezentacji trzeba pokazać cały proces sporządzenia oceny okresowej. Jury sprawdza:

- jak duża część czynności procesu jest odwzorowana,
- jak dobrze odwzorowuje faktyczne procesy (poprawność formalna i merytoryczna),
- w jakim stopniu rozwiązanie wspiera pracowników w ocenach.

Osobno oceniany jest moduł HR partnera, szczególnie wsparcie kierowników w zarządzaniu ludźmi.

### 6.3. Kryteria oceny jury (general-info, sekcja 8)

| Kryterium | Waga |
|---|---|
| Związek z wyzwaniem (zakres odwzorowania czynności i procedur oraz zgodność z przepisami) | 30% |
| Oryginalność pomysłu | 20% |
| Kompletność projektu | 20% |
| Potencjał wdrożeniowy (wdrożenie w większości urzędów, aktualizacja, naprawa błędów) | 30% |

Wniosek: 60% punktów to zgodność z procesem i przepisami oraz wdrażalność. Demo powinno przejść pełną ścieżkę zgodną z sekcjami 7 do 10 tego dokumentu.

### 6.4. Zasoby udostępniane przez organizatora (general-info, sekcja 7)

1. akty prawne,
2. przypadki użycia (schemat i opis),
3. schemat procesu,
4. formularze ocen (wzory i opisy pól),
5. przykładowe wypełnione formularze.

Wszystkie pozycje (oraz „6. Materiały dodatkowe” z zasadami liczenia terminów i poradnikiem KPRM) są w `docs/zasoby-kprm/`. To kopia z publicznego repozytorium innego uczestnika (github.com/Ch3shireDev/hacknation-2026), nie kanał oficjalny. Warto porównać ją z oficjalnym pakietem od mentorów (Discord lub stoisko KPRM). Najważniejsze z tych zasobów:

- BPMN z rolami: ZARZĄDZAJĄCY (kadry), OCENIAJĄCY, OCENIANY, ADMIN, SCHEDULER (czas, czyli automatyczne przypomnienia i przesunięcia terminów),
- przypadki użycia i warunki brzegowe (w tym „fikcja zapoznania z oceną”, import danych pracownika, zastępstwa, archiwizacja, usuwanie danych, wydruk zgodny ze wzorem),
- schematy pól arkuszy A, B, C, 13 wypełnionych przykładów (gotowe dane testowe), arkusz B w Excelu z formułami KPRM,
- zasady liczenia terminów (koniec miesiąca, lata przestępne, dni wolne), czyli gotowe przypadki testowe.

Regulamin, harmonogram i terminy zgłoszeń HackNation 2026: [sources/hackathon/FINDINGS.md](sources/hackathon/FINDINGS.md). **Draft w HackTribe do 21.11 godz. 20:00, zgłoszenie końcowe do 22.11 godz. 11:00.** Pokrewne wyzwanie MC „Kompas Kompetencji” dotyczy tego samego procesu i ma model kompetencji z 49 wskaźnikami.

## 7. Proces oceny okresowej według przepisów

Podstawa: art. 81 do 83 ustawy z 21.11.2008 r. o służbie cywilnej (Dz.U. 2026 poz. 590 t.j.), dalej „ustawa”, oraz rozporządzenie PRM z 4.04.2016 r. (Dz.U. 2016 poz. 470), dalej „rozporządzenie”. Rozporządzenie nie było zmieniane od 2016 r. (status „obowiązujący”, brak aktów zmieniających w ELI).

### 7.1. Kogo dotyczy

- Urzędnik SC oraz pracownik SC zatrudniony na umowę o pracę na czas nieokreślony (art. 81 ust. 1).
- Pracownicy na czas określony w pierwszym okresie zatrudnienia podlegają pierwszej ocenie, nie ocenie okresowej (zob. sekcja 12).
- Ocenę dokonuje bezpośredni przełożony (art. 81 ust. 1, § 2 ust. 1).
- Ocena dotyczy wykonywania obowiązków z opisu stanowiska pracy (art. 81 ust. 3).

### 7.2. Cykl i terminy

| Zdarzenie | Reguła | Podstawa |
|---|---|---|
| Częstotliwość | co 24 miesiące | art. 81 ust. 4 |
| Rozmowa rozpoczynająca i ustalenie kryteriów | w ciągu 30 dni od sporządzenia na piśmie poprzedniej oceny albo od zatrudnienia na czas nieokreślony | § 7 pkt 1 |
| Po ocenie negatywnej | rozmowa rozpoczynająca w ciągu 7 dni od sporządzenia negatywnej oceny na piśmie | § 7 pkt 2 |
| Ponowna ocena po negatywnej | po upływie 6 miesięcy od zapoznania się z oceną | art. 81 ust. 9 |
| Usprawiedliwiona nieobecność ocenianego dłuższa niż miesiąc | termin 24 miesięcy przedłuża się o czas nieobecności | art. 81 ust. 7 |
| Zmiana terminu przez oceniającego | dopuszczalna przy: zmianie oceniającego, przewidywanej dłuższej nieobecności ocenianego albo oceniającego, wniosku ocenianego. Warunek: od ostatniej oceny minęło ponad 6 miesięcy (albo okres oceny przy pierwszej ocenie okresowej jest dłuższy niż 6 miesięcy) | art. 81 ust. 8 |
| Zawiadomienie o nowym terminie | niezwłocznie, pisemnie. Kopia pisma do arkusza | § 8 |
| Zmiana stanowiska z istotną zmianą obowiązków, gdy od ostatniej oceny minęło ponad 6 miesięcy | sporządza się ocenę: nie wcześniej niż 7 dni przed zmianą i nie później niż 30 dni po zmianie | art. 81 ust. 6, § 9 ust. 2 |
| Taka sama zmiana w ciągu 6 miesięcy od ustalenia kryteriów (pierwsza ocena okresowa) albo od ostatniej oceny | w ciągu 30 dni od zmiany ponownie przeprowadza się rozmowę i ustala kryteria. Termin sporządzenia oceny się nie zmienia | § 9 ust. 1 |
| Osoby oceniane pierwszy raz | ocenę sporządza się, jeżeli okres podlegający ocenie jest dłuższy niż 6 miesięcy | art. 81 ust. 6 zd. 2 |
| Sprzeciw | 7 dni od zapoznania się z oceną, do dyrektora generalnego urzędu (albo kierownika urzędu, gdy nie ma DG) | art. 83 ust. 1, przypis 17 arkuszy B i C |
| Rozpatrzenie sprzeciwu | 14 dni od wniesienia | art. 83 ust. 3 |
| Odwołanie do sądu pracy | 14 dni od doręczenia decyzji albo od upływu terminu na rozpatrzenie sprzeciwu | art. 83 ust. 5 |
| Kolejny stopień służbowy z mocy prawa | 30 dni od zapoznania z oceną, gdy od ostatniego stopnia są dwie kolejne pozytywne oceny na jednym z dwóch najwyższych poziomów | art. 89 ust. 2 |

### 7.3. Etapy procesu

1. **Ustalenie arkusza** według stanowiska (§ 3): A kierownik urzędu, B stanowisko polegające na bezpośrednim kierowaniu pracownikami, C pozostali.
2. **Rozmowa rozpoczynająca** (§ 5 ust. 1). Omawia się:
   1. główne obowiązki z opisu stanowiska,
   2. kryteria obowiązkowe i dodatkowe (jeśli wybrane),
   3. oczekiwania oceniającego co do sposobu spełniania kryteriów,
   4. cele na okres oceny, jeśli ich określenie jest uzasadnione charakterem obowiązków, oraz sposób ich realizacji.
3. **Wybór kryteriów dodatkowych**: maksymalnie 3, najistotniejsze ze względu na obowiązki z opisu stanowiska (§ 5 ust. 2). Wybór jest fakultatywny i musi być uzasadniony charakterem obowiązków (§ 2 ust. 2).
4. **Wpis do części I arkusza**: kryteria dodatkowe i termin sporządzenia oceny (§ 5 ust. 3).
5. **Zapoznanie i potwierdzenie**: oceniany potwierdza podpisem rozmowę oraz zapoznanie z kryteriami i terminem (§ 6 ust. 1 i 2). Podpisują oceniający i oceniany (wzór części I).
6. **Akta osobowe**: oryginał arkusza niezwłocznie do akt osobowych, kopia części I dla ocenianego (§ 6 ust. 3).
7. **Okres oceny**: obserwacja pracy, ewentualnie bieżąca informacja zwrotna (standard ZZL, nie wymóg rozporządzenia). Obsługa zdarzeń kadrowych z tabeli 7.2.
8. **Rozmowa oceniająca** przed sporządzeniem oceny na piśmie (§ 10). Omawia się:
   1. główne obowiązki wykonywane w okresie oceny i sposób ich realizacji, z uwzględnieniem spełniania kryteriów,
   2. sposób realizacji celów, jeśli były wyznaczone,
   3. kierunki rozwoju zawodowego i potrzeby w zakresie podnoszenia kwalifikacji i doskonalenia umiejętności.
9. **Sporządzenie oceny na piśmie** (§ 11): oceny cząstkowe, średnia, poziom ogólny, ocena pozytywna albo negatywna, wnioski do IPRZ. Oceniający bierze pod uwagę wnioski z rozmowy oceniającej (§ 11 ust. 2). Uzasadnienie obowiązkowe przy ocenie negatywnej, fakultatywne przy pozytywnej (§ 11 ust. 3 i 4). Przy ocenie pozytywnej urzędnika SC możliwy umotywowany wniosek o kolejny stopień służbowy w części III (§ 11 ust. 5, art. 89 ust. 1).
10. **Zapoznanie z oceną** niezwłocznie (§ 12 ust. 1, art. 81 ust. 3). Oceniany podpisuje oświadczenie: „Przeprowadzono ze mną rozmowę oceniającą oraz zapoznałem(-łam) się z oceną okresową i wnioskami dotyczącymi indywidualnego programu rozwoju zawodowego.”
11. **Akta osobowe**: oryginał do akt, kopia całego arkusza dla ocenianego (§ 12 ust. 2).
12. **Ścieżka odwoławcza**: sprzeciw, rozpatrzenie, zmiana oceny albo sporządzenie po raz drugi (od tej też przysługuje sprzeciw), sąd pracy (art. 83 ust. 1 do 5).
13. **Skutki**: IPRZ ustalany przez przełożonego na podstawie m.in. wniosków z oceny (art. 108), stopień służbowy (art. 89), po ocenie negatywnej ponowna ocena po 6 miesiącach (art. 81 ust. 9).

Przepis przejściowy: jeśli oceniany zapoznał się z kryteriami przed wejściem w życie rozporządzenia z 2016 r., stosuje się przepisy dotychczasowe (§ 13). Nie ma już praktycznego znaczenia, ale pokazuje wzorzec: przy zmianie przepisów reguły zależą od daty rozpoczęcia oceny. To ważne dla T-06 i sekcji 14.

### 7.4. Skala ocen i algorytm wyniku (§ 11 ust. 1)

Oceny cząstkowe za każde kryterium (obowiązkowe i wybrane dodatkowe):

| Poziom | Punkty |
|---|---|
| znacznie poniżej oczekiwań | 1 |
| poniżej oczekiwań | 3 |
| na poziomie oczekiwań | 5 |
| powyżej oczekiwań | 7 |
| znacznie powyżej oczekiwań | 9 |

Ogólny poziom spełniania kryteriów = średnia arytmetyczna ocen cząstkowych:

| Średnia | Poziom ogólny |
|---|---|
| od 1 do 2 | znacznie poniżej oczekiwań |
| powyżej 2 do 4 | poniżej oczekiwań |
| powyżej 4 do 6 | na poziomie oczekiwań |
| powyżej 6 do 8 | powyżej oczekiwań |
| powyżej 8 do 9 | znacznie powyżej oczekiwań |

Ocena końcowa:

- **pozytywna**: poziom ogólny „na poziomie oczekiwań” lub wyżej ORAZ żadna ocena cząstkowa nie jest „znacznie poniżej oczekiwań”,
- **negatywna**: poziom ogólny „poniżej oczekiwań” lub niżej ALBO co najmniej jedna ocena cząstkowa „znacznie poniżej oczekiwań”.

Przykład pułapki: 5 kryteriów po 9 pkt i jedno po 1 pkt daje średnią 7,67 (powyżej oczekiwań), ale ocena jest negatywna.

## 8. Arkusze A, B, C: pola formularzy

**Specyfikacja do ekranów aplikacji** (kto edytuje, na którym etapie, blokady, autouzupełnianie, walidacje, oparta na oficjalnych schematach pól KPRM): [analiza/formularze-arkuszy-A-B-C.md](analiza/formularze-arkuszy-A-B-C.md).

Wzory: załączniki nr 2, 3 i 4 do rozporządzenia. Tekst: [archive/docs/legal/text/02-rozp-prm-oceny-okresowe-2016.txt](../archive/docs/legal/text/02-rozp-prm-oceny-okresowe-2016.txt). Nagłówek każdego arkusza: „OCENA OKRESOWA URZĘDNIKA SŁUŻBY CYWILNEJ LUB PRACOWNIKA SŁUŻBY CYWILNEJ”.

### 8.1. Który arkusz

| Arkusz | Stanowisko | Kryteria obowiązkowe |
|---|---|---|
| A | kierownik urzędu, jeżeli jest to stanowisko w służbie cywilnej (§ 3 ust. 2) | zarządzanie ludźmi, podejmowanie decyzji i odpowiedzialność, organizacja pracy i orientacja na osiąganie celów, współpraca, komunikacja, zarządzanie strategiczne (6) |
| B | praca polegająca na bezpośrednim kierowaniu pracownikami, inna niż kierownik urzędu (§ 3 ust. 3) | zarządzanie ludźmi, podejmowanie decyzji i odpowiedzialność, organizacja pracy i orientacja na osiąganie celów, współpraca, komunikacja (5) |
| C | pozostałe stanowiska (§ 3 ust. 4) | wykorzystywanie wiedzy i doskonalenie zawodowe, rzetelność, organizacja pracy i orientacja na osiąganie celów, współpraca, komunikacja (5) |

Kryteria dodatkowe: dowolne z wykazu 14 kryteriów (sekcja 9), maksymalnie 3. Rozporządzenie nie zakazuje wprost wyboru kryterium, które już jest obowiązkowe dla danego arkusza, ale nie ma to sensu. Do potwierdzenia z mentorami.

### 8.2. Część I (ustalenie kryteriów)

| Pole | A | B | C | Uwagi |
|---|---|---|---|---|
| Nazwa urzędu | tak | tak | tak | |
| Oceniany: imię, nazwisko | tak | tak | tak | |
| Oceniany: komórka organizacyjna | nie | tak | tak | |
| Oceniany: stanowisko pracy | tak | tak | tak | B i C: pełna nazwa z rozszerzeniem „do spraw...”, jeśli jest w opisie stanowiska (przypis 2) |
| Oceniający: imię, nazwisko, stanowisko | tak | tak | tak | |
| Oceniający: komórka organizacyjna | nie | tak | tak | |
| Kryteria obowiązkowe | wydrukowane | wydrukowane | wydrukowane | lista zależna od arkusza |
| Kryteria dodatkowe (maks. 3) | do wpisania | do wpisania | do wpisania | nazwy z załącznika nr 1 |
| Termin sporządzenia oceny | dd.mm.rrrr | dd.mm.rrrr | dd.mm.rrrr | |
| Potwierdzenie przeprowadzenia rozmowy z § 5 ust. 1 i zapoznania z kryteriami i terminem | tak | tak | tak | |
| Miejscowość, data, podpis oceniającego | tak | tak | tak | |
| Miejscowość, data, podpis ocenianego | tak | tak | tak | |

### 8.3. Część II (ocena)

| Pole | Uwagi |
|---|---|
| Data przeprowadzenia rozmowy oceniającej | dd.mm.rrrr |
| Okres, w którym oceniany podlegał ocenie: od, do | „od” = data zapoznania z kryteriami z części I. „do” = data sporządzenia oceny na piśmie. Przy ocenie z art. 81 ust. 6 sporządzanej po zmianie stanowiska: ostatni dzień pracy na poprzednim stanowisku |
| Ocena cząstkowa dla każdego kryterium obowiązkowego | X w jednej z kolumn 1/3/5/7/9 |
| Ocena cząstkowa dla każdego kryterium dodatkowego | jw. |
| Średnia arytmetyczna z ocen cząstkowych | |
| Przyznanie oceny: zaznaczenie przedziału punktowego i ogólnego poziomu | X |
| Ocena okresowa w służbie cywilnej: POZYTYWNA albo NEGATYWNA | X |
| Uzasadnienie przyznanej oceny okresowej | obowiązkowe przy negatywnej. Może być ogólne albo odnosić się do wszystkich lub niektórych ocen cząstkowych |
| Wnioski dotyczące indywidualnego programu rozwoju zawodowego | „Uwzględniając sporządzoną ocenę, realizowane i przyszłe zadania oraz oczekiwania ocenianego, należy określić kierunki rozwoju zawodowego ocenianego, biorąc pod uwagę obszary wiedzy i umiejętności wymagające doskonalenia, oraz zaproponować optymalne formy i metody ich realizacji.” |
| Dane dotyczące poprzedniej oceny okresowej urzędnika SC: ocena (pozytywna/negatywna), poziom, data sporządzenia | potrzebne do reguły art. 89 ust. 2 |
| Czy dołączono wniosek o kolejny stopień służbowy: TAK / NIE / NIE DOTYCZY (pracownik SC) | |
| Dane oceniającego: imię, nazwisko, komórka (B, C), stanowisko | |
| Miejscowość, data, podpis oceniającego | |
| Oświadczenie ocenianego o rozmowie i zapoznaniu z oceną i wnioskami do IPRZ, miejscowość, data, imię i nazwisko lub pieczątka, podpis | |
| Pouczenie o sprzeciwie (art. 83 ust. 1) | B i C: do dyrektora generalnego urzędu (przypis: albo kierownika urzędu). A: adresat sprzeciwu do wpisania |

### 8.4. Część III (wniosek o kolejny stopień służbowy)

Wypełniana i dołączana tylko gdy oceniający korzysta z art. 89 ust. 1. Nie drukuje się jej dla pracownika SC ani gdy wniosku nie ma (przypis 16 i 18).

Pola: imię, nazwisko urzędnika, rok mianowania, posiadany stopień służbowy, data przyznania stopnia, treść „W związku z uzyskaniem przez Panią/Pana ... pozytywnej oceny okresowej, na podstawie art. 89 ust. 1 ... wnioskuję o przyznanie ... stopnia służbowego”, umotywowanie wniosku, miejscowość, data, imię i nazwisko lub pieczątka oceniającego, podpis oceniającego.

## 9. Kryteria oceny (14) z opisami

Załącznik nr 1 do rozporządzenia. Opisy są źródłem dla podpowiedzi oczekiwań, pytań do rozmów i analizy notatek.

| Nr | Kryterium | Opis (wskaźniki) |
|---|---|---|
| 1 | Komunikacja | koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie. Wypowiadanie się jasno i precyzyjnie, z doborem stylu, języka i treści do sytuacji i rozmówcy. Jasne i precyzyjne wypowiedzi pisemne dostosowane do sytuacji i odbiorcy. Przekonujące argumenty odpowiednio do sytuacji |
| 2 | Kreatywność | proponowanie lub tworzenie nowych rozwiązań. Nieschematyczne podejście do zadań |
| 3 | Negocjowanie | przygotowanie do negocjacji, w szczególności projekt stanowiska, zakres możliwych ustępstw i argumentacja. Stosowanie technik i strategii negocjacyjnych. Efekt negocjacji akceptowany przez przełożonych |
| 4 | Organizacja pracy i orientacja na osiąganie celów | określanie sposobu realizacji zadań i celów. Realizowanie zadań w kolejności uwzględniającej wagę i pilność (priorytety). Dobór niezbędnych zasobów. Dostosowywanie się do zmieniających się okoliczności. Wytrwałość i zaangażowanie w realizację |
| 5 | Orientacja na klienta/interesanta | taktowne zachowanie z szacunkiem i zrozumieniem. Reagowanie na potrzeby klienta, w szczególności rozpoznawanie potrzeb i proponowanie rozwiązań |
| 6 | Podejmowanie decyzji i odpowiedzialność | wypracowywanie alternatywnych rozwiązań na podstawie analizy informacji, w szczególności ryzyka. Podejmowanie decyzji (decyzyjność). Przyjmowanie odpowiedzialności za efekty decyzji |
| 7 | Radzenie sobie w sytuacjach kryzysowych | rozpoznawanie sytuacji kryzysowych i informowanie zainteresowanych. Działania na rzecz rozwiązania kryzysu. Wyciąganie wniosków z sytuacji kryzysowych |
| 8 | Rzetelność | wykonywanie zadań zgodnie ze standardami (przepisy, zasady, procedury) i dbałość o jakość rezultatów. Dotrzymywanie zobowiązań w wyznaczonym czasie |
| 9 | Myślenie analityczne | rozróżnianie informacji istotnych i nieistotnych. Dostrzeganie zależności między informacjami. Formułowanie wniosków |
| 10 | Wykorzystywanie wiedzy i doskonalenie zawodowe | wykorzystywanie wiedzy przy realizacji zadań na stanowisku. Doskonalenie wiedzy i umiejętności, w szczególności wyszukiwanie i pozyskiwanie wiedzy, dobre praktyki i doświadczenia innych. Korzystanie z dostępnych źródeł informacji, rozwiązań i technologii |
| 11 | Współpraca | włączanie się w działania z innymi, jeśli to możliwe. Dbanie o przepływ informacji. Dobra atmosfera i otwartość we współpracy. Dostrzeganie wkładu innych. Branie pod uwagę zdania innych. Dzielenie się wiedzą i doświadczeniem |
| 12 | Wystąpienia publiczne | wykorzystywanie różnych środków przekazu (np. multimedia) i dbałość o sposób prezentacji, w tym autoprezentacji. Nawiązywanie i utrzymywanie kontaktu z audytorium. Zarządzanie czasem wystąpienia, w szczególności przestrzeganie ram czasowych i elastyczne reagowanie na potrzeby audytorium. Radzenie sobie ze stresem i emocjami, w szczególności wywołanymi krytyką i trudnymi pytaniami |
| 13 | Zarządzanie ludźmi | delegowanie zakresu odpowiedzialności, zadań i uprawnień. Monitorowanie realizacji zadań i działania korygujące lub zapobiegawcze. Motywowanie. Informacja zwrotna oparta na ocenie zaangażowania i sposobu realizacji zadań. Rozwiązywanie konfliktów. Wspieranie rozwoju pracowników: identyfikacja potrzeb, proponowanie działań rozwojowych, monitorowanie ich realizacji |
| 14 | Zarządzanie strategiczne | tworzenie wizji i celów strategicznych w oparciu o całościowe i perspektywiczne widzenie organizacji, otoczenia i strategii rozwoju. Formułowanie celów operacyjnych na podstawie strategicznych. Analiza ryzyka planowanych działań strategicznych |

## 10. Reguły biznesowe do zakodowania

Lista kontrolna walidacji formalnej (F-31, F-32). Każda reguła ma podstawę prawną. Wersja maszynowa (kryteria, arkusze, skala, progi, terminy): [legal/oceny-okresowe-dane.yaml](legal/oceny-okresowe-dane.yaml).

| ID | Reguła | Podstawa |
|---|---|---|
| R-01 | Ocenie okresowej podlega urzędnik SC oraz pracownik SC na umowie na czas nieokreślony | art. 81 ust. 1 |
| R-02 | Oceniający = bezpośredni przełożony | art. 81 ust. 1, § 2 ust. 1 |
| R-03 | Arkusz wynika z typu stanowiska: A, B, C | § 3 |
| R-04 | Kryteria obowiązkowe zależne od arkusza, nie można ich usunąć | § 4 |
| R-05 | Kryteria dodatkowe: 0 do 3, tylko z wykazu 14 kryteriów, uzasadnione charakterem obowiązków | § 2 ust. 2, § 5 ust. 2 |
| R-06 | Rozmowa rozpoczynająca i część I w ciągu 30 dni od poprzedniej oceny albo od zatrudnienia na czas nieokreślony, 7 dni po ocenie negatywnej | § 7 |
| R-07 | Termin oceny: 24 miesiące, wydłużany o usprawiedliwioną nieobecność ocenianego dłuższą niż miesiąc | art. 81 ust. 4 i 7 |
| R-08 | Zmiana terminu tylko z 4 powodów z art. 81 ust. 8 i tylko gdy minęło ponad 6 miesięcy. Pisemne zawiadomienie, kopia do arkusza | art. 81 ust. 8, § 8 |
| R-09 | Zmiana stanowiska z istotną zmianą obowiązków: po ponad 6 miesiącach od ostatniej oceny sporządza się ocenę w oknie od 7 dni przed do 30 dni po zmianie. W ciągu 6 miesięcy: ponowne ustalenie kryteriów w 30 dni, termin bez zmian | art. 81 ust. 6, § 9 ust. 1 i 2 |
| R-10 | Zmiana oceniającego: kryteria pozostają, możliwa zmiana terminu | § 9 ust. 3, art. 81 ust. 8 pkt 1 |
| R-11 | Rozmowa oceniająca musi odbyć się przed sporządzeniem oceny na piśmie | § 10 |
| R-12 | Każde kryterium (obowiązkowe i dodatkowe) ma dokładnie jedną ocenę cząstkową z {1,3,5,7,9} | § 11 ust. 1 pkt 1 |
| R-13 | Średnia i poziom ogólny wyliczane według progów 2/4/6/8 | § 11 ust. 1 pkt 2 |
| R-14 | Ocena negatywna, gdy średnia ≤ 4 albo jakakolwiek ocena cząstkowa = 1 | § 11 ust. 1 pkt 3 i 4 |
| R-15 | Uzasadnienie wymagane przy ocenie negatywnej | § 11 ust. 3 |
| R-16 | Wnioski do IPRZ wymagane w każdej ocenie | art. 81 ust. 5, § 11 ust. 1 pkt 5 |
| R-17 | Część III tylko dla urzędnika SC i tylko przy ocenie pozytywnej | § 11 ust. 5, art. 89 ust. 1 |
| R-18 | Dwie kolejne pozytywne oceny na jednym z dwóch najwyższych poziomów od ostatniego stopnia: kolejny stopień w 30 dni (sygnał dla HR) | art. 89 ust. 2 |
| R-19 | Po ocenie negatywnej: ponowna ocena po 6 miesiącach od zapoznania | art. 81 ust. 9 |
| R-20 | Sprzeciw w 7 dni, rozpatrzenie w 14 dni, sąd pracy w 14 dni. Po uwzględnieniu: zmiana oceny albo ocena po raz drugi, od której znów przysługuje sprzeciw | art. 83 |
| R-21 | Oryginał arkusza do akt osobowych po części I i po ocenie. Kopia części I, potem całego arkusza dla ocenianego | § 6 ust. 3, § 12 ust. 2 |
| R-22 | Okres oceny „od” = data zapoznania z kryteriami, „do” = data sporządzenia oceny | przypisy do części II |
| R-23 | Kryteria oceny obiektywne i sprawiedliwe, zakaz dyskryminacji, ochrona przed naruszeniem dóbr osobistych także w obszarze efektów pracy i jej oceny | art. 94 pkt 2b, 2c, 9 Kodeksu pracy |

## 11. Indywidualny program rozwoju zawodowego, szkolenia, stopnie służbowe

**IPRZ (art. 108 ustawy)**

- Ustala go bezpośredni przełożony, odrębnie dla każdego członka korpusu, z wyjątkiem osób na wyższych stanowiskach w SC.
- Jest podstawą do kierowania na szkolenia.
- Uwzględnia w szczególności: wnioski z oceny okresowej, planowaną ścieżkę awansu stanowiskowego i finansowego, plany i możliwości rozwoju pracownika, potrzeby i możliwości urzędu w zakresie zatrudnienia.
- Akceptuje osoba kierująca komórką organizacyjną, zatwierdza dyrektor generalny urzędu (art. 108 ust. 2).
- PRM może określić szczegółowy sposób ustalania IPRZ zarządzeniem (art. 108 ust. 3). Nie znalazłem takiego zarządzenia w wykazie aktów wykonawczych ustawy w ELI.

**Szkolenia (art. 106 ustawy, rozporządzenie PRM z 24.06.2015 r., Dz.U. 2015 poz. 960)**

- Rodzaje: centralne (Szef SC, plan roczny z priorytetami, art. 107), powszechne, w ramach IPRZ, specjalistyczne (dyrektor generalny).
- Szkolenia w ramach IPRZ służą nabyciu wiedzy lub umiejętności określonych w IPRZ (§ 5).
- Jeśli program szkolenia centralnego, powszechnego lub specjalistycznego jest zgodny z IPRZ, DG może skierować na nie w ramach IPRZ (§ 13).
- Do 31 stycznia DG przekazuje Szefowi SC potrzeby szkoleniowe urzędu i zestawienie szkoleń z poprzedniego roku (§ 16). Dane z IPRZ w aplikacji mogą to zasilać.
- Udział w szkoleniach jest traktowany jak wykonywanie obowiązków, bez opłat dla pracownika (art. 109).

**Stopnie służbowe (art. 86, 89 ustawy, rozporządzenie PRM Dz.U. 2025 poz. 670 t.j.)**

- 9 stopni służbowych urzędników SC (I do IX), z mnożnikiem kwoty bazowej dodatku SC od 0,47 do 2,05.
- Ścieżka uznaniowa: wniosek oceniającego w części III przy ocenie pozytywnej (art. 89 ust. 1).
- Ścieżka obligatoryjna: dwie kolejne pozytywne oceny na jednym z dwóch najwyższych poziomów (art. 89 ust. 2).

## 12. Pierwsza ocena (proces pokrewny)

Rozporządzenie PRM z 23.07.2015 r. (Dz.U. 2015 poz. 1144), na podstawie art. 38 ustawy. To osobny proces dla nowo zatrudnionych pracowników SC na czas określony. Wyzwanie mówi o ocenie okresowej, więc pierwsza ocena jest poza głównym zakresem, ale ma podobną strukturę i może być rozszerzeniem.

- Elementy oceny: rzetelność, wykorzystywanie wiedzy i doskonalenie zawodowe, organizacja pracy i orientacja na osiąganie celów, komunikacja, współpraca. Do tego wynik egzaminu ze służby przygotowawczej (jeśli był wymagany) i sprawozdanie ocenianego (§ 2).
- Rozmowa wstępna w 21 dni od nawiązania stosunku pracy (§ 3).
- Sprawozdanie po upływie 8 miesięcy od zatrudnienia, obejmuje co najmniej 7 miesięcy (§ 4, § 6).
- Po pierwszej ocenie pozytywnej pracownik przechodzi na czas nieokreślony i od tego dnia biegnie 30 dni na ustalenie kryteriów pierwszej oceny okresowej (§ 7 pkt 1 rozporządzenia o ocenach okresowych).

## 13. Standardy ZZL i system informacji zwrotnej (zarządzenie nr 6 Szefa SC)

Szczegóły i cytaty: [legal/NOTES-zarzadzenie-nowelizacja-strategia.md](legal/NOTES-zarzadzenie-nowelizacja-strategia.md), sekcja 1. Tekst: `archive/docs/legal/text/zarzadzenie-6-szefa-sc-2020-standardy-zzl.txt`.

- Zarządzenie nr 6 Szefa SC z 12.03.2020 r. obowiązuje. Zmienione raz, zarządzeniem nr 7 z 16.12.2020 r., tylko w części o obsadzaniu stanowisk kierowniczych. Opublikowane na gov.pl/web/sluzbacywilna, nie w dzienniku urzędowym.
- Reguła interpretacyjna z oficjalnego Q&A: zapis zaczynający się od „zaleca się” jest zaleceniem, pozostałe są obligatoryjne.
- **System informacji zwrotnej (cz. IV pkt 6, obligatoryjny)**: dyrektor generalny określa system informacji zwrotnej o charakterze motywującym i rozwojowym. Składa się z informacji **bieżącej** (bezpośrednio po sytuacji, która ją uzasadnia) i **cyklicznej** (w regularnych odstępach, np. kwartalnie, podsumowującej okres). Informacja zwrotna ma być konkretna (zachowania i fakty) i dostosowana do odbiorcy. To podstawa F-08.
- Definicja informacji zwrotnej (cz. I pkt 4): podsumowanie przez przełożonego sposobu wykonywania zadań, z funkcją ewaluacyjną, informacyjną, rozwojową i motywacyjną, wspiera decyzje kadrowe.
- Osoby kierujące odpowiadają za planowanie, organizowanie, motywowanie, ocenianie, rozwój pracowników, atmosferę i rozwiązywanie konfliktów (cz. II pkt 3, obligatoryjny). Zalecane są rozwiązania informatyczne usprawniające procesy kadrowe i EZD (cz. II pkt 5).
- Motywowanie (cz. IV): wynagrodzenie zasadnicze z uwzględnieniem oceny pracy (obligatoryjny). Zalecenia niematerialnych narzędzi motywacyjnych dopasowanych indywidualnie (pochwały, wyróżnienia, nowe zadania, samodzielność, WLB). Podstawa dla F-47.
- Rozwój (cz. VI): potrzeby rozwojowe badane m.in. przez analizę wniosków z ocen okresowych (zalecenie). W urzędach powyżej 50 członków korpusu DG obligatoryjnie określa zasady IPRZ i roczny plan szkoleń uwzględniający IPRZ. Różnorodne formy rozwoju: samodoskonalenie, doskonalenie w działaniu, instruktaż, mentoring, coaching, wizyty studyjne, development center, e-learning SC. Osoba kierująca monitoruje rozwój podległych pracowników (obligatoryjny). Podstawa dla F-21.
- Dobrostan: słowo nie występuje. Temat ujęty pośrednio w części V (work-life balance, zdrowie) i w procedurze antymobbingowej.
- Rozwiązanie stosunku pracy (cz. VII): na wniosek odchodzącego pracownika przełożony sporządza ocenę okresową albo opinię o pracy.

## 14. Planowane zmiany przepisów

Szczegóły, tabela porównawcza i źródła: [legal/NOTES-zarzadzenie-nowelizacja-strategia.md](legal/NOTES-zarzadzenie-nowelizacja-strategia.md), sekcja 2. Teksty projektu w `archive/docs/legal/text/projekt-nowelizacji-usc-UDER102-*`.

### 14.1. Status

- Projekt ustawy o zmianie ustawy o służbie cywilnej oraz niektórych innych ustaw, wykaz prac RM nr **UDER102**, RCL nr 12409452.
- 21.04.2026 skierowany do uzgodnień, konsultacji i opiniowania. 10.07.2026 konferencja uzgodnieniowa. 14.09.2026 ponowne uzgodnienia wersji z 11.09.2026, z adnotacją o pilnym procedowaniu.
- Rada Ministrów jeszcze go nie przyjęła. Plan: IV kwartał 2026 (wpis z 20.11.2026). Brak druku sejmowego. Wejście w życie: 3 miesiące od ogłoszenia.
- Projektów nowych rozporządzeń (katalog kompetencji, wzór arkusza, skala) nie opublikowano.
- Realistycznie: nowe przepisy najwcześniej w 2027 r.

### 14.2. Co zmienia w ocenach (wersja z 11.09.2026)

| Element | Dziś | Projekt |
|---|---|---|
| Kto | urzędnicy SC i pracownicy SC na czas nieokreślony | wszyscy urzędnicy i pracownicy SC, także na czas określony. Pierwsza ocena (art. 37, 38) znika i staje się oceną okresową |
| Częstotliwość | co 24 miesiące, w konkretnym dniu | co 12 miesięcy, w miesiącu kalendarzowym upływu terminu, przy co najmniej 6 przepracowanych miesiącach |
| Nieobecność | termin przedłużany o nieobecność ponad miesiąc | nieobecność łącznie ponad 6 miesięcy w cyklu: oceny nie ma, nowy cykl od powrotu |
| Po ocenie negatywnej | ponowna ocena po 6 miesiącach | brak, zwykły cykl 12 miesięcy |
| Ocena przed terminem | zmiana stanowiska z istotną zmianą obowiązków | zmiana stanowiska, istotna zmiana zadań, przeniesienie do innego urzędu, okno 14 dni przed do końca miesiąca zdarzenia |
| Zmiana terminu | 4 przesłanki, w tym wniosek ocenianego | bez wniosku ocenianego, dochodzi rozwiązanie stosunku pracy |
| Skala | 5 poziomów, punkty 1 do 9 | oceny cząstkowe, ocena łączna, 3 poziomy: negatywny, pozytywny, wyróżniający. Skale w nowym rozporządzeniu |
| Kryteria | obowiązkowe plus do 3 dodatkowych | od 4 do 6 „kompetencji do oceny” z katalogu w nowym rozporządzeniu |
| Etapy (w ustawie) | w rozporządzeniu | rozmowa wstępna, ustalenie kompetencji i planu rozwoju, rozmowa oceniająca, wypełnienie arkusza, zapoznanie ocenianego |
| Okres oceny | wynika z terminów | od zapoznania z kompetencjami do rozmowy oceniającej |
| Rozmowy | | rozmowę wstępną kolejnego cyklu można połączyć z oceniającą. Za zgodą obu stron może być obserwator z urzędu |
| Uzasadnienie | obowiązkowe przy negatywnej | przy negatywnej uzasadnienie każdej oceny cząstkowej, która ją spowodowała |
| Forma | „na piśmie” | arkusz papierowy **lub elektroniczny** (art. 81b ust. 7) |
| Rozwój | wnioski do IPRZ, IPRZ zatwierdza DG (art. 108) | art. 108 uchylony. **Plan rozwoju** w arkuszu, bez zatwierdzania przez DG, jego realizacja nie jest oceniana, bez sprzeciwu |
| Sprzeciw | każdy, 7 dni, DG 14 dni, po uwzględnieniu znów sprzeciw | tylko zatrudnieni na czas nieokreślony. DG uwzględnia w całości lub części, oceniający w 7 dni ocenia ponownie, potem już tylko sąd pracy (14 dni) |
| Stopień służbowy | na wniosek po ocenie pozytywnej, obligatoryjnie po 2 ocenach na 2 najwyższych poziomach | na wniosek po 3 kolejnych wyróżniających, obligatoryjnie po 4 kolejnych co najmniej pozytywnych, w tym 3 wyróżniających |
| Rozwiązanie stosunku pracy | 2 kolejne negatywne | 2 kolejne negatywne (bez zmian merytorycznie) |
| Czas nieokreślony | po pozytywnej pierwszej ocenie | po ocenie co najmniej pozytywnej |

Przepisy przejściowe: ocena rozpoczęta przed wejściem w życie toczy się według starych zasad (rozpoczęcie = pierwsza czynność oceniającego). Stopnie za oceny rozpoczęte wcześniej też według starych zasad. Wniosek: **przez co najmniej jeden cykl narzędzie musi obsłużyć równolegle dwa reżimy** (5 poziomów i 3 poziomy). To mocny argument za T-06 i za modelem „wersja przepisów przypięta do oceny”.

Uzasadnienie projektu wprost zapowiada: „przygotowane zostanie narzędzie cyfrowe do przeprowadzania ocen okresowych, z którego będą mogły korzystać urzędy”, aby „uprościć oraz zautomatyzować proces oceniania”. Plan rozwoju ma skupiać się na obszarach do rozwoju, nie na liście szkoleń (mentoring, samokształcenie, zadania rozwojowe, projekty).

Inne zmiany projektu powiązane z asystentem: nowy art. 97b (DG może finansować rozwiązania dla dobrostanu i kultury współpracy), obowiązkowy regulamin nagród (art. 93), nowa definicja szkolenia (art. 106).

Uwagi z uzgodnień: resorty (m.in. MF) ostrzegały, że roczny cykl podwoi obciążenie przełożonych. Szef SC utrzymał cykl roczny. To bezpośrednio uzasadnia automatyzację i asystenta.

### 14.3. Ustalenia własne z ELI

- Ostatni tekst jednolity ustawy: Dz.U. 2026 poz. 590 (obwieszczenie z 17.04.2026). Akty zmieniające po nim w ELI: tylko Dz.U. 2026 poz. 26 (ustawa o systemie ubezpieczeń społecznych, wchodzi 1.01.2027), która nie dotyczy ocen.
- Nowelizacja z 2023 r. (Dz.U. 2023 poz. 1195) i ustawa z 9.01.2026 r. o zmianie ustaw związanych z funkcjonowaniem administracji rządowej (Dz.U. 2026 poz. 160) nie zmieniają przepisów o ocenach (sprawdzone wyszukiwaniem w tekście).

## 15. Strategia ZZL w służbie cywilnej do 2034 r.

Uchwała nr 37 RM z 16.01.2026 r. (M.P. 2026 poz. 168), w mocy od 3.02.2026. Szczegóły ze stronami: [legal/NOTES-zarzadzenie-nowelizacja-strategia.md](legal/NOTES-zarzadzenie-nowelizacja-strategia.md), sekcja 3.

- **Inicjatywa 7.4 „HACKATHON kadrowy”**: „Zaprojektujemy i scyfryzujemy narzędzia kadrowe”, lata 2026 do 2028, 50 000 zł w 2026 i 50 000 zł w 2027 z rezerwy modernizacyjnej. Ten hackathon jest więc częścią strategii rządowej, a wynik ma realną ścieżkę dalszego finansowania.
- Kierunek 7 (cyfryzacja): ZZL w jednolitym systemie, 100% podmiotów w EZD, cyfrowe narzędzia ZZL udostępniane przez Szefa SC (docelowo w 50 do 80% urzędów, 100% urzędów z DG), automatyzacja sprawozdań dla Szefa SC (0% w 2025, 100% w 2034). Cytat: „jak najszersze, etyczne wykorzystanie AI w służbie cywilnej”.
- Kierunek 2 (kadra kierownicza): budowanie kultury informacji zwrotnej, etycznego przywództwa, bezpieczeństwa psychologicznego. Zobiektywizowana ocena efektów pracy kierowników (inicjatywa 2.3) i katalog kompetencji kierowniczych (2.1).
- Kierunek 4 (rozwój): przegląd systemu ocen, system szkoleń „4U”, model kompetencji kluczowych (w tym odporność psychiczna, umiejętności cyfrowe), systemowy program mentoringowy (2026 do 2034).
- Kierunek 8: popularyzacja WLB, dobrostanu i zdrowia psychicznego (8.4). Miernik: unowocześniona koncepcja opisu stanowiska, IPRZ i oceny okresowej z pilotażem. Uproszczone narzędzia ZZL z pilotażem (8.3, 2026).
- Diagnoza ocen (2024): 39 727 ocen, 48% „na poziomie oczekiwań”, 51,5% na dwóch najwyższych poziomach, 185 negatywnych (0,46%). Postulat „urealnienia” ocen. Przydatność ocen: 70% wśród kadr, tylko 47% wśród pracowników (ankieta DSC 2018).
- Szkolenia (2024): 626 tys. uczestników, 55,7 mln zł, e-learning 46%.
- Raport z konsultacji: RPA i analiza danych z AI w systemie kadrowym „przedyskutujemy na etapie przygotowywania koncepcji”. Elektronizacja ocen i IPRZ „częściowo uwzględnione”.

**Inne dokumenty Szefa SC i DSC** (szczegóły w NOTES, sekcja 4):

- **Sprawozdanie Szefa SC za 2025**: 56 770 ocen, 49,7% na dwóch najwyższych poziomach, 0,39% negatywnych. Wyzwanie: „jakość i użyteczność przekazywanej informacji zwrotnej”. „Sporządzanie ocen okresowych co 2 lata nie zapewnia regularnej informacji zwrotnej.” Rekomendacja: cyfryzacja kolejnych narzędzi kadrowych.
- **Projekt TSI** (finansowanie KE, 25 urzędów, 2025 do 2027): w raporcie z lipca 2026 r. stan obecny to oceny na papierze lub w skanach, ręczne przepisywanie danych i trudna agregacja wyników. **Katalog wymagań biznesowych** dla cyfrowej oceny okresowej (`archive/docs/legal/raw/tsi-raport-katalog-wymagan-biznesowych-kadry.pdf`, rozdz. 5.3) to gotowa lista kontrolna dla naszego rozwiązania:
  - WB.OO-1: elektroniczny arkusz z wersjonowaniem, e-podpis lub e-zatwierdzenie, jedno repozytorium, dołączanie do akt.
  - WB.OO-2: workflow z korektami i śladem audytowym.
  - WB.OO-3: centralny kalendarz ocen, powiadomienia, eskalacje, pobieranie z systemu kadrowego zmian stanowisk i długich nieobecności.
  - WB.OO-4: standaryzacja kryteriów, szablon rozmowy, instrukcja krok po kroku, walidacja kompletności.
  - KPI.OO-1 do KPI.OO-6: czas procesu, terminowość, czas etapów, udział ocen w pełni cyfrowych, odsetek ocen do poprawy, jakość i spójność.
- **BOSC** (Baza Ocen w Służbie Cywilnej): poprzednie narzędzie KPRM z 2015 r. (MS Access 2010 i Excel). Lista osób do oceny, zbliżające się terminy, oceny negatywne, wnioski o stopień, raporty do sprawozdania. To punkt odniesienia: nasze rozwiązanie powinno robić co najmniej to samo.
- **Formularz sprawozdawczy DSC-OCK za 2025**: liczby ocen na 5 poziomach (osobno urzędnicy), negatywne, drugie kolejne negatywne, sprzeciwy (uwzględnione, nieuwzględnione, nierozpatrzone), odwołania do sądu, wnioski i nadania stopni z art. 89 ust. 1 i 2. To gotowa specyfikacja raportu statystycznego dla DG.
- **Wyjaśnienia DSC „Oceny pracownicze”** (FAQ, niewiążące): naruszenie procedury nie powoduje nieważności oceny z mocy prawa, urlop wypoczynkowy jest usprawiedliwioną nieobecnością, Szef SC nie może nakazać zmiany oceny.
- **IPRZ**: FAQ DSC, poradnik dobrej praktyki (2011), formularz IPRZ (xlsx).
- **Plan szkoleń centralnych 2026**: bloki „Dobrostan w pracy” (w tym wypalenie), „Kompetencje zarządcze” (informacja zwrotna, delegowanie, motywacja), „Sztuczna inteligencja”.
- **Orzecznictwo SN** (wstępnie): uchwała III PZP 10/15 z 27.01.2016 r. Sąd kontroluje tryb i uzasadnienie negatywnych ocen cząstkowych, oceny nie zmienia, może ją tylko uchylić. Pełne opracowanie robi osobny agent.

## 16. Materiały i praktyka Departamentu Służby Cywilnej

Pełne notatki ze źródłami: [sources/sluzba-cywilna/FINDINGS.md](sources/sluzba-cywilna/FINDINGS.md). Model procesu, 30 przypadków użycia, 36 przypadków brzegowych i 26 pytań do mentorów: [analiza/proces-i-przypadki-uzycia.md](analiza/proces-i-przypadki-uzycia.md). Rynek narzędzi i pułapki AI w ocenach: [sources/rynek-narzedzi/FINDINGS.md](sources/rynek-narzedzi/FINDINGS.md).

Najważniejsze z praktyki DSC (poza tym, co już jest w sekcjach 7 do 10):

- Terminy liczy się według Kodeksu cywilnego: termin przypadający na dzień wolny przesuwa się na następny dzień roboczy (FAQ DSC pyt. 11).
- Przedłużenie o nieobecność nie dotyczy terminu 6 miesięcy na ponowną ocenę po ocenie negatywnej (FAQ pyt. 19).
- Uchybienia formalne nie unieważniają oceny, ale grożą odpowiedzialnością oceniającego (FAQ pyt. 3 i 4). Sąd bada tylko tryb i uzasadnienie negatywnych ocen cząstkowych. Oceny nie zmienia, może ją tylko uchylić (SN III PZP 10/15).
- Po uwzględnieniu sprzeciwu nie wolno obniżyć oceny (poradnik DSC 2016, rozdz. 7).
- DSC zaleca uzasadniać wszystkie oceny cząstkowe, nie tylko negatywne (FAQ pyt. 22).
- DSC zaleca prowadzić obserwacje przez cały okres („teczka pracownicza”, podsumowania co miesiąc lub kwartał). To podstawa dla F-09.
- Takie same stanowiska powinny mieć takie same kryteria dodatkowe. Przy niezmienionych zadaniach warto zachować kryteria w kolejnym cyklu.
- Poprzednie narzędzia DSC: Excel 2016 (liczył średnią, ostrzegał o duplikatach kryteriów) i BOSC (Access: terminy, raporty, sprawozdanie). To minimum funkcjonalne do przebicia.
- Wzór DSC z 2013 r. dla bieżącej informacji zwrotnej: kwartalna ocena pracy w skali 1 do 5 na arkuszu. Gotowy wzorzec dla F-08.
- Druga kolejna ocena negatywna urzędnika oznacza obowiązkowe rozwiązanie stosunku pracy (art. 71 ust. 1 pkt 1 ustawy), wypowiedzenie bez czekania na sąd.

Wnioski z przeglądu rynku: polskie systemy kadrowe nie wspierają przełożonego w rozmowie ani w pisaniu oceny. Dobre wzorce to szkic cytujący notatki, „za mało danych” zamiast ogólników, brak propozycji poziomu oceny od AI, strażnik danych wrażliwych w notatkach (kara 35,3 mln EUR dla H&M za notatki o zdrowiu i życiu prywatnym) i coaching przełożonego zamiast diagnozy pracownika.

## 17. Dokumentacja pracownicza w postaci elektronicznej i podpisy

Dlaczego to ważne: organizator wprost wskazuje obieg dokumentów cyfrowych i poświadczeń jako barierę. Arkusz wymaga podpisów obu stron, a oryginał trafia do akt osobowych.

- Pracodawca prowadzi dokumentację pracowniczą w postaci papierowej lub elektronicznej (art. 94 pkt 9a KP). Postać elektroniczna jest równoważna papierowej (art. 94^11 KP).
- Przechowywanie: przez okres zatrudnienia i 10 lat od końca roku, w którym stosunek pracy ustał, z zachowaniem poufności, integralności, kompletności i dostępności (art. 94 pkt 9b KP).
- Akta osobowe mają części A do E. Dokumenty dotyczące przebiegu zatrudnienia trafiają do części B (§ 3 rozporządzenia MRPiPS w sprawie dokumentacji pracowniczej, Dz.U. 2026 poz. 474 t.j.).
- System teleinformatyczny dla dokumentacji elektronicznej musi zapewniać (§ 9 tego rozporządzenia): ochronę przed uszkodzeniem, utratą i nieuprawnionym dostępem, integralność treści i metadanych (zmiany tylko według udokumentowanych procedur), stały dostęp osobom upoważnionym, identyfikację osób z dostępem i rejestrowanie zmian (audit log), wyszukiwanie po metadanych, wydawanie i eksport dokumentacji, wydruk.
- Zabezpieczenie: analiza zagrożeń, procedury dostępu, kopie zapasowe, środki adekwatne do zagrożeń, okresowa ocena skuteczności, plan długoterminowego przechowywania i migracji formatów (§ 10).
- Papierowy dokument dołączany do dokumentacji elektronicznej: skan opatrzony kwalifikowanym podpisem elektronicznym albo kwalifikowaną pieczęcią pracodawcy (§ 11, art. 94^8 § 2 KP).
- Zmiana postaci dokumentacji wymaga poinformowania pracowników (art. 94^9 KP).
- Podpisy elektroniczne: rozporządzenie eIDAS (UE 910/2014, zmienione przez UE 2024/1183, Europejski Portfel Tożsamości Cyfrowej) oraz ustawa o usługach zaufania i identyfikacji elektronicznej (Dz.U. 2024 poz. 1725 t.j.). Kwalifikowany podpis elektroniczny ma skutek równoważny podpisowi własnoręcznemu (art. 25 ust. 2 eIDAS).
- **Orzecznictwo: SO Łódź, VIII Pa 416/24 z 5.03.2025 r.** Zapoznanie ocenianego z oceną przez powiadomienie w EZD nie spełnia wymogu § 12 rozporządzenia („niezwłocznie”, forma pisemna). Ocenę uchylono, także za brak rozmowy oceniającej z § 10. Wniosek dla projektu: dopóki obowiązuje rozporządzenie z 2016 r., aplikacja musi generować arkusz do podpisu (papierowego albo elektronicznego równoważnego pisemnemu) i rejestrować datę zapoznania. Projekt nowelizacji (sekcja 14) wprost dopuszcza arkusz elektroniczny. Źródło: `sources/praktyka-urzedow/FINDINGS.md`, sekcja 1.5.
- Podpis zaufany (bezpłatny) jest równoważny własnoręcznemu (art. 20ae ust. 2 ustawy o informatyzacji), ale zapisuje w pliku PESEL podpisującego. Szczegóły i warianty integracji (gov.pl „Podpisz dokument”, Węzeł Podpisu, podpis w EZD RP): `sources/it-administracji/FINDINGS.md`, sekcje 2 i 6.4.
- Otwarta kwestia: czy w urzędach wystarczy podpis w systemie (np. logowanie i zatwierdzenie w EZD), podpis zaufany, podpis osobisty (e-dowód) czy potrzebny jest kwalifikowany. Rozporządzenie o ocenach mówi tylko „podpis”. Do ustalenia z mentorami (sekcja 21).
- EZD i obieg dokumentów: rozporządzenie PRM w sprawie instrukcji kancelaryjnej (Dz.U. 2011 poz. 67) określa zasady kancelaryjne i system EZD jako podstawowy sposób dokumentowania w wielu urzędach. Integracja z EZD (F-13) powinna to uwzględniać.

## 18. Ochrona danych osobowych

- RODO (UE 2016/679) i ustawa o ochronie danych osobowych (Dz.U. 2019 poz. 1781 t.j.).
- Podstawa przetwarzania danych w ocenie: obowiązek prawny administratora (art. 6 ust. 1 lit. c RODO w zw. z art. 81 ustawy o SC i art. 94 KP). Administratorem jest urząd (pracodawca), nie dostawca aplikacji. Dostawca hostingu lub modelu AI to podmiot przetwarzający (art. 28 RODO, umowa powierzenia).
- Dane o zdrowiu (np. przyczyny nieobecności, sygnały wypalenia powiązane ze zdrowiem) to szczególna kategoria (art. 9 RODO). Art. 22^1b § 1 KP: zgoda pracownika może być podstawą przetwarzania takich danych wyłącznie, gdy pracownik przekazuje je z własnej inicjatywy. Dostęp do nich mają tylko osoby z pisemnym upoważnieniem pracodawcy (§ 3). Wniosek: moduł dobrostanu nie powinien zbierać ani wnioskować danych o zdrowiu. Może przyjąć informację, którą pracownik sam przekazał, z oddzielnym, zawężonym dostępem.
- Zautomatyzowane decyzje: art. 22 RODO. Ocena musi pozostać decyzją człowieka (spójne z wymogiem F-10).
- Prawa osoby ocenianej: informacja (art. 13), dostęp (art. 15). Notatki przełożonego o pracowniku to dane osobowe ocenianego, z prawem dostępu.
- Wymogi T-07: privacy by design (art. 25), ocena skutków dla ochrony danych (DPIA, art. 35) przy systematycznej ocenie pracowników z użyciem nowych technologii, minimalizacja, anonimizacja lub pseudonimizacja przed wysłaniem do zewnętrznego modelu, transfer poza EOG tylko z podstawą z rozdziału V RODO.
- Okres przechowywania notatek roboczych spoza arkusza: do ustalenia. Arkusz to dokumentacja pracownicza (10 lat), notatki robocze nie muszą nią być.

## 19. AI Act i polska ustawa o systemach AI

**Klasyfikacja**

- Rozporządzenie UE 2024/1689 (AI Act), załącznik III pkt 4 lit. b: systemy AI przeznaczone do podejmowania decyzji wpływających na warunki stosunków pracy, awans, rozwiązanie stosunku pracy, przydzielania zadań w oparciu o zachowanie lub cechy osobowości, albo do monitorowania lub oceny wydajności i zachowania osób w takich stosunkach są **systemami wysokiego ryzyka**.
- Wyjątek z art. 6 ust. 3: system z załącznika III nie jest wysokiego ryzyka, gdy nie stwarza znaczącego ryzyka, bo np. wykonuje wąskie zadanie proceduralne, poprawia wynik wcześniej zakończonej czynności człowieka, wykrywa wzorce bez zastępowania oceny człowieka albo wykonuje zadanie przygotowawcze (zob. też motyw 53). Wyjątek **nie działa**, jeśli system profiluje osoby fizyczne.
- Wniosek projektowy: funkcje typu formatowanie, walidacja formalna, podpowiedzi pytań, redakcja tekstu na bazie notatek przełożonego mieszczą się raczej w art. 6 ust. 3. Funkcje oceniające pracownika (scoring, przewidywanie wypalenia, rekomendacja oceny) to najpewniej wysokie ryzyko albo profilowanie. Warto świadomie wybrać granicę i opisać ją w prezentacji.

**Zakazy**

- Art. 5 ust. 1 lit. f: zakaz systemów AI do wyciągania wniosków na temat emocji osoby fizycznej w miejscu pracy (wyjątek: względy medyczne lub bezpieczeństwa). Obowiązuje od 2.02.2025. Ma bezpośredni wpływ na F-44: nie wolno wykrywać wypalenia lub spadku motywacji przez analizę emocji (np. z głosu, twarzy, tekstu jako emocji). Bezpieczniej opierać sygnały na faktach organizacyjnych (obciążenie zadaniami, nadgodziny, zmiany zakresu, nieodebrane urlopy) wprowadzanych i interpretowanych przez przełożonego.

**Obowiązki podmiotu stosującego (urząd) dla systemu wysokiego ryzyka**

- Art. 26: stosowanie zgodnie z instrukcją, nadzór człowieka, logi, monitoring. Art. 26 ust. 7: przed użyciem w miejscu pracy pracodawca informuje przedstawicieli pracowników i pracowników.
- Art. 27: podmioty prawa publicznego przed wdrożeniem przeprowadzają ocenę skutków dla praw podstawowych (FRIA).
- Art. 4: kompetencje w zakresie AI (AI literacy) personelu, obowiązuje od 2.02.2025.
- Art. 50: przejrzystość, m.in. informacja, że treść wygenerowała AI.

**Terminy**

- Obowiązki dla systemów wysokiego ryzyka z załącznika III pierwotnie od 2.08.2026. Rozporządzenie Digital Omnibus on AI (UE 2026/1744 z 8.07.2026, publikacja w Dz.Urz. UE 24.07.2026) przesunęło je na **2.12.2027** (źródła wtórne: [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/), [DLA Piper](https://www.dlapiper.com/en/insights/publications/law-in-tech/2026/digital-omnibus-on-ai), [Cuatrecasas](https://www.cuatrecasas.com/en/portugal/intellectual-property/art/digital-omnibus-ai-has-been-published), [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)). Tekst urzędowy PL pobrany później z EUR-Lex: `archive/docs/sources/orzecznictwo-uodo-ai/raw/ue-2026-1744-omnibus-ai-dzurz-pl.pdf`. Systemy organów publicznych wprowadzone przed 2.12.2027 muszą być zgodne do 2.08.2030 (art. 111 ust. 2). Wytyczne KE wprost: AI do wykrywania wypalenia lub oceny dobrostanu pracowników z danych biometrycznych jest zakazana, a asystent redakcji gotowej oceny z flagowaniem stronniczych sformułowań to przykład filtra z art. 6 ust. 3 lit. b. Szczegóły: [sources/orzecznictwo-uodo-ai/FINDINGS.md](sources/orzecznictwo-uodo-ai/FINDINGS.md). Wdrożenie produkcyjne przez KPRM najpewniej trafi po tej dacie, więc projekt powinien od razu przewidywać wymogi.

**Polska ustawa**

- Ustawa z 3.07.2026 r. o systemach sztucznej inteligencji (Dz.U. 2026 poz. 1003), w życiu od 11.08.2026. Organ nadzoru rynku: Komisja Rozwoju i Bezpieczeństwa Sztucznej Inteligencji (art. 5). Przewiduje piaskownice regulacyjne (art. 91). Może być przydatna do pilotażu.

## 20. Dostępność cyfrowa, interoperacyjność, bezpieczeństwo

- **Dostępność**: ustawa o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych (Dz.U. 2023 poz. 1440 t.j.). Wymagania z załącznika uważa się za spełnione przy zgodności z pkt 9, 10 i 11 normy EN 301 549 V3.2.1:2021 (art. 5 ust. 3), czyli w praktyce WCAG 2.1 AA. Ustawa definiuje intranet i ekstranet (art. 4), więc aplikacja wewnętrzna urzędu też powinna to spełniać. Trzeba też przewidzieć deklarację dostępności.
- **Interoperacyjność**: ustawa o informatyzacji działalności podmiotów realizujących zadania publiczne (Dz.U. 2026 poz. 1241 t.j.) i rozporządzenie RM w sprawie Krajowych Ram Interoperacyjności (Dz.U. 2024 poz. 773). KRI określa minimalne wymagania dla systemów teleinformatycznych administracji: formaty danych, wymiana informacji, bezpieczeństwo informacji, dostępność usług. Istotne dla eksportu (F-11) i integracji (F-13).
- **Cyberbezpieczeństwo**: ustawa o krajowym systemie cyberbezpieczeństwa (Dz.U. 2026 poz. 20 t.j., kolejne zmiany w 2026). Urzędy administracji rządowej mają obowiązki w zakresie zarządzania ryzykiem i incydentami. Wpływa na wymogi wobec dostawcy i hostingu.

## 21. Otwarte pytania do mentorów

1. ~~Czy dostaniemy materiały z sekcji 7 general-info?~~ Otrzymane 21.11.2026, w `docs/zasoby-kprm/`.
2. Jakiej formy podpisu oczekują urzędy pod arkuszem w wersji cyfrowej: zatwierdzenie w systemie, podpis zaufany, podpis osobisty, kwalifikowany? Czy wydruk do podpisu odręcznego ma zostać jako tryb awaryjny?
3. Jakie systemy kadrowe i EZD są najczęstsze w urzędach (do integracji i importu danych pracowników i struktury)?
4. Czy wolno używać zewnętrznych modeli AI (chmura) przy anonimizacji, czy oczekiwany jest model lokalny?
5. Co konkretnie zmienia procedowana nowelizacja w ocenach i kiedy ma wejść w życie (jeśli research nie da pełnej odpowiedzi)?
6. Czy pierwsza ocena (art. 38) ma być w zakresie?
7. Czy kryterium obowiązkowe może być też wybrane jako dodatkowe (praktyka DSC)?
8. Czy statystyki dla DG mają obejmować rozkład ocen per komórka, terminowość, realizację IPRZ?
9. Jaką rolę ma pełnić komórka kadrowa w systemie: tylko podgląd i przypomnienia, czy także zakładanie ocen i przypisywanie oceniających?
10. Wyciąg z ustawy w pakiecie ma nagłówek t.j. Dz.U. 2026 poz. 590, ale art. 81 ust. 2, art. 82 pkt 2 i art. 83 ust. 2 są w nim w brzmieniu sprzed 2016 r. W Dz.U. 2026 poz. 590 art. 81 ust. 2 i art. 83 ust. 2 są uchylone. Którą wersję mamy przyjąć? Czy są dziś oceniani członkowie korpusu, których nie ocenia bezpośredni przełożony albo którzy wnoszą sprzeciw do kogoś innego niż DG? Do kogo wnosi sprzeciw oceniany na arkuszu A (w przykładach EX-1 i EX-6 jest to „Lekarz Weterynarii” i „Mazowiecki Wojewódzki Lekarz Weterynarii”)? Dotychczas przyjmujemy Dz.U., a adresat sprzeciwu jest parametrem.

## 22. Rejestr źródeł i status pobrania

### 22.1. Akty prawne pobrane (API Sejmu ELI, EUR-Lex przez Cellar)

| Plik | Akt | Źródło |
|---|---|---|
| 01-ustawa-o-sluzbie-cywilnej-tj-2026 | Ustawa z 21.11.2008 r. o służbie cywilnej, Dz.U. 2026 poz. 590 t.j. | api.sejm.gov.pl/eli/acts/DU/2026/590 |
| 02-rozp-prm-oceny-okresowe-2016 | Rozporządzenie PRM z 4.04.2016 r. w sprawie ocen okresowych, Dz.U. 2016 poz. 470 | DU/2016/470 |
| 03-rozp-prm-pierwsza-ocena-2015 | Rozporządzenie PRM z 23.07.2015 r. w sprawie pierwszej oceny, Dz.U. 2015 poz. 1144 | DU/2015/1144 |
| 04-rozp-prm-szkolenia-w-sc-2015 | Rozporządzenie PRM z 24.06.2015 r. w sprawie szkoleń w SC, Dz.U. 2015 poz. 960 | DU/2015/960 |
| 05-rozp-prm-stanowiska-kwalifikacje-stopnie-tj-2025 | Rozporządzenie PRM w sprawie stanowisk urzędniczych, kwalifikacji, stopni służbowych, mnożników, Dz.U. 2025 poz. 670 t.j. | DU/2025/670 |
| 06-zarz-70-prm-zasady-sc-i-etyki-2011 | Zarządzenie nr 70 PRM z 6.10.2011 r. (zasady SC i etyka korpusu), M.P. 2011 nr 93 poz. 953 | MP/2011/953 |
| 07-zarz-1-prm-opisy-wartosciowanie-stanowisk-2011 | Zarządzenie nr 1 PRM z 7.01.2011 r. (opisy i wartościowanie stanowisk), M.P. 2011 nr 6 poz. 61 | MP/2011/61 |
| 08-zarz-57-prm-zmiana-opisy-wartosciowanie-2015 | Zarządzenie nr 57 PRM z 24.07.2015 r. zmieniające powyższe, M.P. 2015 poz. 724 | MP/2015/724 |
| 10-kodeks-pracy-tj-2026 | Kodeks pracy, Dz.U. 2026 poz. 1245 t.j. | DU/2026/1245 |
| 11-rozp-mrpips-dokumentacja-pracownicza-tj-2026 | Rozporządzenie MRPiPS w sprawie dokumentacji pracowniczej, Dz.U. 2026 poz. 474 t.j. | DU/2026/474 |
| 12-ustawa-o-ochronie-danych-osobowych-tj-2019 | Ustawa o ochronie danych osobowych, Dz.U. 2019 poz. 1781 t.j. | DU/2019/1781 |
| 13-ustawa-dostepnosc-cyfrowa-tj-2023 | Ustawa o dostępności cyfrowej, Dz.U. 2023 poz. 1440 t.j. | DU/2023/1440 |
| 14-ustawa-o-informatyzacji-tj-2026 | Ustawa o informatyzacji, Dz.U. 2026 poz. 1241 t.j. | DU/2026/1241 |
| 15-rozp-rm-krajowe-ramy-interoperacyjnosci-2024 | Rozporządzenie RM w sprawie KRI, Dz.U. 2024 poz. 773 | DU/2024/773 |
| 16-ustawa-uslugi-zaufania-identyfikacja-tj-2024 | Ustawa o usługach zaufania oraz identyfikacji elektronicznej, Dz.U. 2024 poz. 1725 t.j. | DU/2024/1725 |
| 17-rozp-prm-instrukcja-kancelaryjna-2011 | Rozporządzenie PRM w sprawie instrukcji kancelaryjnej, Dz.U. 2011 poz. 67 | DU/2011/67 |
| 18-ustawa-krajowy-system-cyberbezpieczenstwa-tj-2026 | Ustawa o krajowym systemie cyberbezpieczeństwa, Dz.U. 2026 poz. 20 t.j. | DU/2026/20 |
| 19-nowelizacja-usc-2023 | Ustawa z 14.04.2023 r. o zmianie ustawy o SC, Dz.U. 2023 poz. 1195 | DU/2023/1195 |
| 20-ustawa-zmiana-ustaw-administracja-rzadowa-2026 | Ustawa z 9.01.2026 r. o zmianie niektórych ustaw związanych z funkcjonowaniem administracji rządowej, Dz.U. 2026 poz. 160 | DU/2026/160 |
| 21-ustawa-o-systemach-sztucznej-inteligencji-2026 | Ustawa z 3.07.2026 r. o systemach sztucznej inteligencji, Dz.U. 2026 poz. 1003 | DU/2026/1003 |
| 30-ue-rodo-2016-679 | RODO, rozporządzenie UE 2016/679 (PL) | publications.europa.eu, CELEX 32016R0679 |
| 31-ue-ai-act-2024-1689 | AI Act, rozporządzenie UE 2024/1689 (PL) | CELEX 32024R1689 |
| 32-ue-eidas-2014-910 | eIDAS, rozporządzenie UE 910/2014 (PL) | CELEX 32014R0910 |
| 33-ue-eidas2-zmiana-2024-1183 | eIDAS 2, rozporządzenie UE 2024/1183 (PL) | CELEX 32024R1183 |

Uwaga: teksty jednolite UE w PDF to wersje pierwotne z Dz.Urz. UE. Zmiany AI Act z 2026 r. (Digital Omnibus) nie są w nich uwzględnione.

### 22.2. Nie udało się pobrać

| Co | Próby | Powód |
|---|---|---|
| Rozporządzenie UE 2026/1744 (Digital Omnibus on AI), tekst: **ostatecznie pobrany** przez drugiego agenta z EUR-Lex (PDF PL), poniżej pierwotne próby | EUR-Lex PDF i ELI (`eur-lex.europa.eu`, `data.europa.eu/eli/reg/2026/1744/oj`), Cellar (`publications.europa.eu/resource/celex/32026R1744` i `/resource/eli/reg/2026/1744/oj`), tekst przyjęty PE `TA-10-2026-0198_pl.pdf` | EUR-Lex odpowiada HTTP 202 (ochrona przed botami, wymaga JavaScriptu). Cellar zwraca 404 dla CELEX 32026R1744. PDF z PE ma tylko 3 strony (sama rezolucja, bez tekstu rozporządzenia). Treść zmian opisana na podstawie źródeł wtórnych w sekcji 19 |
| Pobranie aktów UE bezpośrednio z EUR-Lex | jw. | ten sam blok, obejście przez Cellar zadziałało dla 4 pozostałych aktów UE |

> Rejestr do uzupełnienia o wyniki researchu agentów (zarządzenie nr 6, projekt nowelizacji, strategia, materiały DSC).

## 23. Kontakty

Mentorzy KPRM dostępni 24 h przy stoisku. Pełna lista z telefonami w [general-info.md](general-info.md), sekcja 10.

- Wsparcie merytoryczne, Departament Służby Cywilnej: Jacek Pawłowski, Julia Tyszko, Karolina Świszcz, Kamil Kazimierczuk, Magda Pruszyńska-Gora, Joanna Skrzyńska.
- Wsparcie techniczne, Biuro Informatyki: Maciej Szczygieł, Rafał Jabłoński.
