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
- Dziennik to tabela `ai_runs` (przebieg AI): rodzaj usługi, kto i kiedy prosił, migawka wejścia, wynik, wersja promptu, porażka. Decyzje o fragmentach (`accepted`, `edited`, `rejected`, tekst po edycji) leżą w `ai_fragment_decisions`, ostatnia decyzja o fragmencie wygrywa. Fragmenty mają ścieżki, np. `rating.communication`, `justification.0`, `question.1`.
- Szkic: propozycja poziomu kryterium bez żadnego zdania z notatką źródłową nie powstaje (`points: null`). Zdanie, które wskazuje notatkę spoza migawki wejścia, odpada.

## Moduł HR partnera

- Wejście: strukturalne fakty obciążenia od oceniającego (notatki typu `fakt_obciazenia`), tekst notatek oceniającego i oceny cząstkowe z poprzednich cykli. Importu z systemu kadrowego nie robimy.
- Bielik-One daje sygnały (sentyment, przeciążenie, spadek zaangażowania, ryzyko wypalenia) z prawdopodobieństwem i fragmentami źródłowymi. Nie konfigurujemy progów pewności: o tym, co jest sygnałem, decyduje Bielik-One, a wynik pokazujemy jako sugestię.
- Wynik to sugestia: sygnały, pytania do rozmowy, działania według JD-R i HSE. Nigdy diagnoza. Decyduje oceniający (ustalenie z KPRM w `AGENTS.md`).
- Wynik nie trafia do arkusza. Odbiorcy wyniku są ci sami co przy notatkach (rozstrzygnięte w B7): autor przebiegu, kadry, bieżący oceniający otwartej oceny pracownika, a w trybie `tree` przełożeni w górę drzewa. Jedna funkcja SQL `access.reads_employee_private_data` opisuje tych odbiorców dla notatek i wyników AI.
- Obecność sygnału to argmaks Bielik-One (dla sentymentu odpowiedź „negatywny”), prawdopodobieństwo to prawdopodobieństwo obecności. Bez Bielik-One sygnały daje model tekstowy przez schemat `decision_answers` (ADR 0005). Cytat musi być dosłownym fragmentem wskazanej notatki. Pytanie albo działanie, które strażnik danych wrażliwych uznaje za diagnozę, odpada.

## Statystyki i raporty (rola kadry)

Liczone w widokach SQL albo funkcjach RPC (ADR 0004). Raporty urzędu czytają kadry i admin, rozkład per oceniający tylko kadry. Inne role dostają `forbidden`.

- Rok raportu to rok sporządzenia oceny, czyli data ostatniego zdarzenia `sheet_approved`. Sprzeciwy liczymy od ocen sporządzonych w tym roku (pytanie 13 formularza).
- Poziom i wynik oceny liczy kalkulator w `@sarmata/domain`, więc SQL nie ma po czym grupować. Serwis statystyk przelicza projekcję wyników (`evaluation_results`) przy odczycie raportu i zapisuje ją przez RPC. Po korekcie arkusza stary wiersz projekcji się nie liczy, bo RPC łączą po numerze wersji arkusza.
- Harmonogram i terminowość: kto do oceny i kiedy, oceny w toku, po terminie (bez zawieszonych), bez zarejestrowanej rozmowy oceniającej, nadchodzące terminy rozmowy rozpoczynającej. Domyślny horyzont to 30 dni.
- Sprawozdanie DSC-OCK, pytania 4 do 17 działu 1: liczby na 5 poziomach (osobno urzędnicy SC), oceny negatywne, drugie kolejne negatywne, sprzeciwy według wyniku, odwołania do sądu, wnioski i stopnie z art. 89. Pytania 1 do 3 (pierwsza ocena) poza zakresem. Eksport CSV dla Excela: UTF-8 z BOM i średnik jako separator.
- Rozkład ocen urzędu na tle danych krajowych (sprawozdanie Szefa SC za 2025 r.), per komórka (tekst z migawki, małych komórek nie ukrywamy, bo kadry czytają każdą ocenę), odsetek ocen z wnioskami do IPRZ, potrzeby rozwojowe według kryteriów.
- Rozkład per oceniający (tendencja centralna, łagodność, surowość), tylko dla kadr. To profilowanie oceniających, liczone deterministycznie. Progi flag to ustawienia urzędu zmieniane przez admina: co najmniej 5 ocen, udział poziomu środkowego od 80% i różnica średnich od 1 punktu (kolumny `evaluator_flag_*`).
- Pytania 14 i 16 mają dane z wpisów kadr, bo ocena ich nie niesie. Odwołanie do sądu pracy to zdarzenie `labour_court_appeal`, które kadry zapisują tylko po nieuwzględnionym sprzeciwie (jedno na ocenę, data nie wcześniejsza niż data wyniku sprzeciwu). Przyznanie stopnia to wpis w `grade_grants` z podstawą `on_request` (art. 89 ust. 1) albo `by_law` (ust. 2), tylko dla urzędnika i tylko na wyższy stopień. Przyznanie z mocy prawa zmienia stopień pracownika i zamyka zadanie kadr, bo usuwa termin `gradeByLawGrant` oceny i blokuje jego odtworzenie.

