# Standardy UX, dostępność i dokumenty PDF: ustalenia

Kontekst: aplikacja webowa „Cyfrowy Asystent Ocen Okresowych” dla urzędów służby cywilnej ([docs/general-info.md](../../general-info.md)). Stan na 2026-11-21. Każdy fakt ma link do źródła. Kopie źródeł leżą w `raw/` i `text/`, spis w [INDEX.md](INDEX.md). Wnioski autora tego opracowania oznaczono słowem „Wniosek”.

## 1. Ramy prawne dostępności, które dotyczą narzędzia

- Ustawa o dostępności cyfrowej (t.j. Dz. U. 2023 poz. 1440) w art. 5 ust. 3 uznaje wymagania za spełnione, gdy podmiot uwzględnia pkt 9, 10 i 11 Polskiej Normy wprowadzającej ETSI EN 301 549 V3.2.1:2021. Załącznik do ustawy to lista kryteriów WCAG 2.1. Źródło: `docs/legal/text/13-ustawa-dostepnosc-cyfrowa-tj-2023.txt`, ISAP: https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20230001440
- Rozdział 10 normy EN 301 549 dotyczy dokumentów innych niż strony WWW („Non-web documents”), czyli także eksportowanych PDF. Źródło: https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
- Wyłączenie z art. 3 ust. 2 pkt 6 obejmuje tylko treści intranetu i ekstranetu opublikowane przed 23 września 2019 r. i od tego czasu nieprzebudowywane. Źródło: jak wyżej, plik ustawy w `docs/legal/text/`.
- Ministerstwo Cyfryzacji w FAQ pisze, że ustawa dotyczy wszystkich treści wyświetlanych w przeglądarce, także intranetu. Dokumenty wewnętrzne w intranecie „podlegają ustawie w takim samym stopniu jak strony internetowe”. Źródło: https://www.gov.pl/web/dostepnosc-cyfrowa/podmioty-publiczne
- Wniosek: aplikacja webowa dla pracowników urzędu, nawet wewnętrzna, musi spełniać WCAG 2.1 AA i mieć deklarację dostępności. Arkusze PDF udostępniane w aplikacji też muszą być dostępne.
- Ten sam FAQ powołuje § 19 rozporządzenia KRI z 2012 r. jako wymóg dla programów spoza przeglądarki. Rozporządzenie z 2012 r. straciło moc. Nowe KRI z 21 maja 2024 r. (Dz. U. 2024 poz. 773) nie zawiera słów „WCAG” ani odwołania do EN 301 549 (przeszukano tekst w `docs/legal/text/15-rozp-rm-krajowe-ramy-interoperacyjnosci-2024.txt`). Wniosek: FAQ w tym punkcie jest nieaktualne.
- EN 301 549 V4.1.1 opublikowano we wrześniu 2026 r. (nagłówek dokumentu: „EN 301 549 V4.1.1 (2026-09)”). Źródło: https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf
- Według Deque wersja 4.1.1 przenosi bazę z WCAG 2.1 na WCAG 2.2, a cytowanie w Dzienniku Urzędowym UE przesunięto na 22 stycznia 2027 r. Źródło wtórne: https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/
- Komisja Europejska podaje, że zharmonizowana jest wersja V3.2.1 (od 18 sierpnia 2021 r.) i że WCAG 2.2 ma skutek prawny dopiero po cytowaniu nowej wersji normy w Dzienniku Urzędowym. Źródło: https://digital-strategy.ec.europa.eu/en/policies/web-accessibility-directive-standards-and-harmonisation
- Wniosek: polska ustawa wskazuje wprost V3.2.1, więc obowiązkiem prawnym pozostaje WCAG 2.1 AA. Projektowanie od razu pod WCAG 2.2 AA zabezpiecza przed zmianą przepisów.

### Najczęstsze błędy w monitoringu MC

Raport MC z monitoringu (próba 100 stron) wymienia najczęstsze błędy: błędy walidacji HTML (100 stron), kontrast poniżej 4,5:1 (94), zła kolejność nagłówków (82), kontrast poniżej 3:1 (73), zły tekst alternatywny (67), niedostępne dokumenty do pobrania (65). Wśród złych praktyk raport wymienia „załączniki w formacie pdf nie są dostępne (brak title, struktury nagłówkowej, tagów)” i publikowanie skanów. Źródło: https://www.gov.pl/attachment/03cf5310-2205-474b-9f0f-d0edd0f46bdf

### Deklaracja dostępności

