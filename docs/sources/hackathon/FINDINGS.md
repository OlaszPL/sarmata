# HackNation 2026: ustalenia dla wyzwania "Cyfrowy Asystent Ocen Okresowych"

Stan na 2026-11-21, czyli pierwszy dzień hackathonu. Spis plików i braków jest w `INDEX.md`.

## 1. Hackathon

**Nazwa:** HackNation 2026, druga edycja "największego w Polsce hackathonu wdrożeniowego". Źródło: https://hacknation.pl/

**Organizatorzy:** Ministerstwo Cyfryzacji (formalny Organizator w regulaminie), Departament GovTech Polska, Miasto Bydgoszcz. Operatorem (rejestracja, strona, HackTribe, logistyka) jest PROIDEA sp. z o.o. Źródła: https://hacknation.pl/, `text/regulamin-hacknation_19.11.txt`, `text/polityka-prywatnosci_hacknation_28.09.2026.txt`, `text/tutorial-hacktribe-PL.txt`.

**Daty i miejsce:** 21 do 22 listopada 2026, Bydgoskie Centrum Targowo-Wystawiennicze (BCTW), ul. Gdańska 187, Bydgoszcz. Udział tylko stacjonarny i bezpłatny. Uczestnicy muszą być pełnoletni i mieć obywatelstwo UE albo status rezydenta UE.

**Skala:** 15 wyzwań od 14 partnerów, łączna pula ponad 370 000 zł. W 2025 było blisko 1500 uczestników i 437 zgłoszonych rozwiązań.

### Harmonogram (https://hacknation.pl/#agenda, przewodnik uczestnika)

| Kiedy | Co |
|---|---|
| sob 21.11, 08:00 | Rejestracja, śniadanie |
| sob 10:30 | Ceremonia otwarcia |
| sob 11:00 | Publikacja pełnych treści zadań, start kodowania, otwarcie HackTribe |
| sob 16:00 | Prelekcja (Jacek Laskowski) |
| **sob 20:00** | **Draft w HackTribe: projekt musi istnieć, wybrane zadanie, nazwa zespołu, link do repozytorium, numer stolika, krótki opis. Po 20:00 nie da się utworzyć projektu ani zmienić zadania** |
| **ndz 22.11, 11:00** | **Koniec kodowania i ostateczny termin zgłoszenia. Start Etapu I oceny** |
| ndz 11:30 | Prelekcja (Agata Ślusarek) |
| ndz ok. 14:45 | Ogłoszenie finalistów (5 na zadanie) i kolejności prezentacji, wyniki Etapu I widoczne w HackTribe ok. 15:00 |
| ndz 15:15 | Pitching, Etap II oceny |
| ndz 17:15 | Wręczenie nagród, zamknięcie |

### Zasady oceny (regulamin wydarzenia pkt 5, przewodnik s. 18 i 19)

- Jury każdego konkursu ma co najmniej 3 osoby i wybiera je instytucja zgłaszająca zadanie.
- **Etap I:** jurorzy oceniają zgłoszenia w HackTribe. Każde kryterium w skali 0 do 10, HackTribe mnoży przez wagi z regulaminu zadania. Do finału wchodzi 5 najlepszych zespołów z zadania (przy mniej niż 5 ocenionych zespołach finalista musi mieć co najmniej 50% punktów).
- **Etap II:** prezentacja na żywo, maksymalnie 5 minut pitchu i 5 minut pytań jury. Wyniki Etapu I nie przechodzą do finału. Jury rozstrzyga zwykłą większością głosów, przy remisie decyduje przewodniczący. Prezentacje nie są nagrywane.
- Jury może nie przyznać nagrody, jeśli żadne rozwiązanie nie osiągnie poziomu (w szczególności poniżej 50% maksymalnej liczby punktów).
- Decyzje jury są ostateczne. Zmiany po terminie nie są brane pod uwagę.

### Jury

