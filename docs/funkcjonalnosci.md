# Funkcjonalności: specyfikacja backendu

Ustalenia z wątku funkcjonalnego. Najpierw backend: model danych, stany oceny, operacje serwisów, uprawnienia, usługi AI, eksport i statystyki. Ekrany ustalimy później, gdy backend będzie gotowy. Pojęcia są w `GLOSSARY.md`, decyzje architektury w `docs/adr/`. Pojęcia piszemy po polsku, identyfikatory w kodzie po angielsku (ustalenie z wątkiem architektury).

## Użytkownicy i role

- Aplikacja służy oceniającemu. Oceniany nie ma konta ani wglądu w aplikacji. Udostępnianie oceny ocenianemu (np. wysyłka przez oceniającego) jest odłożone.
- Role w członkostwie urzędu (`office_role` w `memberships` i w JWT): `evaluator` (oceniający), `hr` (kadry), `admin`.
  - `evaluator`: zakłada oceny, prowadzi je, pisze notatki, korzysta z AI.
  - `hr`: to samo co oceniający, a dodatkowo wyznacza i zmienia oceniającego w ocenie, widzi harmonogram terminów całego urzędu i statystyki.
  - `admin`: konta, członkostwa, wersje przepisów, ustawienia AI.
- Ocena jest zawsze między pracownikiem a jego bezpośrednim przełożonym (potwierdzone przez mentorów KPRM 21.11.2026). Oceniający to relacja konkretnej oceny z kontem (`evaluator_account_id`), nie rola w urzędzie.
- Struktura bywa płaska albo mieszana, więc drzewo jest opcjonalne: pracownik może mieć bezpośredniego przełożonego (`supervisor_employee_id`, inny pracownik tego urzędu). Gdy przełożony ma konto, jest domyślnym oceniającym. Bez drzewa oceniającym jest konto, które zakłada ocenę, albo konto wskazane przez kadry.

## Dostęp w ramach urzędu

- Widoczność ocen to ustawienie urzędu (`offices.evaluation_visibility`), bo urzędy różnią się tym, czy każdy widzi każdego (mentorzy KPRM):
  - `office` (domyślnie): każde członkostwo w urzędzie czyta wszystkie oceny i ich historię,
  - `tree`: oceniający czyta oceny, które prowadzi, oraz oceny pracowników ze swojego poddrzewa przełożonych. Role `hr` i `admin` czytają wszystkie.
- Drzewo przełożonych (`supervisor_employee_id`) ustawiają i zmieniają tylko role `hr` i `admin`. Inaczej w trybie `tree` oceniający mógłby wpisać siebie jako przełożonego dowolnej osoby i zobaczyć jej oceny. Pozostałe dane pracownika może wpisywać też oceniający.
- Notatki z obserwacji i wyniki modułu HR partnera: czyta autor, rola `hr` i bieżący oceniający tego pracownika (po zmianie oceniającego wszystkie notatki przechodzą na nowego). W trybie `tree` czytają je także przełożeni w górę drzewa.
- Cała logika dostępu przechodzi przez jedno miejsce: funkcję SQL `access.can(action, resource, office_id)`, wołaną przez wszystkie polityki RLS. Zmiana modelu (np. na wgląd tylko dla stron oceny) to zmiana tej jednej funkcji i jej testów pgTAP, bez ruszania polityk tabel.
- Zapis do oceny: jej oceniający i rola `hr`.

## Pracownik (oceniany)

- Oceniający wpisuje dane ocenianego: imię, nazwisko, stanowisko, komórkę (komórka jako tekst, bez struktury organizacyjnej). Bez PESEL.
- Backend szuka podobnych rekordów pracowników (pg_trgm) i proponuje połączenie. Decyzję o połączeniu podejmuje człowiek.
- Stanowisko i komórka zapisują się w ocenie jako migawka z dnia oceny, bo z czasem się zmieniają.
- Import CSV pracowników przez kadry jako dodatek.