- Obowiązek wynika z art. 10 ustawy. Deklaracja ma format HTML i musi być w pełni dostępna, nawet gdy sama strona nie jest. Źródło (warunki techniczne, wersja z 2020 r.): https://www.gov.pl/attachment/3cb8d677-3b5e-46a1-a32e-9acb3f4f002a
- Link do deklaracji ma być na każdej podstronie, np. w stopce. Dobra praktyka to meta tag `<meta name="deklaracja-dostępności" content="URL">`. Źródło: https://www.gov.pl/web/dostepnosc-cyfrowa/deklaracja-dostepnosci-na-stronach-internetowych
- MC opublikowało wersję 2.0 warunków technicznych w BIP (strona z tekstem była w dniu pobrania niedostępna, patrz INDEX). Projekt v2.0 z uwagami PTI (IV 2024) wprowadza nowe identyfikatory, m.in. `a11y-zakres`, `a11y-data-przeglad`, `a11y-komunikacja`, `a11y-architektura-url`. Źródło: https://pti.org.pl/wp-content/uploads/2024/08/001_Warunki-techniczne-Deklaracja-Dostepnosci%E2%80%94-uwagi_wersja_20240420_final.docx
- Żywa deklaracja MC i deklaracja serwisu Gov.pl już używają identyfikatorów v2.0 (`a11y-zakres`, `a11y-data-przeglad`, `a11y-komunikacja`). Można je traktować jako wzór HTML. Źródła: https://www.gov.pl/web/dostepnosc-cyfrowa/deklaracja-dostepnosci oraz https://www.gov.pl/web/gov/deklaracja-dostepnosci-serwisu-govpl
- Daty w deklaracji podaje się w formacie rrrr-mm-dd. Status zgodności wybiera się z trzech stałych formuł: zgodna, częściowo zgodna, niezgodna. Źródło: https://www.gov.pl/attachment/3cb8d677-3b5e-46a1-a32e-9acb3f4f002a
- Na żądanie zapewnienia dostępności podmiot odpowiada w 7 dni, z możliwością przesunięcia do 2 miesięcy. Źródło (wzór MC): https://www.gov.pl/web/dostepnosc-cyfrowa/deklaracja-dostepnosci

## 2. Gov.pl Design System (Przewodnik Gov UI)

- Adres: https://aplikacje.gov.pl/app/govpl-front-styleguide/ . Strona główna podaje nazwę „Design System Gov.pl, wersja 1.0 beta” i deklaruje zgodność kodu z WCAG 2.1. Właścicielem merytorycznym wytycznych jest KPRM, kontakt redakcja@cyfra.gov.pl.
- Zawartość: wytyczne (kolory, ikony, typografia, odstępy, ratio zdjęć, grid, język i treść, dostępność cyfrowa), 17 komponentów (m.in. przycisk, input, textarea, radio, checkbox, komunikat, select, datepicker, uploader, stepper, breadcrumbs, accordion) i struktury (górna belka Gov.pl, stopki, menu). Źródło: jak wyżej.
- Kod HTML i CSS komponentu można skopiować z podglądu albo pobrać CSS wybranych komponentów. Pełną bibliotekę SCSS dostaje się po mailu do redakcja@cyfra.gov.pl z nazwą instytucji i projektu. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/jak-otrzymac-biblioteke
- Licencja: serwis nie podaje licencji kodu ani warunków ponownego użycia. Nie znaleziono publicznego repozytorium GitHub, pakietu npm ani biblioteki Figma (wyszukiwania opisane w INDEX). Wniosek: Gov.pl Design System nie jest projektem open source w sensie formalnym. Przed wdrożeniem trzeba uzyskać zgodę KPRM lub zbudować własne komponenty w stylistyce Gov.pl.
- Górną belkę Gov.pl umieszcza się na stronach publikowanych w ramach jednego portalu, np. Gov.pl lub Samorzad.gov.pl. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/struktury/gorna-belka . Wniosek: aplikacja wdrażana lokalnie w urzędzie nie jest częścią portalu Gov.pl i nie powinna używać tej belki.

### Kolory i kontrast

Paleta podstawowa: Dark blue #0052a5, Light blue #006cd7, Black #1b1b1b, Gray 1 #656565, Gray 2 #767676, Gray 3 #b7b7b7, Gray 3a #dadada, Gray 4 #f1f1f1. Paleta dodatkowa: Navy blue #00468d, Dark red #a7162d, Light red #d5233f, Yellow #eba828, Yellow bright #ffc605, Green #598527. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/wytyczne/kolory