## IPRZ i rozwój

- Wnioski do IPRZ są wymaganym polem oceny (art. 81 ust. 5). Backend podpowiada je z kryteriów z najniższymi poziomami.
- Rekomendacje z katalogu szkoleń (249 pozycji przypisanych do 14 kryteriów, `docs/sources/szkolenia-katalog/`), najpierw bezpłatne. Działania rozwojowe także poza szkoleniami (mentoring, zadanie rozwojowe, zastępstwo).
- Serwis `development.recommend(evaluationId, { on? })` bierze do trzech kryteriów z punktami poniżej najwyższego poziomu skali, od najniższych. Dla każdego zwraca do pięciu szkoleń, działania 70-20-10 i szkic wniosków do edycji przez oceniającego. To tylko sugestia, decyzję podejmuje człowiek.
- Kolejność szkoleń: bezpłatne, potem priorytet Szefa SC w roku daty `on`, potem kanał (e-learning SC, webinary PDW i trenerzy SC, szkolenia centralne i platformy rządowe, KSAP, MOOC), potem zgodność z kryterium głównym pozycji.
- Filtr roli: pozycje zakończone są pomijane. Kierownik (arkusz A albo B) widzi pozycje dla wszystkich i dla kadry kierowniczej, pracownik na arkuszu C tylko dla wszystkich. Koordynator jest pracownikiem, nie kierownikiem. Urząd nie dodaje własnych szkoleń.
- Działania 70-20-10: zadanie rozwojowe i zastępstwo to 70 procent, mentoring i informacja zwrotna to 20 procent, szkolenia to pozostałe 10 procent.
- Bez obiegu akceptacji IPRZ (kierownik komórki, DG). Nie mamy tych ról.

## Edytor reguł

- Admin klonuje opublikowaną wersję przepisów do szkicu.
- W szkicu zmienia parametry (stałe, progi, skale, kryteria, arkusze) i wybiera strategie z zarejestrowanego katalogu w `backend/domain`.
- Przed publikacją backend uruchamia walidację zod i testy przypadków (liczenie terminów KPRM, 13 wypełnionych przykładów KPRM jako przypadki oceny) i zwraca wynik.
- Opublikowana wersja jest niezmienna, ma datę obowiązywania i podstawę prawną przy każdej regule.
- Serwis `regulationEditor` ma sześć metod: `list`, `get` (dokument, graf slotów i parametrów oraz wynik walidacji i przypadków liczone przy odczycie), `clone`, `saveDraft`, `publish` i `deleteDraft`. Front nie składa walidacji ani grafu sam.
- Zapis szkicu niezgodnego ze schematem zwraca `saved: false` i problemy ze ścieżkami (na przykład `overallLevel.bands.1.min`), a w bazie nic się nie zmienia.
- Publikacja szkicu z nieudanymi przypadkami wymaga `acceptFailingCases: true`. Bez flagi serwis zwraca błąd `regulation_cases_failed` z wynikami wszystkich przypadków. Z flagą wersja się publikuje, a wyniki zaakceptowanych przypadków zapisują się razem z wersją (`acceptedFailingCases`).
- Kody błędów edytora: `regulation_invalid` (dokument niezgodny ze schematem, data w przeszłości albo zajęta przez inną opublikowaną wersję urzędu, szczegóły w `details.issues`), `regulation_cases_failed`, `regulation_not_draft` (zmiana albo usunięcie opublikowanej wersji), `forbidden` (rolę rozstrzyga RLS, zapisuje tylko admin), `not_found`.
- Pierwszeństwo wersji urzędu: kandydaci to wersje oficjalne i opublikowane wersje urzędu. Obowiązuje ta z najpóźniejszą datą obowiązywania nie późniejszą niż dzień rozpoczęcia oceny. Przy równej dacie wygrywa wersja urzędu. Nowsza wersja oficjalna wypiera wersję urzędu od swojej daty, więc po zmianie prawa admin klonuje nową wersję. Ocena przypina wersję przy starcie, publikacja nie zmienia ocen w toku. Data obowiązywania nie może być w przeszłości.