## Zdarzenia oceny

- Zdarzenia z udziałem ocenianego (rozmowa, podpis, doręczenie, zapoznanie, sprzeciw) wpisuje oceniający albo kadry, podając faktyczną datę zdarzenia.
- Każde zdarzenie trafia do dziennika: rodzaj, data faktyczna, konto wpisującego, data wpisu.
- Silnik terminów liczy kolejne kroki od dat faktycznych.
- Podpis to zatwierdzenie w systemie (potwierdzone przez mentorów KPRM 21.11.2026). Zatwierdza oceniający: zalogowane konto, znacznik czasu i wpis w dzienniku. Potwierdzenie ocenianego (podpis części I, zapoznanie, odmowa) oceniający odnotowuje z datą, bo oceniany nie ma konta. Wydruk PDF zostaje jako opcja dla urzędu.

- Do zdarzeń oceny wchodzą pola z wzorów arkuszy KPRM, zapisane w payloadzie zdarzenia. `record_acquaintance` przyjmuje opcjonalne `refusalNote` i `witnesses`, a przy odmowie podpisu notatka domyślnie brzmi „oceniany odmówił podpisania zapoznania się z oceną”. `approve_part_one`, `approve_sheet` i `record_acquaintance` przyjmują opcjonalne `place` (miejscowość), domyślnie z `OfficeSettings.defaultPlace`.

## Notatki

- Jedna tabela notatek o pracowniku. Pola: typ (`obserwacja`, `rozmowa_biezaca`, `docenienie`, `fakt_obciazenia`), data zdarzenia, opcjonalne kryterium, znak (plus albo minus), flaga „czy zakomunikowano”.
- Znacznik czasu wpisu jest niezmienialny, edycje są wersjonowane. To chroni przed dopisywaniem wstecz (IV P 74/26).
- Strażnik danych wrażliwych (zdrowie, rodzina, religia, diagnozy) prosi autora o przeformułowanie przed zapisem. Teraz to deterministyczna lista rdzeni słów (`sensitiveDataWarnings`), a serwis zwraca błąd `sensitive_data` z listą ostrzeżeń i zapisuje dopiero po potwierdzeniu. Strażnik oparty o AI dojdzie razem z usługami AI (B7).
- Nazwy w kodzie: typ notatki to `NoteKind` (`observation`, `ongoing_conversation`, `appreciation`, `workload_fact`), wersje edycji to `NoteVersion`. Fakt obciążenia nie ma znaku.
- Czyta autor, kadry i bieżący oceniający otwartej oceny tego pracownika. Po zmianie oceniającego nowy czyta wszystkie notatki, poprzedni traci wgląd do cudzych. Przy widoczności `tree` czytają też przełożeni w drzewie. Edytuje tylko autor, kadry nie edytują cudzych notatek.
- Notatki nie mają ocen liczbowych. Rozmowy bieżące realizują system informacji zwrotnej z zarządzenia nr 6.

## Wersje przepisów

- MUST teraz: pełna zgodność z przepisami z `docs/general-info.md` (ustawa o służbie cywilnej, t.j. Dz. U. 2026 poz. 590, rozporządzenie PRM z 4 kwietnia 2016, zarządzenie nr 6 Szefa SC z 2020).
- Projektu UDER102 nie implementujemy. Obietnica: gdy nowe przepisy wejdą, aktualizacja to dodanie jednego katalogu wersji, bez przebudowy systemu.
- Każda oficjalna wersja przepisów to jeden katalog modułu, np. `backend/regulations/<wersja>/`:
  - `rules.json`: parametry, arkusze, kryteria, skale, progi, terminy i sloty strategii, z podstawą prawną przy każdej regule, walidowany zodem,
  - opcjonalny `strategies.ts`: logika, której nie da się wyrazić danymi, rejestrowana w katalogu strategii,
  - testy przypadków tej wersji (liczenie terminów KPRM, wypełnione przykłady).