Kontrast na białym tle policzony wzorem WCAG 2.1 (obliczenie własne):

| Kolor | Kontrast | Tekst zwykły (4,5:1) |
|---|---|---|
| Dark blue #0052a5 | 7,64 | tak |
| Light blue #006cd7 | 5,09 | tak |
| Gray 1 #656565 | 5,83 | tak |
| Gray 2 #767676 | 4,54 | tak, na granicy |
| Gray 3 #b7b7b7 | 2,01 | nie (tylko dekoracja) |
| Dark red #a7162d | 7,51 | tak |
| Light red #d5233f | 5,07 | tak |
| Green #598527 | 4,37 | nie |
| Yellow #eba828 | 2,07 | nie |

Wniosek: zielony z palety Gov.pl nie nadaje się na tekst komunikatu sukcesu na białym tle. Trzeba użyć ciemniejszego odcienia lub zielonego tylko jako tła z ciemnym tekstem.

### Typografia

- Font Open Sans (6 odmian), tekst bazowy 16 px, interlinia 1,5 dla akapitów i 1,25 dla nagłówków, wyrównanie do lewej. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/wytyczne/typografia
- Przewodnik podaje, że Open Sans jest na licencji Apache 2.0. Aktualny plik licencji w repozytorium Google Fonts to SIL Open Font License 1.1. Źródło: https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OFL.txt . Wniosek: obie licencje pozwalają na bezpłatne użycie, ale w dokumentacji projektu trzeba wpisać OFL 1.1.

### Wytyczne komponentów ważne dla formularza oceny

- Stepper: każdy krok na osobnej podstronie, najlepiej 3 do 5 kroków, nie więcej niż 6 do 7. Są dwa warianty: z ustaloną kolejnością (powrót tylko do ukończonych kroków) i z dowolną kolejnością (dla rozbudowanych wniosków). Stany: Active, Next enabled, Next disabled, Finished, Error. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/komponenty/stepper
- Komunikat: osadzony w treści strony, nie pływający. W formularzach stosowany razem z komunikatami walidacyjnymi przy polach. Komunikat o błędzie mówi, gdzie jest błąd, na czym polega i co zrobić. Komunikat zawsze ma piktogram. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/komponenty/alert
- Przycisk: jeden przycisk primary na stronie. Czerwone warianty dla akcji nieodwracalnych. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/komponenty/button
- Textarea: wariant z licznikiem znaków („pozostało 200 znaków”). Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/komponenty/textarea
- Radio: grupa w `fieldset` z `legend`, poziomo tylko 2 do 4 krótkich opcji. Źródło: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/komponenty/radio

### Język i treść (rekomendacje redakcji Portalu RP)

Źródło dla całej listy: https://aplikacje.gov.pl/app/govpl-front-styleguide/dokumentacja/wytyczne/jezyk-i-tresc

- Tekst ma być zrozumiały dla osoby po 8 do 9 latach nauki szkolnej.
- Do użytkownika zwracaj się „per ty”, np. „Wpisz adres e-mail”. Unikaj „Państwo”.
- Nie używaj form ujawniających płeć („zmieniłeś”, „zrobiłaś”), strony biernej i rzeczowników odczasownikowych.
- Trudne słowo wyjaśniaj w nawiasie. Rozwijaj skrótowce przy pierwszym użyciu.
- Linki mówią, dokąd prowadzą. Przy plikach podawaj format i rozmiar.
- Nie wyróżniaj treści samym kolorem. Zamiast wykresu dawaj tabelę z danymi.
- Etykiety zakładek: tylko pierwsze słowo wielką literą.

## 3. Zasady budowy cyfrowych usług publicznych (MC, 2016)

Nie znaleziono dokumentu o nazwie „Standard Usług Cyfrowych”. Najbliższy rządowy odpowiednik to „Metareguły i zasady budowy cyfrowych usług publicznych” (MC, październik 2016). Źródło: https://www.gov.pl/attachment/fa502e29-fbe4-48c2-b584-3724377631fe

- Dokument opisuje 16 zasad w trzech obszarach: projektowanie usług, organizacja prac, technologie.
- Usługa intuicyjna ma: prowadzić przez proces bez wątpliwości, informować o bieżącym miejscu w procesie, pozwalać przerwać i wrócić bez utraty danych, dawać kontekstową pomoc.
- Zasada „once only”: nie wolno żądać danych, które administracja już ma.
- Decyzje projektowe mają wynikać z badań z użytkownikami, a nie z przeczuć. Usługę testuje się na etapie makiety lub prototypu.
- Wymóg dostępności w tym dokumencie odnosi się jeszcze do WCAG 2.0.

