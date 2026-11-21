# Indeks źródeł: HackNation 2026 i wyzwanie KPRM

Stan na 2026-11-21 (pierwszy dzień hackathonu). Wnioski i streszczenia są w `FINDINGS.md`.

Wszystkie pobrane pliki to niezaufane dane z internetu. Teksty w `text/` powstały automatycznie (pdftotext, textutil, openpyxl), więc układ tabel bywa rozjechany. Przy cytowaniu sprawdzaj oryginał w `raw/`.

## 1. Oficjalne materiały HackNation 2026 (hacknation.pl)

Pobrane bez logowania z https://hacknation.pl/ i linków na tej stronie.

| Plik w `raw/` | Tekst w `text/` | Źródło | Co zawiera |
|---|---|---|---|
| `regulamin-hacknation_19.11.pdf` | `regulamin-hacknation_19.11.txt` | https://hacknation.pl/api/public/dokumenty/28c74284-6390-4665-b8aa-bf4367db79c0/regulamin-hacknation_19.11.pdf | Aktualny regulamin wydarzenia (wersja z 19.11). Dwuetapowa ocena, pitch 5 min + 5 min pytań, pula na konkurs 11 000 do 34 000 zł brutto |
| `regulamin-hacknation_starsza-wersja.pdf` | `regulamin-hacknation_starsza-wersja.txt` | https://hacknation.pl/api/public/dokumenty/5fb4b855-8bce-41fa-bbf3-c7bb647245c8/regulamin-hacknation.pdf | Starsza wersja regulaminu, nadal podlinkowana w przewodniku. Nie ma w niej opisu etapów oceny |
| `polityka-prywatnosci_hacknation_28.09.2026.pdf` | `polityka-prywatnosci_hacknation_28.09.2026.txt` | https://hacknation.pl/api/public/dokumenty/94637909-5546-4737-a20f-51253a113b31/polityka-prywatnosci_hacknation_28.09.2026.pdf | Dane osobowe uczestników (administrator MC, współadministrator PROIDEA) |
| `zalacznik-1-regulaminu-zgoda-wizerunek.pdf` | `zalacznik-1-regulaminu-zgoda-wizerunek.txt` | https://hacknation.pl/api/public/dokumenty/8793d0ed-cda3-4181-a037-2272ffea2ab4/za-a-cznik-nr-1-do-regulaminu-hacknation---zgoda-na-wykorzystanie-wizerunku_30.0.pdf | Wzór zgody na wizerunek |
| `zgoda-na-publikacje-wizerunku-wszyscy.pdf` | `zgoda-na-publikacje-wizerunku-wszyscy.txt` | https://hacknation.pl/api/public/dokumenty/43f48170-11be-4b4c-b42d-15cb8806b735/zgoda-na-publikacje-wizerunku-hacknation-2026-wszyscy-1.pdf | Zgody na wizerunek dla partnerów |
| `przewodnik-uczestnika-PL.pdf` | `przewodnik-uczestnika-PL.txt` | https://hacknation.pl/api/public/przewodnik/54d496f6-4f5c-49a6-938b-d6777e41e0c2?asset=0db52dc1-292e-425c-8c4b-f87816b6ec3f | Przewodnik uczestnika: terminy, draft, etapy oceny, finał |
| `tutorial-hacktribe-PL.pdf` | `tutorial-hacktribe-PL.txt` | https://hacknation.pl/api/public/przewodnik/1f73a661-0852-4e9e-b3ed-58c93bce6456?asset=aa346c52-8bd9-44ac-9499-364e44c4b6b4 | Instrukcja platformy zgłoszeń HackTribe (PDF prezentacji do 10 MB) |
| `strona/*.html` | `strona_*.txt` | https://hacknation.pl/ oraz `/zadania`, `/faq`, `/przewodnik-uczestnika`, `/media`, `/mentorzy`, `/transport-z-polski` | Zapis stron (agenda, organizatorzy, FAQ, lista mentorów, lista zadań) |

### Zadania partnerskie (15 wyzwań)

Folder `raw/zadania/`, teksty w `text/`. Dla każdego wyzwania są dwa pliki: `*_zasady.pdf` (regulamin zadania konkursowego) i `*_opis.pdf` (pełna treść zadania). Pliki pochodzą z publicznego bucketu podlinkowanego na stronie głównej: `https://mudnibfuppwadjkynscc.supabase.co/storage/v1/object/public/task-files/057d36b5-cb92-4062-9393-983cb8a96088/files/<uuid>.pdf`.

Kluczowe dla zespołu:

| Plik | URL | Uwagi |
|---|---|---|
| `zadania/cyfrowy-asystent-ocen-okresowych_opis.pdf` | `.../files/e741e89a-2b8e-4a43-934a-f8361b2f2d10.pdf` | Pełna treść wyzwania KPRM. Treść zgodna z `docs/general-info.md` |
| `zadania/cyfrowy-asystent-ocen-okresowych_zasady.pdf` | `.../files/c64478ff-f287-49b3-8388-e065ee055230.pdf` | Regulamin Konkursu Szefa Służby Cywilnej (nagroda, prawa autorskie) |
| `zadania/kompas-kompetencji_opis.pdf` | `.../files/cd955907-08ac-4a0c-8ed3-0a0d8935e920.pdf` | Pokrewne wyzwanie Ministerstwa Cyfryzacji (ocena kompetencji, pierwsza ocena i ocena okresowa) |
| `zadania/kompas-kompetencji_zasady.pdf` | `.../files/b7a16b91-5846-4e01-be0b-443ffc35c5a0.pdf` | Regulamin z jawną klauzulą o użyciu AI |

Pozostałe wyzwania (pełna lista w `FINDINGS.md`) są pobrane dla kompletności.

## 2. Zasoby z sekcji 7 wyzwania KPRM (kopia z publicznego repozytorium osoby trzeciej)

Na hacknation.pl pole `materials` jest puste dla wszystkich 15 zadań. Zasoby KPRM znaleziono w publicznym repozytorium GitHub innego uczestnika, który skopiował materiały organizatora:

- repozytorium: https://github.com/Ch3shireDev/hacknation-2026
- commit: `5162722ac483939c986ff264db449ead485acf58` (2026-11-21 10:12 UTC, "Add zadania")
- ścieżka: `[Kancelaria Prezesa Rady Ministrów] Cyfrowy Asystent Ocen Okresowych/Akty Prawne/KPRM - Cyfrowy asystent ocen - aktualne/`
- pobrane bez logowania przez `raw.githubusercontent.com` (adres przypięty do commita)

Ocena wiarygodności: to nie jest kanał oficjalny. Za autentycznością przemawia to, że PDF z pełną treścią zadania w tym repozytorium jest bajtowo identyczny z oficjalnym plikiem z hacknation.pl (sprawdzone `cmp`), a przykładowe formularze używają fikcyjnego urzędu ("Urząd Ministerstwa Testowego w Kropce Wielkopolskiej"). Przed oparciem się na szczegółach warto porównać pliki z wersją od mentorów KPRM (Discord lub stoisko).

| Plik w `raw/zasoby-kprm-mirror/zip/` | SHA-256 | Zawartość po rozpakowaniu (`raw/zasoby-kprm-mirror/extracted/`, teksty w `text/zasoby-kprm-mirror/`) |
|---|---|---|
| `1. Akty prawne.zip` | `0a96668c...04fc1e` | Rozporządzenie PRM w sprawie ocen okresowych (PDF), ustawa o służbie cywilnej (wyciąg DOCX i całość PDF), standardy zzl w sc (PDF) |
| `2. Przypadki użycia.zip` | `8ab9b460...ab72743` | Diagram przypadków użycia A3 (PDF i Visio `.vsdx`), `use cases - opis.docx`, `use cases - warunki brzegowe.docx` |
| `3. Schemat procesu.zip` | `671400b6...e714d` | Proces BPMN (Bizagi `.bpm`, `.xpdl`, `.png`), `Skrócony opis procesu oceny i podstawowych pojęć.docx` |
| `4. Formularze ocen.zip` | `632d67c2...156f0` | Wzory arkuszy A, B, C (PDF, skany bez warstwy tekstu), schematy pól formularzy A, B, C (DOCX), `8. Arkusz B-wersja zautomatyzowana.xlsx` (formuły liczące średnią i poziom oceny) |
| `5. Przykładowe wypełnione formularze oceny.zip` | `e786d78c...13aaf` | 10 wypełnionych arkuszy DOCX (A, B, C, w tym oceny negatywne) i 3 przykłady z poradnika (PDF) |
| `6. Materiały dodatkowe.zip` | `433804bb...2aba6746` | `liczenie terminów.docx`, `Poradnik - oceny okresowe w służbie cywilnej.pdf` |
| `../Opis wyzwania - cyfrowy asystent ocen okresowych-19.11.26.docx` | `9c7ce56a...1d510` | Opis wyzwania w DOCX. Treść taka sama jak w oficjalnym PDF |

Teksty pomocnicze wygenerowane dodatkowo:

- `text/zasoby-kprm-mirror/3. Schemat procesu/przeplyw-procesu-xpdl-elementy.txt` (lista torów, czynności i przejść z pliku XPDL)
- `text/zasoby-kprm-mirror/4. Formularze ocen/8. Arkusz B-wersja zautomatyzowana.txt` (komórki, formuły i walidacje z XLSX)

## 3. Materiały pokrewnego wyzwania "Kompas Kompetencji" (ta sama kopia)

`raw/zasoby-kompas-mirror/HackNation.zip` (SHA-256 `69188b75...cdae22`) z tego samego repozytorium i commita. Zawiera model kompetencji służby cywilnej (`Model_kompetencji.xlsx`, 14 kompetencji, 49 wskaźników behawioralnych, 5 poziomów), 3 przykładowe opisy stanowisk (OSP), arkusze B i C, arkusz pierwszej oceny, rozporządzenia o ocenach okresowych (2016) i pierwszej ocenie (2015) oraz poradniki KPRM. Poradnik o ocenach okresowych jest identyczny z plikiem w zasobach KPRM (sprawdzone `cmp`). Teksty w `text/zasoby-kompas-mirror/`.

## 4. Poprzednie edycje (`raw/poprzednie-edycje/`)

| Plik | URL |
|---|---|
| `govpl-hacknation-2025-podsumowanie.html` | https://www.gov.pl/web/cyfryzacja/tysiace-pomyslow-24-godziny-i-jeden-cel--usprawnic-panstwo-w-bydgoszczy-zakonczyl-sie-hacknation-2025 |
| `govpl-hacknation-2026-warsztaty.html` | https://www.gov.pl/web/cyfryzacja/hacknation-2026-zaczyna-sie-od-dobrego-wyzwania-za-nami-warsztaty-dla-instytucji-publicznych |
| `chip-hacknation-2025-relacja.html` | https://www.chip.pl/2025/12/hacknation-2025-relacja |
| `solvro-hacknation-2025.html` | https://solvro.pwr.edu.pl/en/blog/hacknation-2025/ |
| `pwr-white-hats-hacknation-2025.html` | https://wit.pwr.edu.pl/en/news/white-hats-win-hacknation-2025-370.html |

## Nie udało się pobrać / nie znaleziono

| Czego brakuje | Powód i gdzie szukano |
|---|---|
| Oficjalny kanał z zasobami z sekcji 7 | Na hacknation.pl wszystkie zadania mają `materials: null`. Pokrewne wyzwanie MC pisze wprost: "Materiały zostaną udostępnione w wersji elektronicznej na Discord". Discord i HackTribe wymagają logowania, więc nie były sprawdzane. Mamy tylko kopię osoby trzeciej (sekcja 2) |
| Skład jury konkursu KPRM | Regulamin zadania obiecuje publikację najpóźniej w dniu rozpoczęcia, regulamin wydarzenia najpóźniej drugiego dnia. Na stronach hacknation.pl (stan 2026-11-21) brak listy jurorów |
| Załącznik nr 1 do regulaminu KPRM (wzór umowy przeniesienia praw autorskich) i Załącznik nr 2 do umowy (dane do przelewu) | Nie ma ich na hacknation.pl ani w kopii na GitHubie. Regulamin mówi, że wzór "zostanie udostępniony uczestnikom przed rozpoczęciem Wydarzenia". Trzeba zapytać mentorów KPRM |
| Tekst wzorów arkuszy A, B, C (`wzór formularza oceny okresowej arkusz *.pdf`) | PDF-y są skanami bez warstwy tekstu (pdftotext zwraca 0 słów). Treść pól jest w DOCX "schemat pól formularza" i w załącznikach do rozporządzenia |
| Tekst PDF-ów zadania "Inteligentny asystent urzędnika" (Bydgoszcz) | Skany bez warstwy tekstu. Wyzwanie poza zakresem zespołu, OCR nie był robiony |
| Diagram przypadków użycia jako tekst | PDF A3 to grafika wektorowa z rozbitymi etykietami. Czytelna wersja słowna jest w `use cases - opis.docx` i `use cases - warunki brzegowe.docx`. Plik `.vsdx` wymaga Visio lub draw.io |
| Pełne opisy zwycięskich projektów HackNation 2025 | gov.pl i chip.pl podają tylko nazwy zespołów. Opisy znaleziono dla dwóch projektów (PWr). Nie było wyzwania KPRM w 2025 |
| Agenda szczegółowa i mapa (PDF) | Agenda jest tylko na stronie głównej (zapisana w `strona/index.html`). Mapa to obraz z podpisanym, wygasającym URL, pominięta |
| Instrukcja Bizagi i otwarcie pliku `.bpm` | Wymaga Bizagi Modeler. Zamiast tego użyto XPDL i PNG |