- Katalog jest źródłem oficjalnych wersji. Przy starcie albo migracji backend ładuje je do tabeli `regulation_versions` jako niezmienne.
- Edytor admina tworzy lokalne wersje urzędu w bazie jako klon oficjalnej (sekcja „Edytor reguł”).
- Ocena przypina wersję obowiązującą w dniu rozpoczęcia, więc po aktualizacji przepisów stare i nowe oceny działają naraz.

## AI przy treści oceny

- AI przygotowuje pełny szkic arkusza z notatek i danych oceny: wszystkie pola tekstowe oraz propozycje poziomów ocen cząstkowych (1/3/5/7/9) z uzasadnieniem. Oceniający edytuje i zatwierdza każdy element. Wynik końcowy liczy deterministyczny kalkulator, nie AI.
- AI włącza i wyłącza jeden przełącznik w ustawieniach urzędu, domyślnie włączony. Cały proces działa też bez AI.
- Każde zdanie szkicu wskazuje notatkę źródłową. Bez notatek usługa zwraca „za mało danych” i pytania do rozmowy.
- Kontrola jakości tekstu: przykład z datą, brak opisu osobowości i sfery prywatnej, zgodność z kryterium.
- Każde wywołanie AI i każda sugestia trafiają do dziennika użycia AI (fragment, czy zmieniony, kto zatwierdził). Fragmenty z AI są oznaczone.

## Moduł HR partnera

- Wejście: strukturalne fakty obciążenia od oceniającego (notatki typu `fakt_obciazenia`), tekst notatek oceniającego i oceny cząstkowe z poprzednich cykli. Importu z systemu kadrowego nie robimy.
- Bielik-One daje sygnały (sentyment, przeciążenie, spadek zaangażowania, ryzyko wypalenia) z prawdopodobieństwem i fragmentami źródłowymi. Nie konfigurujemy progów pewności: o tym, co jest sygnałem, decyduje Bielik-One, a wynik pokazujemy jako sugestię.
- Wynik to sugestia: sygnały, pytania do rozmowy, działania według JD-R i HSE. Nigdy diagnoza. Decyduje oceniający (ustalenie z KPRM w `AGENTS.md`).
- Wynik czyta autor analizy i kadry. Nie trafia do arkusza.
- Rozbieżność odbiorców wyniku (autor analizy czy kadry) zostaje do rozstrzygnięcia w B7.

## Statystyki i raporty (rola kadry)

Liczone w widokach SQL albo funkcjach RPC (ADR 0004):

- Harmonogram i terminowość: kto do oceny i kiedy, oceny w toku, po terminie, bez zarejestrowanej rozmowy oceniającej, nadchodzące terminy rozmowy rozpoczynającej.
- Sprawozdanie DSC-OCK: liczby na 5 poziomach (osobno urzędnicy SC), oceny negatywne, drugie kolejne negatywne, sprzeciwy według wyniku, stopnie z art. 89 ust. 1 i 2. Eksport CSV.
- Rozkład ocen urzędu na tle danych krajowych, per komórka (tekst z migawki), odsetek ocen z wnioskami do IPRZ, potrzeby rozwojowe według kryteriów.
- Rozkład per oceniający (tendencja centralna, łagodność), tylko dla kadr. To profilowanie oceniających, liczone deterministycznie.

## IPRZ i rozwój

- Wnioski do IPRZ są wymaganym polem oceny (art. 81 ust. 5). Backend podpowiada je z kryteriów z najniższymi poziomami.
- Rekomendacje z katalogu szkoleń (249 pozycji przypisanych do 14 kryteriów, `docs/sources/szkolenia-katalog/`), najpierw bezpłatne. Działania rozwojowe także poza szkoleniami (mentoring, zadanie rozwojowe, zastępstwo).
- Bez obiegu akceptacji IPRZ (kierownik komórki, DG). Nie mamy tych ról.

## Edytor reguł