## 4. mObywatel: kod i design system

- MC opublikowało 29.12.2025 r. informację o udostępnieniu kodu mObywatela, zgodnie z ustawą z 26 maja 2023 r. o aplikacji mObywatel. Źródło: https://www.gov.pl/web/cyfryzacja/ministerstwo-cyfryzacji-opublikowalo-kod-zrodlowy-mobywatela
- Udostępniono część kodu „prezentującą filozofię oraz strukturę kodowania”. Dostęp wymaga potwierdzenia tożsamości, zgodnie z rekomendacją CSIRT MON. Źródło: https://www.gov.pl/web/cyfryzacja/kod-zrodlowy-aplikacji-mobywatel
- Prasa podaje, że to tylko kod interfejsu, objęty licencją MIT, oglądany jako pojedyncze pliki HTML bez możliwości pobrania. Źródło: https://www.instalki.pl/news/bezpieczenstwo/open-source-wedlug-ministerstwa-cyfryzacji-opublikowali-kod-mobywatela-ale-tylko-ui/
- Próba wejścia na https://www.mobywatel.gov.pl/kod-zrodlowy-mobywatel-mobilny kończy się przekierowaniem na login.gov.pl (sprawdzone 2026-11-21).
- Wniosek: design system mObywatela dotyczy aplikacji mobilnej i nie da się go praktycznie pobrać ani włączyć do projektu. Nie ma publicznych wytycznych projektowych mObywatela dla aplikacji webowych.

## 5. Prosty język