Nie opublikowano składu jury dla wyzwania KPRM ani dla innych zadań (sprawdzono hacknation.pl, FAQ, mentorów, przewodnik). Regulamin zadania KPRM (§2 ust. 3) mówi, że skład zostanie opublikowany najpóźniej w dniu rozpoczęcia wydarzenia. Regulamin wydarzenia (pkt 5.3) mówi o drugim dniu. Najpewniej pojawi się na Discordzie lub w HackTribe.

### Lista wyzwań (strona główna, dane z `strona/index.html`)

Kwota to "nagroda główna" pokazywana na stronie. Regulaminy zadań podają kwoty brutto (np. KPRM: 33 333,33 zł brutto przy 30 000 zł na stronie, co odpowiada potrąceniu 10% podatku).

| Wyzwanie | Instytucja | Nagroda (strona) |
|---|---|---|
| **Cyfrowy Asystent Ocen Okresowych** | KPRM, Służba Cywilna | 30 000 zł |
| **Kompas Kompetencji** | Ministerstwo Cyfryzacji, Biuro Dyrektora Generalnego | 22 223 zł |
| Misja AED: dane na ratunek | MC, Departament Zarządzania Danymi | 27 777,78 zł |
| Risk Miner | Ministerstwo Funduszy i Polityki Regionalnej | 25 000 zł |
| Attack Surface Intelligence | AGH | 25 000 zł |
| Kolekcjoner Fejków | NASK | 33 333,33 zł |
| Radar Innowacji | Podkarpackie Centrum Innowacji | 11 111,11 zł |
| Odwołania2JSON | Urząd Zamówień Publicznych | 20 000 zł |
| #InvestWatch: na straży inwestorów | UKNF | 30 000 zł |
| Cyfryzacja Formularzy | Centralny Ośrodek Informatyki | 25 000 zł |
| Przewodnik Przyszłego Rodzica | ZUS | 30 000 zł |
| OSINTowy Łapacz Cyfrowych Śladów | MF, Krajowa Administracja Skarbowa | 30 000 zł |
| Prawdowid | MSZ | 30 000 zł |
| Zatrzymaj Wodę, Chroń Plony | KOWR | 27 777,78 zł |
| Inteligentny asystent urzędnika | Miasto Bydgoszcz | 15 000 zł |

**Ważne:** "Kompas Kompetencji" dotyczy tego samego procesu (ocena okresowa i pierwsza ocena w służbie cywilnej, model kompetencji, asystent AI dla przełożonego). Pełna treść: `text/kompas-kompetencji_opis.txt`.

### Forma zgłoszenia