- Admin klonuje opublikowaną wersję przepisów do szkicu.
- W szkicu zmienia parametry (stałe, progi, skale, kryteria, arkusze) i wybiera strategie z zarejestrowanego katalogu w `backend/domain`.
- Przed publikacją backend uruchamia walidację zod i testy przypadków (liczenie terminów KPRM, 13 wypełnionych przykładów) i zwraca wynik.
- Opublikowana wersja jest niezmienna, ma datę obowiązywania i podstawę prawną przy każdej regule.

## Eksport

- PDF/UA arkusza według wzoru z zał. 2 do 4 rozporządzenia (Typst), gotowy do podpisu poza aplikacją.
- DOCX arkusza do dalszej obróbki w urzędzie.
- Teczka sprawy: ZIP z PDF arkusza, dziennikiem zdarzeń, wersjami i zawiadomieniami, na sprzeciw i do sądu.
- Paczka do EZD: PDF/A plus XML metadanych według instrukcji kancelaryjnej.

## Retencja

- Okres przechowywania notatek i analiz HR partnera ustawia admin w ustawieniach urzędu (`OfficeSettings.notesRetentionMonths`, 1 do 120). Domyślnie 36 miesięcy: to decyzja do potwierdzenia, bo `docs/wymagania-i-kontekst.md` zostawia okres notatek roboczych do ustalenia. Usuwanie wykonuje zadanie pg_cron (B9).
- Arkusz i dziennik zdarzeń zostają zgodnie z przepisami o dokumentacji pracowniczej (10 lat, art. 94 pkt 9b KP).

## Sprzeciw

- Całą ścieżkę rejestrują kadry (nie mamy roli DG ani konta ocenianego).
- Kadry wpisują wniesienie sprzeciwu z datą. Backend sprawdza termin 7 dni od zapoznania (art. 83 ust. 1).
- Kadry wpisują stanowisko oceniającego i wynik rozstrzygnięcia DG. Harmonogram pokazuje licznik 14 dni dla DG.
- Wyniki:
  - nieuwzględniony: ocena zostaje, zdarzenie w dzienniku,
  - zmiana oceny: kadry wpisują nową wersję arkusza w imieniu DG, backend nie pozwala obniżyć oceny,
  - ponowne sporządzenie: obecna wersja zostaje anulowana, ocena wraca do etapu rozmowy oceniającej z nowym terminem.
- Nazwy kodowe wyników: `rejected` (nieuwzględniony), `changed` (zmiana oceny), `redraft` (ponowne sporządzenie). Błędy: `objection_late` (sprzeciw po 7 dniach od zapoznania) i `objection_lowers_outcome` (zmiana obniżająca poziom oceny).
- Zmiana oceny po sprzeciwie zamyka ocenę. Ponowne sporządzenie daje nową wersję arkusza ze skopiowaną treścią i nowe prawo do sprzeciwu po kolejnym zapoznaniu.
- Wcześniejsze wersje arkusza zostają do odczytu i trafiają do teczki sprawy.
- Adresat sprzeciwu jest parametrem arkusza w `rules.json`. Arkusze B i C: dyrektor generalny urzędu (art. 83 ust. 1). Arkusz A: organ nadrzędny wobec ocenianego, nie wyżej (mentorzy KPRM 21.11.2026). Arkuszem A ocenia się kilka stanowisk, głównie lekarzy weterynarii kierujących inspektoratem (około 5 w służbie cywilnej). Art. 81 ust. 2 i art. 83 ust. 2 są uchylone, reguły opieramy na Dz.U. 2026 poz. 590.

## Korekta zablokowanych pól

- Pola blokują się etapami (część I po rozmowie rozpoczynającej, część II po sporządzeniu).
- Zmienić zablokowane pole może tylko rola `admin`, z obowiązkowym powodem.
- Każda korekta tworzy nową wersję arkusza i wpis w dzienniku. Stara wersja zostaje do odczytu.

## Oceny historyczne