## Eksport

Plik powstaje na żądanie w procesie aplikacji z danych w bazie (bez Storage i bez kopii danych osobowych). Pobieranie: `GET /api/oceny/<id>/eksport/<rodzaj>`, dostęp wynika z RLS (kto widzi ocenę, ten ją pobierze). Pakiet `backend/exports`, interfejs `exportsFor(db).export(evaluationId, request)`.

| Rodzaj w adresie | Kod w pakiecie | Zawartość |
|---|---|---|
| `arkusz-pdf` | `sheet_pdf` | arkusz A, B albo C według wzoru z zał. 2 do 4, PDF/UA-1 (Typst) |
| `arkusz-docx` | `sheet_docx` | ten sam układ w DOCX do dalszej obróbki w urzędzie |
| `zawiadomienie` | `term_notice` | pismo o zmianie terminu (art. 81 ust. 8 ustawy, § 8 rozporządzenia), parametr `zdarzenie` |
| `teczka` | `case_file` | ZIP, patrz niżej |
| `paczka-ezd` | `ezd_package` | ZIP z PDF/A-2a i metadanymi XML, parametr `znak` |

- **Zatwierdzenia zamiast podpisu.** Dokument nie ma podpisu odręcznego. W miejscu podpisów pokazuje zatwierdzenia z dziennika zdarzeń: czynność, datę zdarzenia, czas wpisu (strefa Europe/Warsaw), konto, wersję arkusza i skrót SHA-256 jej treści (ADR 0007). Odmowa podpisu pokazuje notatkę i świadków. Miejscowość i data przy częściach I i II pochodzą z zatwierdzeń.
- **Ramka na podpis.** Opcja `podpis=1` (`signatureBox`) dodaje puste pola na podpis odręczny dla urzędów, które drukują dokument.
- **Projekt.** Arkusz w stanie `draft` dostaje napis „PROJEKT” w nagłówku strony. Paczka EZD z projektu jest odrzucana (`not_exportable`, HTTP 409).
- **Część III** (wniosek o stopień służbowy) jest tylko dla urzędnika służby cywilnej z wnioskiem w treści, w pozostałych przypadkach pole wniosku pokazuje „NIE DOTYCZY” albo „NIE” (przypis 18 wzoru).
- **Teczka sprawy** (ZIP): `arkusz.pdf` (bieżąca wersja), `wersje/arkusz-v<n>.pdf` (każda wersja ze stanem i powodem, wersje zastąpione z własnymi zatwierdzeniami), `dziennik-zdarzen.pdf` i `.csv` (RFC 4180, UTF-8), `zawiadomienia/zmiana-terminu-<data>.pdf` oraz `manifest.json` ze skrótami SHA-256 plików. Na sprzeciw i do sądu.
- **Paczka EZD** (ZIP, tylko dla zatwierdzonej wersji): `arkusz.pdf` i zawiadomienia w PDF/A-2a oraz `metadane.xml` (identyfikator, twórca, tytuł, data, format, dostęp, typ, znak sprawy, relacja zawiadomienia do arkusza, język, opis, skrót pliku i skrót arkusza). Znak sprawy wpisuje użytkownik ręcznie. Zestaw elementów trzeba sprawdzić z załącznikiem nr 1 do instrukcji kancelaryjnej, bo jego tabele są obrazami.
- Kroje dokumentów: do czasu decyzji użytkownika obowiązuje wartość tymczasowa w `backend/exports/src/pdf/font.ts` (jedno miejsce konfiguracji dla PDF i DOCX).