- Platforma **HackTribe** (pierwszy raz na HackNation, interfejs po angielsku). Link rejestracyjny przychodzi na Discordzie, kanał ogłoszeń. Źródło: `text/tutorial-hacktribe-PL.txt`.
- Zespół 1 do 6 osób. Jedna osoba w jednym zespole. Zespół może startować w maksymalnie dwóch zadaniach, każde wymaga osobnego projektu z innym Team Leaderem. Organizatorzy odradzają zgłaszanie jednego projektu do dwóch zadań, także z powodu przeniesienia praw autorskich.
- Pola obowiązkowe: nazwa projektu, zadanie, opis rozwiązania, przyjęte podejście, dotychczasowy postęp, repozytorium, nazwa drużyny. W niedzielę obowiązkowa staje się prezentacja: **PDF, maksymalnie 10 MB**. Jest dodatkowe pole na inne materiały.
- Przewodnik zaleca krótkie demo (do 2 minut), działające linki i zwięzły opis, bo "jurorzy mają tylko kilka minut na ocenę".
- Komunikacja: Discord (https://discord.gg/VtqwHWNnz7), kanały `#zapytaj-organizatora`, `#faq` i kanał każdego zadania do umawiania mentorów.

## 2. Wyzwanie KPRM: regulamin zadania i treść

Źródła: `text/cyfrowy-asystent-ocen-okresowych_zasady.txt`, `text/cyfrowy-asystent-ocen-okresowych_opis.txt`.

- Nazwa formalna: Konkurs Szefa Służby Cywilnej, zadanie "Cyfrowy Asystent Ocen Okresowych".
- Przyrzekający nagrodę: Skarb Państwa, KPRM (obsługa Szefa Służby Cywilnej), reprezentowany przez Martę Kuzawińską, Dyrektorkę Departamentu Służby Cywilnej.
- Jedna nagroda główna: **33 333,33 zł brutto**, pomniejszona o podatek, który pobiera KPRM jako płatnik. Dzielona po równo między członków zespołu, chyba że wszyscy złożą wspólne oświadczenie o innym podziale. Wypłata do 7 dni od zawarcia umowy przeniesienia praw.
- Treść wyzwania w PDF z hacknation.pl jest taka sama jak w `docs/general-info.md` (z przypisami).
- **Kryteria oceny:** związek z wyzwaniem, w tym zakres odwzorowania procedur i zgodność z prawem (30%), oryginalność (20%), kompletność (20%), potencjał wdrożeniowy, czyli wdrożenie w większości urzędów oraz łatwość aktualizacji i naprawy błędów (30%).
- **Wymagane w zgłoszeniu:** tytuł, opis rozwiązania, identyfikacja problemu i sposobu rozwiązania, **prezentacja PDF maksymalnie 15 slajdów**, materiał demonstracyjny (prototyp). Opcjonalnie: repozytorium, zrzuty ekranu, link do demo, dokumentacja techniczna, grafiki.
- **Walidacja:** na prezentacji trzeba pokazać cały proces sporządzenia oceny okresowej. Oddzielnie oceniany jest moduł wirtualnego HR partnera.
- Mentorzy KPRM (6 osób merytorycznych z DSC i 2 techniczne z Biura Informatyki) są dostępni 24 h przy stoisku i telefonicznie. Kontakty w treści wyzwania.

## 3. Zasoby z sekcji 7: status

| Zasób z sekcji 7 | Status | Gdzie |
|---|---|---|
| 1) Akty prawne | Mamy (kopia) | `raw/zasoby-kprm-mirror/extracted/1. Akty prawne/` oraz niezależnie z ISAP w `docs/legal/raw/` |
| 2) Przypadki użycia, schemat i opis | Mamy (kopia) | `.../2. Przypadki użycia/` (diagram A3 PDF i VSDX, opis, warunki brzegowe) |
| 3) Schemat procesu | Mamy (kopia) | `.../3. Schemat procesu/` (BPMN Bizagi, XPDL, PNG, skrócony opis procesu i pojęć) |
| 4) Formularze ocen, wzory i opisy pól | Mamy (kopia) | `.../4. Formularze ocen/` (wzory A, B, C jako skany PDF, schematy pól DOCX, automatyczny arkusz B w XLSX) |
| 5) Przykładowe wypełnione formularze | Mamy (kopia) | `.../5. Przykładowe wypełnione formularze oceny/` (13 przykładów, w tym oceny negatywne) |
| Dodatkowo: "6. Materiały dodatkowe" | Mamy (kopia) | Zasady liczenia terminów i poradnik KPRM o ocenach okresowych |

Na oficjalnej stronie tych plików nie ma (pole `materials` puste we wszystkich zadaniach). Pochodzą z publicznego repozytorium innego uczestnika: https://github.com/Ch3shireDev/hacknation-2026, commit `5162722ac483939c986ff264db449ead485acf58`. Pobrano je bez logowania. PDF treści zadania z tego repozytorium jest bajtowo identyczny z oficjalnym, co uprawdopodabnia wierność kopii. Oficjalny kanał to najpewniej Discord (tak deklaruje pokrewne zadanie MC) lub stoisko KPRM.

### Co wynika z zasobów (krótko, do weryfikacji)