- Historia ocen zaczyna się od wdrożenia systemu. Nie importujemy skanów ani archiwów.
- Opcjonalnie człowiek (kadry albo oceniający) może ręcznie wpisać ocenę archiwalną: data sporządzenia, wynik, poziom, opcjonalnie oceny cząstkowe. Taka ocena jest oznaczona jako archiwalna i nie ma przebiegu.

## Powiadomienia i e-maile

- Jeden serwer SMTP urzędu (Exchange albo wewnętrzny relay). Podaje go kreator przy instalacji, admin może go zmienić w ustawieniach urzędu. Hasło szyfrowane w bazie (Supabase Vault).
- Ten sam SMTP obsługuje Supabase Auth (reset hasła, zaproszenia kont).
- Nadawca to adres urzędu, np. `oceny@urzad.gov.pl`. Adresaci to tylko konta aplikacji. Oceniany nie dostaje maili.
- Treść bez danych osobowych i bez treści oceny, np. „Masz 2 zadania, najbliższy termin 24.11” i link.
- pg_cron raz dziennie zbiera terminy i wrzuca zadania do pgmq. Worker wysyła jeden zbiorczy mail na konto, z ponowieniami i dziennikiem wysyłek.
- Skrzynka powiadomień w aplikacji działa zawsze, także bez SMTP. W demo maile widać w Mailpit z lokalnego Supabase.
- Przypomnienia domyślnie 14 i 3 dni przed terminem (admin zmienia w `OfficeSettings.reminderLeadDays`: 1 do 5 wartości z zakresu 1 do 90). Po terminie eskalacja do kadr.
- Admin ustawia też domyślną miejscowość (`defaultPlace`) i adresata sprzeciwu na arkuszu A (`objectionAddresseeSheetA`). Gdy adresat jest pusty, obowiązuje tekst z `rules.json`. `EvaluationView.objectionAddressee` podaje adresata obowiązującego dla arkusza: dla A nadpisanie urzędu albo tekst z reguł, dla B i C tekst z reguł.
- Ustawienia SMTP są w `office_settings`. Hasło zapisuje wyłącznie funkcja `set_smtp_password` (admin, Supabase Vault), klient widzi tylko `passwordSet`. Odczyt hasła przez workera wysyłki należy do B4.
- Kadry dostają zadania: stopień z mocy prawa (30 dni), 14 dni DG na sprzeciw, oceny po terminie.

## Cykle i terminy

- Kolejną ocenę zakłada oceniający. Backend nie tworzy jej sam, tylko przypomina o terminie rozmowy rozpoczynającej (30 dni od oceny, 7 dni po negatywnej).
- Stopień z mocy prawa (art. 89 ust. 2): dowolne połączenie dwóch najwyższych poziomów się liczy. To parametr w `rules.json`, można go przestawić na „ten sam poziom”. Backend tworzy kadrom zadanie z terminem 30 dni.
- Długotrwała nieobecność (art. 81 ust. 7) wpisuje oceniający albo kadry: od, do (opcjonalne), „usprawiedliwiona”, bez przyczyny.
  - Backend skleja okresy rozdzielone tylko dniami wolnymi.
  - Bez daty końca termin ma status „wstrzymany do powrotu”.
  - Po wpisaniu powrotu termin przesuwa się o dni kalendarzowe nieobecności, a potem na dzień roboczy.
- Kryterium obowiązkowe danego arkusza nie może być wybrane jako dodatkowe (blokada).
- Zmiana terminu oceny jest dozwolona dopiero po wymaganym okresie od początku cyklu. Zbyt wczesna zmiana kończy się błędem `term_change_too_early`, nieznana przyczyna błędem `term_change_reason_unknown` (oba pod kodem `term_change_invalid`).
- Bieżące stanowisko ocenianego pochodzi z ostatniego zdarzenia zmiany stanowiska. Migawka w ocenie zostaje niezmienna.
- Sygnały oceny: `gradeByLaw` (stopień z mocy prawa, liczony od zapoznania z ostatnią oceną, wlicza oceny archiwalne) i `secondConsecutiveNegative` (druga negatywna z rzędu).