## Retencja

- Okres przechowywania notatek i analiz HR partnera ustawia admin w ustawieniach urzędu (`OfficeSettings.notesRetentionMonths`, 1 do 120). Domyślnie 36 miesięcy: to decyzja do potwierdzenia, bo `docs/wymagania-i-kontekst.md` zostawia okres notatek roboczych do ustalenia. Usuwanie wykonuje dzienne zadanie `retention.run` (pg_cron o 5:30 UTC przez kolejkę, krok 1 to `purge_expired_content`).
- Retencja treści: notatka starsza niż okres znika razem z wersjami. Przebieg AI (status `done` albo `failed`) starszy niż okres traci `input`, `output` i `failure_message`, a decyzje o fragmentach tekst po edycji (`content_deleted_at`). Metadane przebiegu zostają: kto, kiedy, jaka usługa, status, wersja promptu. Przebiegi `queued` i `running` zostają.
- Skrócenie okresu przez admina działa wstecz: następny nocny bieg usuwa notatki starsze niż nowy okres. `OfficeSettingsService.notesRetentionPreview(months)` podaje, ile notatek i przebiegów AI by to usunęło, żeby ekran ustawień ostrzegł przed zapisem.
- Arkusz i dziennik zdarzeń zostają zgodnie z przepisami o dokumentacji pracowniczej (10 lat, art. 94 pkt 9b KP). Okres liczy się od końca roku kalendarzowego, w którym stosunek pracy ustał (`retentionEndsOn` w `@sarmata/domain`: 31 grudnia roku ustania plus 10 lat).

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
- Ustawienia SMTP są w `office_settings`. Hasło zapisuje wyłącznie funkcja `set_smtp_password` (admin, Supabase Vault), klient widzi tylko `passwordSet`. Hasło czyta tylko worker wysyłki przez `office_smtp_settings` (klient serwisowy).
- Kadry dostają zadania: stopień z mocy prawa (30 dni), 14 dni DG na sprzeciw, oceny po terminie.
- Implementacja (B4): `public.collect_notifications(p_today)` uruchamia pg_cron codziennie o 5:00 UTC (`notifications-daily`), a ręcznie `pnpm notifications:collect`. Zbieracz nie liczy terminów od nowa, tylko czyta zapisane sloty `evaluation_deadlines`. Serwis ocen zapisuje też slot `gradeByLawGrant` z sygnału stopnia z mocy prawa.
- Rodzaje powiadomień (`notification_kind`): `deadline_reminder` (przypomnienie oceniającego), `deadline_overdue` (termin po upływie, do oceniającego i kadr), `objection_decision` (14 dni DG na sprzeciw, kadry), `grade_by_law` (stopień z mocy prawa, kadry). Przypomnienie, wstrzymany slot i zamknięta albo przerwana ocena nie dają zadania.
- Wyprzedzenie przypomnienia to najmniejsza wartość z `reminderLeadDays`, która nadal pokrywa liczbę dni do terminu. Gdy cron pominie dzień, powstaje jedno przypomnienie z najbliższym wyprzedzeniem, nie wszystkie zaległe.
- Zadania mają status `open` albo `resolved`. Zbieracz zamyka zadanie, gdy jego termin zniknął, zmienił datę albo ocena się zamknęła, i ustawia mu `read_at`, więc zadanie wypada z licznika nieprzeczytanych. Nowa data terminu tworzy nowe zadanie.
- Zbiorczy mail wysyła worker (zadanie `notifications.send_digest`), jeden na konto i dzień, z ponowieniami (kolejka pgmq) i dziennikiem w `notification_digests` (`queued`, `sent`, `failed`, `skipped`). SMTP urzędu z ustawień ma pierwszeństwo przed SMTP instalatora (`SMTP_*`). Bez żadnego SMTP wpis dostaje status `skipped`, a skrzynka w aplikacji działa dalej. Ponowne dostarczenie zadania po wysłaniu nie wysyła drugiego maila.
- Skrzynka powiadomień ma trasę `/powiadomienia` (stała `NOTIFICATIONS_PATH`), do której prowadzi link w mailu. SMTP dla Supabase Auth zostaje w konfiguracji instalatora i nie należy do B4.
- Automatyczne zamknięcie oceny: codziennie o 5:10 UTC pg_cron kolejkuje zadanie `evaluations.close_unobjected`, a worker wywołuje `close_unobjected_evaluations`. Ocena `delivered`, której termin sprzeciwu (slot `objection`, niewstrzymany) minął, przechodzi do `closed` ze zdarzeniem `closed` i `payload.automatic = true`. Autorem jest konto systemowe `00000000-0000-0000-0000-000000000000`. Zamknięcie trafia do dziennika zdarzeń i do logu workera (liczba zamkniętych ocen).

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