- **Role w procesie BPMN** (`przeplyw-procesu-xpdl-elementy.txt`, PNG): ZARZĄDZAJĄCY (kadry), OCENIAJĄCY, OCENIANY, ADMIN, SCHEDULER (CZAS). Scheduler to osobny aktor: przypomnienia o wyznaczeniu kryteriów i terminie oceny, automatyczne przesunięcie terminu o czas nieobecności, przypomnienie o obowiązkowym kolejnym stopniu służbowym.
- **Podprocesy w BPMN:** wyznaczenie kryteriów, zmiana terminu (długotrwała nieobecność, decyzja oceniającego, wniosek ocenianego), dokonanie oceny, wniosek o kolejny stopień służbowy, obligatoryjne przyznanie stopnia, uwzględnione odwołanie ze zmianą oceny, uwzględnione odwołanie z ponownym sporządzeniem oceny.
- **Warunki brzegowe** (`use cases - warunki brzegowe.txt`): kryteria wyznacza się po nawiązaniu stosunku pracy na czas nieokreślony albo po poprzedniej ocenie. Termin oceny co do zasady 24 miesiące. Nieobecność przesuwa termin, gdy jest usprawiedliwiona, ciągła i dłuższa niż miesiąc. Wniosek ocenianego o zmianę terminu możliwy po 6 miesiącach. Wniosek o kolejny stopień tylko dla urzędnika mianowanego z oceną pozytywną. Stopień obligatoryjny po drugiej z kolei ocenie na jednym z dwóch najwyższych poziomów. Wymieniona jest też "fikcja zapoznania z oceną".
- **Skrócony opis procesu:** kryteria w ciągu 30 dni od rozpoczęcia cyklu (7 dni po ocenie negatywnej), 0 do 3 kryteriów dodatkowych, skala 1, 3, 5, 7, 9, 5 lub 6 kryteriów obowiązkowych zależnie od arkusza, sprzeciw do dyrektora generalnego w 7 dni, potem sąd pracy.
- **Liczenie terminów** (`liczenie terminów.txt`): reguły dla terminów miesięcznych (koniec miesiąca, lata przestępne), przesunięcie z soboty i dni wolnych, ciągłość nieobecności przez weekend. Gotowe przypadki testowe dla modułu terminów.
- **Przypadki użycia "ogólne":** import danych pracownika, podległość służbowa, nieobecności, zastępstwa, statystyki, archiwizacja, historia ocen, wydruk "najlepiej zgodny z wzorem z rozporządzenia", usunięcie danych pracownika.
- **Arkusz B zautomatyzowany (XLSX):** pokazuje, jak KPRM sam liczy średnią i poziom oceny w Excelu (listy rozwijane, formuły). Dobry wzorzec reguł i punkt odniesienia "jak jest dziś".

## 4. Regulamin: kluczowe zasady

### Terminy oddania
- Draft w HackTribe do **sob 21.11, 20:00** (projekt, zadanie, repozytorium). Wybór zadania jest potem nieodwracalny.
- Zgłoszenie końcowe do **ndz 22.11, 11:00**. Zmiany po terminie nie są brane pod uwagę. Można wcześniej wgrać wersję niepełną i ją podmieniać.

### Format prezentacji
- KPRM: PDF, maksymalnie 15 slajdów. HackTribe: PDF do 10 MB.
- Finał: maksymalnie 5 minut pitchu i 5 minut pytań. KPRM oczekuje pokazania całego procesu oceny okresowej i modułu HR partnera.
- Przewodnik: demo do 2 minut w zgłoszeniu, działające linki.

### Licencja i własność intelektualna
- Regulamin KPRM nie wymaga licencji open source. Wymaga **pisemnej umowy przeniesienia autorskich praw majątkowych** na KPRM (art. 53 ust. 1 pr. aut.). Pola eksploatacji: art. 74 ust. 4 dla programu, art. 50 dla reszty, a dla kodu źródłowego także modyfikacja, kompilacja, łączenie, testowanie, wdrażanie i używanie.
- Umowę podpisują wszyscy współtwórcy. Brak podpisu w 7 dni od otrzymania umowy podpisanej przez KPRM oznacza utratę nagrody na rzecz kolejnego zespołu wskazanego przez jury.
- Każdy uczestnik oświadcza, że jest twórcą swojego wkładu i że rozwiązanie jest wolne od wad prawnych i nie narusza praw osób trzecich.
- Wzór umowy (Załącznik nr 1) nie jest publicznie dostępny.
- Wymaganie techniczne KPRM: rozwiązanie "niewymagające płatnych licencji".
- FAQ: wcześniej przygotowane lub zewnętrzne zasoby, narzędzia i repozytoria trzeba rzetelnie wymienić w prezentacji lub kodzie.