## Stany oceny

Każde przejście to zdarzenie w dzienniku z datą faktyczną. Przejścia sprawdzają bramki.

| Stan | Znaczenie | Przejście dalej |
|---|---|---|
| `kryteria` (`criteria`) | część I w edycji, biegnie termin 30 dni (7 po negatywnej) | oceniający zatwierdza część I po rozmowie rozpoczynającej |
| `czesc_i_do_podpisu` (`criteria_awaiting_signature`) | część I zatwierdzona, czeka na odnotowanie podpisu ocenianego | odnotowanie podpisu ocenianego z datą |
| `okres` (`period`) | kryteria i termin zablokowane, okres oceny | odnotowanie rozmowy oceniającej |
| `rozmowa` (`interview`) | rozmowa oceniająca odnotowana, część II w edycji | zatwierdzenie oceny (kalkulator, bramki: wnioski IPRZ zawsze, uzasadnienie przy negatywnej) |
| `sporzadzona` (`drafted`) | część II zablokowana, czeka na zapoznanie ocenianego | odnotowanie zapoznania albo odmowy podpisu z datą |
| `doreczona` (`delivered`) | biegnie 7 dni na sprzeciw | 7 dni bez sprzeciwu albo wniesienie sprzeciwu |
| `zamknieta` (`closed`) | ocena ostateczna | brak |
| `sprzeciw` (`objection`) | sprzeciw wniesiony, licznik 14 dni DG | `zamknieta`, nowa wersja arkusza albo `anulowana` |
| `anulowana` | wersja arkusza anulowana po sprzeciwie. To nie jest stan oceny, tylko stan wersji arkusza (`cancelled`) | ocena wraca do `rozmowa` (`interview`) z nowym terminem |
| `przerwana` (`interrupted`) | np. ustanie stosunku pracy | brak |

- W stanie `okres` działają zdarzenia boczne: nieobecność (termin wstrzymany albo przesunięty), zmiana terminu, zmiana oceniającego, zmiana stanowiska.
- Zmiana stanowiska: oceniający albo kadry wpisują datę i obowiązkową decyzję „istotna zmiana obowiązków: tak/nie” z uzasadnieniem. Przy „tak” backend ustawia termin oceny w oknie ustawowym (art. 81 ust. 6, § 9) i przypomina. Przy „nie” ocena biegnie dalej, a nowe stanowisko trafia do migawki.
- Zmiana oceniającego: kadry przepinają ocenę, kryteria zostają (§ 9 ust. 3), wszystkie notatki o pracowniku są dostępne dla nowego oceniającego.

## Scenariusz demo

Ustalimy przy frontendzie.

## Usługi AI (pełna lista)

Wszystkie działają tylko przy włączonym przełączniku AI urzędu, a każde wywołanie trafia do dziennika użycia AI.

- Szkic arkusza z propozycjami poziomów (sekcja „AI przy treści oceny”).
- Kontrola jakości tekstu i strażnik danych wrażliwych.
- Przygotowanie rozmów: rozpoczynającej, oceniającej i bieżącej. Cel, plan, pytania per kryterium, podpowiedzi na trudne sytuacje (reakcje obronne, ocena negatywna), na podstawie notatek i sygnałów.
- Propozycje kryteriów dodatkowych (z opisu obowiązków i poprzedniego cyklu) oraz wskaźników behawioralnych oczekiwań do rozmowy rozpoczynającej.
- Sygnały HR partnera (Bielik-One).
- Momenty docenienia: wskazanie, kiedy warto docenić (pozytywne notatki, długo bez uznania), z szablonem informacji zwrotnej SBI.
- Asystent procedury (RAG): odpowiedzi na pytania o przepisy z cytatem z ustawy, rozporządzenia, zarządzenia nr 6 i FAQ DSC.
  - Wyszukiwanie: semble (indeks na CPU, bez osobnej bazy wektorowej) po katalogu tekstów prawnych w Markdown, dzielonych po nagłówkach artykułów i paragrafów. Model tekstowy dostaje top 5 fragmentów i odpowiada z cytatem (artykuł, ustęp).
  - Test 21.11.2026 na `docs/legal/`: pytanie o termin sprzeciwu daje art. 83 na pierwszym miejscu. Pytanie „czy urlop przedłuża termin” daje art. 81 ust. 7 dopiero na piątym miejscu (wyżej art. 105 o urlopie), więc bierzemy top 5 i zostawiamy wybór modelowi.
  - Teksty prawne do indeksu leżą w katalogu wersji przepisów, więc aktualizują się razem z regułami.