Wszystkie działają tylko przy włączonym przełączniku AI urzędu, a każde wywołanie trafia do dziennika użycia AI. Prosi oceniający albo kadry (admin nie).

Wszystkie wywołania idą przez kolejkę (ADR 0008): serwis `ai` zbiera migawkę wejścia w kontekście użytkownika (RLS), zapisuje przebieg `queued`, trigger wysyła zadanie `ai.run`, worker woła model i zapisuje wynik, a front odpytuje `ai.get(id)`. Notatki w migawce mieszczą się w 6000 znaków, najnowsze zostają, pominięte są wymienione w `inputRefs.droppedNoteIds`. Przebieg czekający w kolejce, gdy admin wyłączył AI, kończy się porażką `disabled`.

Nazwy kodowe usług (`AiRunKind`): `sheet_draft`, `quality_check`, `sensitive_data`, `conversation_prep`, `criteria_proposals`, `appreciation_moments`, `hr_signals`, `procedure_question`.

Retencja: treść przebiegów AI (wejście, wynik, komunikat porażki, tekst po edycji fragmentu) usuwa zadanie retencji razem z notatkami (`notesRetentionMonths`, B9) i ustawia `content_deleted_at`. Metadane zostają: kto, kiedy, jaka usługa, status, wersja promptu i identyfikatory wejścia.

- Szkic arkusza z propozycjami poziomów (sekcja „AI przy treści oceny”).
- Kontrola jakości tekstu i strażnik danych wrażliwych.
- Przygotowanie rozmów: rozpoczynającej, oceniającej i bieżącej. Cel, plan, pytania per kryterium, podpowiedzi na trudne sytuacje (reakcje obronne, ocena negatywna), na podstawie notatek i sygnałów.
- Propozycje kryteriów dodatkowych (z opisu obowiązków i poprzedniego cyklu) oraz wskaźników behawioralnych oczekiwań do rozmowy rozpoczynającej.
- Sygnały HR partnera (Bielik-One).
- Momenty docenienia: wskazanie, kiedy warto docenić (pozytywne notatki, długo bez uznania), z szablonem informacji zwrotnej SBI.
  - „Długo bez uznania” liczy się od ostatniej notatki typu docenienie. Próg ustawia admin w ustawieniach urzędu (`OfficeSettings.appreciationGapDays`, 1 do 365, domyślnie 30 dni). Brak docenienia w notatkach to sygnał od razu.