### Wykorzystanie AI
- Regulamin wydarzenia i regulamin zadania KPRM **nie zawierają klauzuli o AI**. Treść wyzwania KPRM zachęca do AI w produkcie.
- Przewodnik uczestnika: wątpliwości dotyczące AI, wcześniej przygotowanego kodu i praw autorskich trzeba wyjaśnić przed zgłoszeniem.
- Dla porównania regulaminy innych zadań (Kompas Kompetencji, Misja AED) dopuszczają AI przy tworzeniu rozwiązania, jeśli finalnie praca jest efektem pracy człowieka i autorskim rozwiązaniem zespołu. Kompas Kompetencji pozwala w prototypie tylko na darmowe narzędzia AI i wymaga opisu użycia AI.

### Dane osobowe
- Dane uczestników: administrator Minister Cyfryzacji, współadministrator PROIDEA. Wizerunek na podstawie zgody (Załącznik nr 1 do regulaminu).
- W rozwiązaniu KPRM wymaga kontroli dostępu, ochrony danych osobowych i anonimizacji, gdy dane są przetwarzane poza infrastrukturą użytkownika.
- Przykładowe formularze KPRM używają fikcyjnych danych ("Urząd Ministerstwa Testowego w Kropce Wielkopolskiej"). Na demo warto robić to samo.

## 5. Poprzednie edycje

**HackNation 2025:** 6 do 7 grudnia 2025, BCTW Bydgoszcz, ponad 1500 uczestników, 16 zadań, 25 000 zł dla zwycięzcy każdego zadania i oferta dalszej współpracy z instytucją. Jury wybierało 3 finalistów na zadanie, potem jednego zwycięzcę "o największym potencjale wdrożeniowym". **Nie było wyzwania KPRM ani wyzwania o ocenach pracowniczych.** Źródła: https://www.gov.pl/web/cyfryzacja/tysiace-pomyslow-24-godziny-i-jeden-cel--usprawnic-panstwo-w-bydgoszczy-zakonczyl-sie-hacknation-2025, https://www.chip.pl/2025/12/hacknation-2025-relacja.

Najbliższe tematycznie zwycięstwa (asystenci dla urzędników):
- **"AI w służbie decyzji" (Ministerstwo Sportu i Turystyki), zespół Programiści PWR (koło White Hats).** Silnik zbierający sprawy z istniejących systemów i generujący szablony odpowiedzi plus nakładka na Microsoft Word jako interfejs, od wpływu dokumentu do decyzji. Zespół podkreślał, że wejście w narzędzie, którego urzędnik już używa, zamiast osobnej aplikacji, było trafną decyzją, a prototyp był przyjazny w obsłudze. Źródło: https://wit.pwr.edu.pl/en/news/white-hats-win-hacknation-2025-370.html
- **"Ścieżka prawa"** (MC i Grupa Robocza ds. SI), Code Casimir, oraz **"ZUS Accident Notification Tool"**, kanapowcy. Brak publicznych opisów projektów.