## Konta i logowanie

- Supabase Auth, e-mail i hasło. Admin zaprasza konto e-mailem i nadaje rolę. Bez SMTP admin ustawia hasło tymczasowe.
- Pierwsze konto admina tworzy kreator instalacji.
- AD/LDAP i SSO to dalszy krok, poza MVP.

## Pracownik: pola

- Imię, nazwisko, stanowisko i komórka (tekst, migawka w ocenie).
- Rodzaj stanowiska dla arkusza: kierownik urzędu (A), kieruje ludźmi (B), pozostałe (C). Backend proponuje arkusz, oceniający potwierdza.
- Status: urzędnik SC albo pracownik SC.
- Typ stosunku: czas nieokreślony, mianowanie, czas określony. Przy czasie określonym backend nie otwiera oceny i podaje powód.
- Data nawiązania stosunku.
- Dla urzędnika: rok mianowania, stopień I do IX, data jego przyznania.

## Usuwanie danych pracownika

- Kadry oznaczają ustanie zatrudnienia. Otwarta ocena przechodzi w `przerwana`.
- Notatki i analizy AI znikają według retencji ustawionej przez admina.
- Arkusze zostają 10 lat (art. 94 pkt 9b KP). Potem zadanie pg_cron anonimizuje rekord pracownika i usuwa arkusze, a dane do statystyk zostają bez danych osobowych.
- Przed usunięciem teczkę sprawy można wyeksportować.

## Z przepisów (bez osobnej decyzji)

Te funkcje wynikają wprost z prawa i materiałów KPRM, więc wchodzą bez dyskusji:

- Kalkulator wyniku: średnia z faktycznie ocenionych kryteriów (nie zawsze przez 5, błąd w xlsx KPRM), progi 2/4/6/8, ocena negatywna przy średniej do 4 albo przy jakiejkolwiek ocenie 1 (§ 11).
- Silnik terminów: Kodeks cywilny (koniec miesiąca, przesunięcie z soboty i dnia wolnego na następny dzień roboczy), kalendarz świąt z Wigilią od 2025, testy z `liczenie terminów.docx`. Termin sporządzenia jest wyliczany, a oceniający może go tylko skrócić.
- Ścieżka negatywna: rozmowa rozpoczynająca w 7 dni, ponowna ocena po 6 miesiącach, nieobecność nie przedłuża tych 6 miesięcy (art. 81 ust. 9).
- Zmiana terminu przez oceniającego tylko z jednej z 4 przyczyn i po 6 miesiącach (art. 81 ust. 8, § 8). Backend generuje pisemne zawiadomienie (PDF) z kopią do arkusza.
- Część III (wniosek o stopień) tylko dla urzędnika przy ocenie pozytywnej, z umotywowaniem. Przy IX stopniu wniosek zablokowany. Ostrzeżenie, gdy stopień i tak przysługuje z mocy prawa.
- Sygnał dla kadr o drugiej kolejnej ocenie negatywnej (art. 71).
- Ostrzeżenie o konflikcie ról, gdy oceniającym jest DG, który rozpatruje sprzeciw.
- Odmowa podpisu przy zapoznaniu jest zdarzeniem z datą i adnotacją na arkuszu („oceniany odmówił podpisania”), uruchamia te same terminy co zapoznanie.