- Asystent procedury (RAG): odpowiedzi na pytania o przepisy z cytatem z ustawy, rozporządzenia, zarządzenia nr 6 i FAQ DSC.
  - Wyszukiwanie: semble (indeks na CPU, bez osobnej bazy wektorowej) po katalogu tekstów prawnych w Markdown, dzielonych po nagłówkach artykułów i paragrafów. Model tekstowy dostaje top 5 fragmentów i odpowiada z cytatem (artykuł, ustęp).
  - Test 21.11.2026 na `docs/legal/`: pytanie o termin sprzeciwu daje art. 83 na pierwszym miejscu. Pytanie „czy urlop przedłuża termin” daje art. 81 ust. 7 dopiero na piątym miejscu (wyżej art. 105 o urlopie), więc bierzemy top 5 i zostawiamy wybór modelowi.
  - Teksty prawne do indeksu leżą w katalogu wersji przepisów, więc aktualizują się razem z regułami: korpus to pliki z `sources` wersji, czytane z `backend/regulations/<wersja>/sources/`. `docs/legal/` zostaje materiałem badawczym i kod go nie czyta. Pytanie bez oceny korzysta z wersji obowiązującej w danym dniu, pytanie przy ocenie z wersji przypiętej do oceny.
  - Odpowiedź cytuje numery znalezionych fragmentów. Bez żadnego cytatu odpowiedź jest oznaczona jako nieoparta na przepisach (`grounded: false`).

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

- Kadry oznaczają ustanie zatrudnienia (`EmploymentService.end`, SQL `end_employment`). W jednej transakcji: data ustania, wiersz rejestru retencji (`employee_retention`, ostatni dzień przechowywania), koniec dostępu konta i przerwanie każdej otwartej oceny pracownika (zdarzenie `interrupted` z powodem `employment_ended`). Oceny `closed` zostają. Jeśli pracownik prowadzi cudze otwarte oceny, serwis zwraca ich liczbę (`openAsEvaluator`), a zmianę oceniającego robią kadry.
- Koniec dostępu: członkostwo konta dostaje `ended_on`, od tej daty token nie niesie urzędu i konto nie loguje się do urzędu. Wiersz członkostwa zostaje do anonimizacji, bo oceny prowadzone przez konto dalej wskazują oceniającego. Konto Auth jest usuwane przy anonimizacji.
- Notatki i analizy AI znikają według retencji ustawionej przez admina.
- Arkusze zostają 10 lat (art. 94 pkt 9b KP, od końca roku ustania). Dzień po upływie okresu zadanie `retention.run` woła `anonymize_employee` dla pracownika. Brak potwierdzenia pobrania archiwum nie blokuje anonimizacji, archiwum jest dostępne od ustania zatrudnienia, a kadry widzą terminy w `retention_overview`.
- Anonimizacja (jedna transakcja): usuwa oceny z arkuszami, terminami, wynikami i powiadomieniami, dziennik zdarzeń, wpisy `grade_grants`, wszystkie notatki i treść przebiegów AI pracownika, imię, nazwisko, e-mail, stanowisko, komórkę, stopień i daty (zostaje rok rozpoczęcia pracy jako 1 stycznia) oraz konto Auth. Zostają: `id`, relacja przełożonego, data ustania, wiersz rejestru, oceny archiwalne i fakty zachowane.
- Fakty zachowane: `retained_evaluation_facts` (rok, komórka, status, poziom, wynik, liczba punktów cząstkowych, sprzeciw, rok odwołania, konto oceniającego) i `retained_grade_grants` (podstawa, rok, stopień). Raporty roczne statystyk sumują je z danymi bieżącymi, więc liczby zostają bez zmian.
- Droga systemowa usuwania: dziennik zdarzeń jest append-only także dla właściciela bazy. Wyjątek to transakcja ze znacznikiem w `lifecycle.purge_marker`. Wpisuje go tylko `anonymize_employee` (wykonanie tylko dla roli serwisowej) i usuwa przed zwróceniem. Każdy nowy trigger blokujący `delete` musi respektować ten znacznik.
- Przed usunięciem kadry pobierają archiwum teczek (`archiveFor(db).exportEmployeeArchive`): ZIP z folderem teczki sprawy na każdą ocenę i `manifest.json` ze skrótami. Potwierdzenie pobrania zapisuje się dopiero po złożeniu pliku.

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