- Szef Służby Cywilnej w grudniu 2020 r. skierował do urzędów administracji rządowej zalecenie „Upowszechnianie prostego języka”. Celem jest, aby prosty język stał się standardem komunikacji pisemnej w urzędach. Źródło: https://www.gov.pl/web/sluzbacywilna/zalecenie-szefa-sluzby-cywilnej-ws-prostego-jezyka (PDF dostępny: https://www.gov.pl/attachment/d3566d11-1823-42ee-9a17-6d860b1ad172)
- W służbie cywilnej działa sieć liderów prostego języka. Zespół ds. promocji prostego języka powołano w czerwcu 2019 r. Źródło: jak wyżej.
- Zasady według serwisu służby cywilnej: najważniejsze na początku, zwracaj się wprost do odbiorcy, zdania do 15 do 20 wyrazów, naturalny szyk, nagłówki, listy, tabele. Źródło: https://www.gov.pl/web/sluzbacywilna/prosty-jezyk
- „Prosty język, ustandaryzowane zasady” (Jasnopis, Fundacja Języka Polskiego, US, UAM, UW): akapit z 3 do 5 krótkich zdań, zdania ok. 20 wyrazów, jedno zdanie to jedna myśl, zdania twierdzące zamiast przeczących, lista trudnych słów (np. „przedmiotowej sprawie”, „niniejszym”, słowa na -anie, -enie, -acja). Źródło: https://www.uw.edu.pl/wp-content/uploads/2024/10/prosty-jezyk-%E2%80%93-standard.pdf
- ISO 24495-1:2023 „Plain language, Part 1: Governing principles and guidelines”, wydanie 1, czerwiec 2023, 14 stron, ISO/TC 37, cena CHF 135. Norma nie obejmuje wymagań dostępności i odsyła do WCAG oraz EN 301 549. Źródło: https://www.iso.org/standard/78907.html
- Nie potwierdzono polskiej wersji PN-ISO 24495-1 (wyszukiwarka PKN, patrz INDEX).
- Narzędzia: Jasnopis mierzy trudność tekstu w skali 1 do 7 (https://www.jasnopis.pl/). Serwis służby cywilnej poleca też Logios (https://www.gov.pl/web/sluzbacywilna/gdzie-szukac-porad-i-narzedzi), ale domena logios.pl była w dniu sprawdzenia zaparkowana.
- Rada Języka Polskiego zaleca, by teksty użytkowe były zrozumiałe dla absolwentów gimnazjum (FOG 9 do 10). Źródło: https://www.gov.pl/web/sluzbacywilna/gdzie-szukac-porad-i-narzedzi

## 6. Wzorce GOV.UK dla procesu krok po kroku

Licencje: kod GOV.UK Frontend jest na licencji MIT (Crown Copyright, GDS), https://raw.githubusercontent.com/alphagov/govuk-frontend/main/LICENSE.txt . Treści serwisu Design System są na Open Government Licence v3.0, a stopka podaje wersję GOV.UK Frontend v6.6.0 (https://design-system.service.gov.uk/). Najnowsze wydanie na GitHub to v6.6.0 z 15.10.2026 (https://api.github.com/repos/alphagov/govuk-frontend/releases).

Ograniczenie marki: serwis spoza GOV.UK może używać wzorców, ale nie może używać korony, logotypu GOV.UK, kroju GDS Transport ani kolorów marki GOV.UK. Ma używać logo i fontu własnej organizacji. Źródło: https://www.gov.uk/service-manual/design/making-your-service-look-like-govuk

### Question pages

Źródło: https://design-system.service.gov.uk/patterns/question-pages/

- Każda strona pytania ma link „Wstecz”, nagłówek strony i przycisk „Continue” (nie „Next”), wyrównany do lewej.
- Zacznij od jednego pytania na stronie. Grupowanie pytań dopuszcza się, gdy badania to uzasadniają, np. w usługach wewnętrznych dla urzędników, którzy szybko przełączają się między zadaniami.
- Etykieta lub legenda pola może być nagłówkiem strony, wtedy czytnik ekranu nie czyta tekstu dwa razy.
- Pola obowiązkowych nie oznacza się gwiazdką. Opcjonalne oznacza się dopiskiem „(optional)”.
- Tekst pomocniczy to jedno krótkie zdanie bez linków.
- Pasek postępu dodaje się dopiero, gdy testy pokażą taką potrzebę. Wzorzec odradza wskaźniki z listą wszystkich kroków i nawigacją między nimi. Serwis Carer’s Allowance usunął 12-krokowy wskaźnik bez wpływu na odsetek ukończeń.

### Complete multiple tasks i komponent Task list

Źródła: https://design-system.service.gov.uk/patterns/complete-multiple-tasks/ oraz https://design-system.service.gov.uk/components/task-list/

- Do długich transakcji z wieloma zadaniami, wykonywanymi w kilku sesjach. Stronę z listą zadań pokazuje się na starcie i na początku każdej kolejnej sesji.
- Nazwy zadań zaczynają się od czasownika. Statusy: zacznij od „Completed” i „Incomplete”, w razie potrzeby „Not yet started” i „In progress”. „Cannot start yet” dla zadań zablokowanych, bez linku. Czerwone tło tylko dla „There is a problem”.
- Na końcu zadania z długą odpowiedzią (textarea) lub wymagającego uzgodnienia z kimś innym można zapytać „Have you completed this section?” z opcjami „Yes, I’ve completed this section” i „No, I’ll come back later”.
- Gdy usługa wymaga ścisłej kolejności, task list nie jest właściwy. Wtedy lepiej zapisywać postęp i wracać do miejsca przerwania.
- Task list nie służy do pokazywania odpowiedzi. Do tego jest Summary list.

### Check answers

Źródło: https://design-system.service.gov.uk/patterns/check-answers/

- Jedna strona sprawdzenia przed potwierdzeniem. W bardzo dużych transakcjach strona sprawdzenia na końcu każdej sekcji, co jest przydatne, gdy różne osoby wypełniają różne sekcje.
- Przy każdej odpowiedzi link „Zmień” z ukrytym tekstem dla czytnika ekranu. Po zmianie przycisk wraca na stronę sprawdzenia.
- Przycisk wysyłki opisuje skutek, np. „Send your claim form”. Pominięte pytania opcjonalne pokazuje się jako „Not provided”.

### Walidacja i błędy

Źródła: https://design-system.service.gov.uk/patterns/validation/ oraz https://design-system.service.gov.uk/components/error-summary/

- Przy błędzie zawsze pokazuje się podsumowanie błędów na górze strony i komunikat przy polu. Fokus przechodzi na podsumowanie. Każdy błąd w podsumowaniu linkuje do pola. Tytuł strony dostaje przedrostek „Error: ”.
- Walidacja HTML5 jest wyłączona. Formularz akceptuje różne formaty danych, jeśli są jednoznaczne.

### Pozostałe komponenty

- Character count nie blokuje wpisywania ponad limit, tylko informuje o przekroczeniu. Najpierw trzeba przetestować formularz bez licznika. Źródło: https://design-system.service.gov.uk/components/character-count/
- Placeholder nie zastępuje etykiety, podpowiedzi ani przykładu. Źródło: https://design-system.service.gov.uk/components/text-input/
- Przycisków nieaktywnych (disabled) unika się, bo mają słaby kontrast i mylą. Źródło: https://design-system.service.gov.uk/components/button/
- Strona potwierdzenia ma numer referencyjny, informację co dalej, kontakt i sposób zapisania potwierdzenia, np. jako PDF. Źródło: https://design-system.service.gov.uk/patterns/confirmation-pages/
- Service Manual: przy przejściu z papieru na formularz cyfrowy nie przenosi się formularza papierowego jeden do jednego. Każde pytanie uzasadnia „question protocol”. Źródło: https://www.gov.uk/service-manual/design/form-structure

### Rozbieżności Gov.pl i GOV.UK

| Temat | Gov.pl Design System | GOV.UK |
|---|---|---|
| Placeholder | dopuszcza jako podpowiedź formatu | zakazuje jako podpowiedzi i przykładu |
| Przycisk nieaktywny | stan Disabled opisany jako standardowy | unikać, tylko gdy badania to uzasadniają |
| Pasek postępu | stepper zalecany, 3 do 5 kroków | najpierw bez wskaźnika, odradza listę wszystkich kroków |
| Pola obowiązkowe | brak reguły w przewodniku | bez gwiazdek, opcjonalne z dopiskiem |

Gov.pl w poradniku dostępności pisze, że sama gwiazdka nie wystarczy i informację o obowiązku warto dać w etykiecie pola. Źródło: https://www.gov.pl/web/dostepnosc-cyfrowa/formularze

## 7. Dostępne PDF i druk

### Standardy

- PDF/UA-1: ISO 14289-1:2014, wydanie 2, przegląd potwierdzony w 2025 r., cena CHF 100. Źródło: https://www.iso.org/standard/64599.html
- PDF/UA-2: ISO 14289-2:2024, wydanie 1, marzec 2024, dla PDF 2.0. Źródło: https://www.iso.org/standard/82278.html . PDF Association udostępnia ten dokument bezpłatnie dzięki sponsorom. Źródło: https://pdfa.org/iso-14289-2-pdfua-2/
- PDF/UA-2 nie zastępuje PDF/UA-1. Zgodność z PDF/UA nie gwarantuje dostępności treści (kolor, kontrast, trudność poznawcza). Źródło: https://pdfa.org/iso-14289-2-pdfua-2/
- Matterhorn Protocol 1.1 (kwiecień 2021) to lista wszystkich sposobów niespełnienia PDF/UA-1. Źródło: https://pdfa.org/resource/the-matterhorn-protocol/
- W3C publikuje techniki PDF1 do PDF23 dla WCAG 2.1, m.in. PDF16 (język dokumentu), PDF18 (tytuł), PDF9 (nagłówki), PDF6 (tabele), PDF3 (kolejność czytania). Źródło: https://www.w3.org/WAI/WCAG21/Techniques/

### Praktyka administracji

- Skany w PDF nie spełniają wymogów dostępności. Źródło: raport monitoringu MC, https://www.gov.pl/attachment/03cf5310-2205-474b-9f0f-d0edd0f46bdf
- Podmiot nie ma obowiązku publikować skanów. Dostępny dokument DOCX z informacją, kto go podpisał, jest wystarczający. Skan można dodać jako uzupełnienie. Źródło: https://www.gov.pl/web/dostepnosc-cyfrowa/czy-trzeba-publikowac-skany-dokumentow
- Przy eksporcie z Worda do PDF zaznacza się tagi ułatwień dostępu i format PDF/A. Źródło: https://www.gov.pl/web/dostepnosc-cyfrowa/jak-tworzyc-dostepne-dokumenty-tekstowe-w-edytorze-ms-word
- PFRON: tekst alternatywny grafik w nagłówku i stopce Worda znika po eksporcie do PDF, więc treść stopki lepiej powtórzyć na końcu dokumentu. Tabele tylko na dane, z oznaczonym wierszem nagłówka. Źródło: https://bip.pfron.org.pl/fileadmin/Zamowienia/Zapytania_ofertowe/2024_rok/2024-03-18_Kwartalnik_2024/03_Zalacznik_nr_2A_Dostepne_dokumenty_w_PFRON.pdf

### Darmowe narzędzia do generowania i walidacji

| Narzędzie | Wersja (2026-11-21) | Licencja | PDF/UA | Źródło |
|---|---|---|---|---|
| WeasyPrint (HTML i CSS do PDF, Python) | v70.0 (2026-09-08) | BSD-3-Clause | `--pdf-variant pdf/ua-1` lub `pdf/ua-2`, opcja `--pdf-tags`. Wymaga `<title>` i `lang` na `<html>`. Autorzy nie gwarantują poprawności wyniku. | https://doc.courtbouillon.org/weasyprint/stable/common_use_cases.html , https://api.github.com/repos/Kozea/WeasyPrint |
| Typst | v0.15.1 (2026-07-17) | Apache-2.0 | PDF/UA-1 z automatycznymi kontrolami (np. brak tekstu alternatywnego). Tagi domyślnie włączone. PDF/UA-1 i PDF/A-4 się wykluczają. | https://typst.app/docs/reference/pdf/ , https://api.github.com/repos/typst/typst |
| Chromium przez Puppeteer | 25.18.1 | Apache-2.0 (licencja Puppeteer, nie weryfikowano w tym zbiorze) | opcja `tagged` (eksperymentalna, domyślnie true) i `outline` | https://pptr.dev/api/puppeteer.pdfoptions |
| Chromium przez Playwright | `tagged` od v1.42, `outline` | Apache-2.0 (nie weryfikowano w tym zbiorze) | `page.pdf({tagged: true, outline: true})`, domyślnie false | https://playwright.dev/docs/api/class-page |
| LibreOffice (eksport PDF) | wydanie bieżące | MPL-2.0 (nie weryfikowano w tym zbiorze) | opcja „Universal Accessibility (PDF/UA)” wymusza Tagged PDF | https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export_general.html |
| veraPDF (walidator) | v1.30.4 (2026-11-10), wydanie oficjalne (parzysta wersja minor) | GPLv3+ lub MPLv2+ | walidacja PDF/A i PDF/UA | https://raw.githubusercontent.com/veraPDF/veraPDF-library/integration/README.md , https://verapdf.org/software/ |
| PAC 2026 (walidator) | 2026 | bezpłatny, zamknięty | PDF/UA i WCAG, podgląd czytnika ekranu, nowe testy wspierane AI | https://pac.pdf-accessibility.org/en |

Strona verapdf.org w dniu pobrania wyświetlała komunikat o czasowym wyłączeniu serwisu z powodu luki w PHP. Kod i wydania są dostępne na GitHub.

Wniosek: Chromium daje tagged PDF, ale nie deklaruje zgodności z PDF/UA. WeasyPrint jest jedynym z tych narzędzi, które z HTML generuje plik z deklaracją PDF/UA-1. Typst wymaga osobnego szablonu poza HTML.

## 8. Mapowanie procesu oceny na wzorce

Etapy procesu według [general-info.md](../../general-info.md): wybór arkusza (A, B lub C), wybór do 3 kryteriów dodatkowych, rozmowa rozpoczynająca, obserwacja i bieżąca informacja zwrotna, rozmowa oceniająca, sporządzenie oceny (w tym wnioski do IPRZ), podpisanie przez obie strony.

| Etap | Wzorzec | Uwagi |
|---|---|---|
| Ekran sprawy oceny | Task list (complete multiple tasks) | Proces trwa miesiącami i ma wiele sesji, czyli dokładnie przypadek z GOV.UK. Status „Cannot start yet” dla zadań zależnych, np. rozmowa oceniająca przed zamknięciem okresu. |
| Wybór arkusza | Question page z radio | Jedno pytanie na stronie. System może podpowiedzieć arkusz na podstawie stanowiska (zasada „once only”). |
| Kryteria dodatkowe | Question page z checkboxami i limitem 3 | Błąd walidacji przy 4. wyborze według wzorca Error summary. |
| Notatki z obserwacji i rozmów | Textarea z licznikiem znaków | Licznik nie blokuje wpisywania. Pytanie „Czy ta sekcja jest gotowa?” zamiast automatycznego statusu. |
| Ocena kryteriów | Grupa pytań na stronie | Grupowanie dozwolone w usługach wewnętrznych, jeśli badania to potwierdzą. |
| Przed podpisem | Check answers na końcu sekcji i całości | Sekcje wypełniają różne osoby (oceniający, oceniany, kadry). |
| Po podpisie | Confirmation page | Numer sprawy, co dalej, pobranie dostępnego PDF arkusza. |

## 9. Rekomendacje UX dla projektu

Kolejność według wpływu. Pierwsze dziesięć to lista priorytetowa.

1. **Traktuj aplikację jako objętą ustawą o dostępności cyfrowej.** Cel minimalny WCAG 2.1 AA (wymóg ustawy przez EN 301 549 V3.2.1), cel projektowy WCAG 2.2 AA (EN 301 549 V4.1.1 jest już opublikowana). Testy dostępności w definicji ukończenia każdej funkcji.
2. **Ekran główny oceny jako lista zadań ze statusami** (wzorzec GOV.UK Complete multiple tasks). Etapy oceny to zadania, statusy po polsku: „Do zrobienia”, „W trakcie”, „Gotowe”, „Jeszcze niedostępne”, „Wymaga poprawy”. Kolor nigdy nie jest jedynym nośnikiem statusu.
3. **Wewnątrz zadań stosuj question pages:** jedno pytanie lub jedna spójna grupa na stronie, link „Wstecz”, przycisk „Dalej” po lewej, zapisywanie przy każdym przejściu. Bez długiego steppera z wszystkimi krokami. Jeśli potrzebny jest stepper Gov.pl, to najwyżej 5 kroków.
4. **Strona „Sprawdź przed podpisaniem”** dla każdej sekcji i całego arkusza, z linkami „Zmień” z ukrytym tekstem dla czytnika ekranu. Przycisk opisuje skutek, np. „Podpisz i przekaż ocenianemu”.
5. **Wygląd spójny z Gov.pl, ale bez elementów portalu.** Paleta Gov.pl, Open Sans (OFL 1.1), tekst 16 px, interlinia 1,5. Bez górnej belki Gov.pl i bez znaków GOV.UK. Zielony #598527 nie jako tekst na białym (4,37:1). Przed użyciem biblioteki SCSS Gov.pl zapytaj KPRM o licencję (redakcja@cyfra.gov.pl).
6. **Walidacja według wzorca GOV.UK:** podsumowanie błędów na górze z fokusem i linkami do pól, komunikat przy polu, tytuł strony z przedrostkiem „Błąd: ”. Komunikat mówi, co poprawić (zgodnie z Gov.pl). Bez gwiazdek, pola opcjonalne z dopiskiem „(opcjonalnie)”.
7. **Treści interfejsu prostym językiem** zgodnie z zaleceniem Szefa SC z 2020 r.: forma „ty”, bez form rodzajowych („Zapisano” zamiast „Zapisałeś”), zdania do 15 do 20 wyrazów, najważniejsze na początku. Prawne nazwy pól arkusza zostają, ale z jednozdaniową podpowiedzią. Teksty sprawdzaj w Jasnopisie.
8. **Arkusz PDF generowany z HTML jako PDF/UA-1** (WeasyPrint `pdf/ua-1`), z tytułem, `lang="pl"`, prawdziwymi nagłówkami i tabelami z wierszem nagłówka. Walidacja każdej wersji szablonu w veraPDF (profil PDF/UA-1) w CI i ręcznie w PAC. Nigdy skan jako jedyna wersja.
9. **Zapis postępu i brak twardych limitów czasu.** Autozapis szkiców, powrót do przerwanej sesji, ostrzeżenie przed wygaśnięciem sesji z możliwością przedłużenia. Wynika to z metareguł MC 2016 i z wytycznych gov.pl o limitach czasowych.
10. **Deklaracja dostępności aplikacji** w HTML według warunków technicznych v2.0 (identyfikatory `a11y-*`), link w stopce każdej strony i meta tag. Wzór: deklaracja MC. Każdy urząd wdrażający uzupełnia swoje dane kontaktowe i procedurę.
11. Nie używaj placeholderów zamiast podpowiedzi ani przycisków nieaktywnych. Lepiej pokazać błąd po kliknięciu.
12. Statystyki dla dyrektora generalnego zawsze z tabelą danych obok wykresu (zasada Gov.pl).
13. Badaj prototyp z oceniającymi i ocenianymi z różnych typów urzędów, w tym z użytkownikami czytników ekranu, zanim zamrozisz przepływ (metareguły MC 2016).
14. Pytaj o dane tylko raz. Dane pracownika i stanowiska pobieraj z systemu kadrowego, nie z formularza.
```

### Pliki
- `/Users/aleksanderjozwik/study/sarmata/docs/sources/ux-standardy/INDEX.md`
- `/Users/aleksanderjozwik/study/sarmata/docs/sources/ux-standardy/raw/`
- `/Users/aleksanderjozwik/study/sarmata/docs/sources/ux-standardy/text/`
- Skrypty: `/private/tmp/claude-501/-Users-aleksanderjozwik-study-sarmata/9c95967c-9b4f-431c-8b9d-51d8f7f1fda0/scratchpad/agent-ux/` (fetch.py, run.sh, split.py, clean_govuk.py)