Relacja zespołu Solvro (finalista KAS, https://solvro.pwr.edu.pl/en/blog/hacknation-2025/):
- W finale jury zamiast przygotowanej prezentacji poprosiło o **demo na żywo konkretnego przypadku użycia**.
- Dużą część pracy zajęło zdobycie wiedzy dziedzinowej z materiałów instytucji.
- Pomogła zasada 3-30-300: kluczowa informacja widoczna w 3 sekundy, analiza w 30, pełne szczegóły w 300.

Przed edycją 2026 GovTech prowadził warsztaty dla instytucji. Podkreślano, że dobre wyzwanie jest konkretne i wykonalne w czasie hackathonu, a celem jest wdrożenie. Źródło: https://www.gov.pl/web/cyfryzacja/hacknation-2026-zaczyna-sie-od-dobrego-wyzwania-za-nami-warsztaty-dla-instytucji-publicznych.

## 6. Wnioski dla zespołu

1. **Czas.** Hackathon trwa. Draft w HackTribe (z linkiem do repozytorium) musi powstać dziś do 20:00, finał zgłoszenia jutro o 11:00. Repozytorium i projekt w HackTribe warto założyć od razu.
2. **Zasoby mamy, ale z nieoficjalnej kopii.** Warto poprosić mentorów KPRM (Discord lub stoisko) o oficjalny pakiet i porównać sumy SHA-256 z `INDEX.md`. Przy okazji warto poprosić o wzór umowy przeniesienia praw i zapytać o skład jury.
3. **Punktacja nagradza wierność procesowi i wdrażalność (razem 60%).** Demo powinno przejść cały proces z BPMN: wyznaczenie kryteriów, rozmowa, notatki, ocena, zapoznanie, a do tego co najmniej jeden podproces (nieobecność ponad miesiąc albo wniosek o stopień służbowy) i scheduler terminów. Przypadki użycia i warunki brzegowe KPRM to gotowa lista kontrolna kompletności (20%).
4. **Wydruk zgodny ze wzorem z rozporządzenia** jest wprost w przypadkach użycia. Schematy pól A, B, C i 13 wypełnionych przykładów to gotowe dane testowe i fixtures.
5. **Moduł terminów warto przetestować na przykładach z `liczenie terminów.docx`.** To łatwy dowód poprawności formalnej przed jury.
6. **Wdrażalność:** brak płatnych licencji, uruchomienie w każdym urzędzie, reguły prawne w konfiguracji (nadchodząca nowelizacja ustawy, por. `docs/legal/raw/projekt-nowelizacji-usc-UDER102-*`). Lekcja z 2025: integracja z narzędziem, którego urzędnik już używa (eksport DOCX lub PDF, e-mail, EZD), dobrze wypadła u jury.
7. **AI i prawa.** Regulamin KPRM milczy o AI, a zwycięzca przenosi pełne prawa majątkowe. Trzeba prowadzić listę zależności i licencji (unikać licencji, które blokują przeniesienie lub wymagają płatności), zapisać użycie narzędzi AI w README i zapytać mentorów KPRM, czy mają oczekiwania co do AI.
8. **Dane:** tylko fikcyjne dane w demo, pokazać kontrolę dostępu według ról z BPMN i anonimizację przed wysłaniem do zewnętrznego LLM. To bezpośrednio wymóg sekcji 5 wyzwania.
9. **Prezentacja:** PDF do 15 slajdów i 10 MB, demo do 2 minut w zgłoszeniu, w finale 5 minut. Trzeba być gotowym na demo na żywo zamiast slajdów (doświadczenie z 2025).
10. **Kompas Kompetencji (MC)** dotyczy tego samego procesu i ma model kompetencji z 49 wskaźnikami (`raw/zasoby-kompas-mirror/`). Można go użyć jako źródła podpowiedzi przy kryteriach. Zgłoszenie tego samego projektu do obu zadań jest odradzane i koliduje z dwoma przeniesieniami praw, więc drugi start wymagałby osobnego projektu.
11. **Konkurencja.** Na GitHubie są już publiczne repozytoria innych zespołów pracujących nad tym wyzwaniem (np. `yx-aesthete/oko-ocena-okresowa`, `Orfeliny/Hacknation-2026`). Warto o tym pamiętać, decydując, czy nasze repozytorium ma być publiczne w trakcie hackathonu (HackTribe wymaga linku dostępnego dla jury).
