# Arkusze oceny okresowej A, B, C: od wzoru papierowego do formularza w aplikacji

Dokument roboczy do projektowania ekranów. Łączy trzy źródła:

1. wzory z rozporządzenia PRM z 4.04.2016 r. (załączniki nr 2, 3, 4), opisane w [../legal/rozporzadzenie-oceny-okresowe-2016.md](../legal/rozporzadzenie-oceny-okresowe-2016.md),
2. **oficjalne schematy pól od KPRM** (zasoby wyzwania): [schematy-pol-kprm/arkusz-A.md](schematy-pol-kprm/arkusz-A.md), [arkusz-B.md](schematy-pol-kprm/arkusz-B.md), [arkusz-C.md](schematy-pol-kprm/arkusz-C.md). KPRM opisuje w nich dla każdego pola: kto wypełnia, na jakim etapie, kiedy pole się blokuje, co system uzupełnia sam i jakie są walidacje,
3. praktykę DSC (Excel 2016, BOSC, poradnik 2016), zob. [../sources/sluzba-cywilna/FINDINGS.md](../sources/sluzba-cywilna/FINDINGS.md), sekcja 4.

## 1. Który arkusz i kiedy

| Arkusz | Dla kogo | Kryteria obowiązkowe | Różnice w polach | Podstawa |
|---|---|---|---|---|
| **A** | kierownik urzędu, gdy jego stanowisko jest stanowiskiem w służbie cywilnej (np. wojewódzki lekarz weterynarii, inspektor wojewódzki) | 6: zarządzanie ludźmi, podejmowanie decyzji i odpowiedzialność, organizacja pracy i orientacja na osiąganie celów, współpraca, komunikacja, **zarządzanie strategiczne** | brak pól „komórka organizacyjna” (oceniany i oceniający). Adresat sprzeciwu jest do wpisania przez oceniającego (nie ma DG nad kierownikiem urzędu) | § 3 ust. 2, § 4 ust. 1 |
| **B** | stanowisko, na którym praca polega na bezpośrednim kierowaniu pracownikami (kierownik sekcji, zespołu, naczelnik wydziału, dyrektor departamentu), „bez względu na nazwę” | 5: jak A bez zarządzania strategicznego | sprzeciw do dyrektora generalnego urzędu | § 3 ust. 3, § 4 ust. 2 |
| **C** | wszystkie pozostałe stanowiska | 5: wykorzystywanie wiedzy i doskonalenie zawodowe, rzetelność, organizacja pracy i orientacja na osiąganie celów, współpraca, komunikacja | jak B | § 3 ust. 4, § 4 ust. 3 |

Reguła wyboru w aplikacji: arkusz wynika z typu stanowiska w danych kadrowych (kierownik urzędu / kieruje pracownikami / pozostałe), nie z wyboru użytkownika. Błąd znany z kontroli NIK: PINB użył arkusza A zamiast C we wszystkich 15 ocenach, przez co pominięto 2 kryteria obowiązkowe ([../sources/praktyka-urzedow/FINDINGS.md](../sources/praktyka-urzedow/FINDINGS.md), sekcja 3).

Do każdego arkusza oceniający może dodać od 0 do 3 kryteriów dodatkowych z wykazu 14 kryteriów (załącznik nr 1), bez powtórzeń.

Arkusz nie dotyczy: osób na wyższych stanowiskach w SC, pracowników na czas określony (oni mają pierwszą ocenę, osobny arkusz z rozporządzenia z 2015 r.).

## 2. Etapy formularza (z czego wynikają blokady pól)

Schematy KPRM wiążą edycję każdego pola z etapem. Z nich wynika taki cykl życia jednego arkusza:

| Etap | Zdarzenie zamykające etap | Kto zatwierdza | Co się blokuje po zamknięciu |
|---|---|---|---|
| E1. Rozpoczęcie cyklu (ustalenie kryteriów) | potwierdzenie wyboru kryteriów i odbycia rozmowy rozpoczynającej | oceniający, potem oceniany potwierdza rozmowę | kryteria dodatkowe, termin oceny (dalej tylko w trybie „zmiana terminu oceny”) |
| E2. Okres oceny | nadejście terminu, rozpoczęcie rozmowy oceniającej | system (scheduler) | nic, to czas notatek i ewentualnych zmian terminu |
| E3. Rozmowa oceniająca | zatwierdzenie odbycia rozmowy oceniającej | oceniający | data rozmowy oceniającej, okres oceny od-do |
| E4. Sporządzenie oceny | zatwierdzenie dokonania oceny i przekazanie do zapoznania | oceniający | oceny cząstkowe, uzasadnienie, wnioski do IPRZ, dane poprzedniej oceny, wniosek o stopień, część III |
| E5. Zapoznanie | potwierdzenie zapoznania z oceną | oceniany | całość, potem biegnie 7 dni na sprzeciw |

Po zablokowaniu każde pole można zmienić **wyłącznie w trybie korekty błędów przez administratora** (wymaga śladu audytowego). Wyjątek: termin oceny, zmieniany w trybie „zmiana terminu oceny” (art. 81 ust. 8, pisemne zawiadomienie z § 8).

## 3. Pola: specyfikacja do ekranu

Skróty: **AUTO** = system uzupełnia sam, **OC** = oceniający, **ON** = oceniany, **ADM** = administrator. Etapy jak w sekcji 2. Pełne brzmienie wymagań w schematach KPRM.

### Część I (etap E1)

| Pole | Typ | Źródło wartości | Edycja | Walidacja i uwagi |
|---|---|---|---|---|
| Nazwa urzędu | tekst | AUTO ze struktury organizacyjnej | nie | |
| Oceniany: imię, nazwisko | tekst | AUTO z bazy pracowników | nie | |
| Oceniany: komórka organizacyjna | tekst | AUTO | nie | tylko B i C |
| Oceniany: stanowisko pracy | tekst | AUTO | nie | pełna nazwa z rozszerzeniem „do spraw...” z opisu stanowiska |
| Oceniający: imię, nazwisko, komórka (B, C), stanowisko | tekst | AUTO, oceniający = stanowisko bezpośrednio nadzorujące | nie | |
| Kryteria obowiązkowe | lista stała | AUTO wg arkusza | nie | 6 dla A, 5 dla B i C |
| Kryteria dodatkowe | 3 listy rozwijane | OC | E1 do potwierdzenia rozmowy | 0 do 3, bez powtórzeń (wybrana pozycja znika z pozostałych list), tylko z wykazu 14 |
| Termin sporządzenia oceny | data | AUTO: 24 miesiące od początku cyklu | OC w E1, później tylko tryb „zmiana terminu oceny” | liczenie terminów wg Kodeksu cywilnego (dzień wolny przesuwa termin), przedłużenie o nieobecności ponad miesiąc |
| Potwierdzenie rozmowy i zapoznania z kryteriami: miejscowość, data, imię i nazwisko oceniającego | podpis | AUTO w chwili potwierdzenia przez OC | nie | |
| To samo dla ocenianego | podpis | AUTO w chwili potwierdzenia przez ON | nie | |

### Część II (etapy E3 do E5)

| Pole | Typ | Źródło wartości | Edycja | Walidacja i uwagi |
|---|---|---|---|---|
| Data rozmowy oceniającej | data | OC | E3 | musi poprzedzać datę sporządzenia oceny (§ 10) |
| Okres oceny od, do | 2 daty | AUTO: od = data ustalenia kryteriów, do = data sporządzenia (dziś albo termin oceny, jeśli po terminie) | OC w E3 | przy ocenie z art. 81 ust. 6 po zmianie stanowiska „do” = ostatni dzień na stanowisku |
| Oceny cząstkowe: każde kryterium obowiązkowe | wybór 1 z 5 (1, 3, 5, 7, 9 pkt) | OC | E3 do E4 | dokładnie jedna wartość na kryterium |
| Oceny cząstkowe: kryteria dodatkowe | jw. | nazwy AUTO z części I, albo „brak” | E3 do E4 | |
| Średnia arytmetyczna | liczba | AUTO | nie | |
| Przyznanie oceny (przedział i poziom ogólny) | znak X | AUTO wg średniej | nie | progi 2 / 4 / 6 / 8 |
| Ocena okresowa: POZYTYWNA / NEGATYWNA | znak X | AUTO | nie | negatywna, gdy średnia ≤ 4 albo choć jedna ocena cząstkowa = 1 |
| Uzasadnienie przyznanej oceny | długi tekst | OC | E3 do E4 | **obowiązkowe przy ocenie negatywnej: brak blokuje zatwierdzenie**. DSC zaleca uzasadniać wszystkie oceny cząstkowe |
| Wnioski dotyczące IPRZ | długi tekst | OC | E3 do E4 | **zawsze obowiązkowe: brak blokuje zatwierdzenie** (art. 81 ust. 5) |
| Poprzednia ocena urzędnika: ocena, poziom, data | lista, lista, data | AUTO z historii, bez historii OC (ocena: pozytywna / negatywna / brak) | E3 do E4 | sekcja ukryta, gdy oceniany nie jest urzędnikiem SC. Data nieaktywna przy „brak” |
| Czy dołączono wniosek o kolejny stopień | TAK / NIE / NIE DOTYCZY | AUTO: NIE DOTYCZY dla pracownika SC, NIE przy ocenie negatywnej | OC tylko przy urzędniku z oceną pozytywną | |
| Dane oceniającego, miejscowość | tekst | AUTO, miejscowość z presetu urzędu | miejscowość: OC | |
| Data podpisu oceniającego | data | AUTO przy „potwierdź dokonanie oceny” | nie | |
| Oświadczenie ocenianego, miejscowość, data, imię i nazwisko | podpis | AUTO przy „potwierdź zapoznanie z oceną” przez ON | miejscowość: ON | od tej daty biegnie 7 dni na sprzeciw |
| Pouczenie o sprzeciwie | tekst stały | AUTO | A: adresat do wpisania przez OC (lub preset) | |

### Część III (tylko urzędnik SC, ocena pozytywna, wybrane „TAK”)

| Pole | Typ | Źródło wartości | Edycja | Walidacja i uwagi |
|---|---|---|---|---|
| Imię, nazwisko | tekst | AUTO | nie | |
| Rok mianowania | rok (2008 do dziś) | OC | E3 do E4 | |
| Posiadany stopień służbowy | lista I do IX | OC | E3 do E4 | przy IX komunikat: „Ocenianemu nie można przyznać kolejnego stopnia służbowego. Oceniany posiada już najwyższy możliwy stopień służbowy” |
| Data przyznania stopnia | data | OC | E3 do E4 | |
| Wnioskowany stopień | tekst | AUTO: posiadany + 1 („drugiego” itd.) | nie | |
| Umotywowanie wniosku | długi tekst | OC | E3 do E4 | obowiązkowe: brak blokuje zatwierdzenie |
| Miejscowość, data, imię i nazwisko oceniającego | podpis | AUTO | miejscowość: OC | |

Nieścisłości w schematach KPRM (warto zgłosić mentorom): pole „Uzasadnienie przyznanej oceny” jest opisane dwa razy z różnymi warunkami edycji. W kilku miejscach jest „przekazania jej do zapoznania oceniającemu” (powinno być: ocenianemu). Data w części III jest wypełniana „w momencie potwierdź zapoznanie z oceną przez oceniającego”, co wygląda na pomyłkę.

## 4. Reguły, których papier nie wymusza, a aplikacja powinna

Z przepisów (sekcja 10 w [../wymagania-i-kontekst.md](../wymagania-i-kontekst.md)) i z błędów wykrytych przez NIK:

- termin rozmowy rozpoczynającej: 30 dni od poprzedniej oceny albo od zatrudnienia na czas nieokreślony, 7 dni po ocenie negatywnej (najczęstszy błąd w kontrolach NIK, 9,5% ocen),
- arkusz dobrany automatycznie do typu stanowiska,
- średnia, poziom i wynik liczone przez system (kadry dziś wyłapują błędy rachunkowe ręcznie),
- dane poprzedniej oceny z historii, nie z pamięci oceniającego,
- rozmowa oceniająca przed sporządzeniem oceny,
- forma zapoznania: wyrok SO Łódź VIII Pa 416/24 uznał, że samo powiadomienie w EZD nie spełnia wymogu § 12. Potrzebny podpis (odręczny na wydruku albo elektroniczny równoważny pisemnemu), zob. [../wymagania-i-kontekst.md](../wymagania-i-kontekst.md), sekcja 17,
- wydruk „najlepiej zgodny z wzorem z rozporządzenia” (przypadki użycia KPRM): PDF odwzorowujący układ arkusza, z częścią III drukowaną tylko gdy jest wniosek.

## 5. Gdzie są pliki

Wszystkie w `archive/` (poza kontekstem, w `.gitignore`):

| Co | Ścieżka |
|---|---|
| Wzory graficzne A, B, C (PDF, skany z rozporządzenia) | `archive/docs/sources/hackathon/raw/zasoby-kprm-mirror/extracted/4. Formularze ocen/schematy widoku formularza X oceny okresowej/wzór formularza oceny okresowej arkusz X.pdf` |
| Schematy pól KPRM (DOCX, oryginał) | tamże, `formularz oceny okresowej X - schemat pól formularza.docx` |
| Arkusz B w Excelu z formułami KPRM (listy rozwijane, średnia, poziom) | `.../4. Formularze ocen/8. Arkusz B-wersja zautomatyzowana.xlsx` |
| 13 wypełnionych przykładów (A, B, C, w tym 3 negatywne): dane testowe | `archive/docs/sources/hackathon/raw/zasoby-kprm-mirror/extracted/5. Przykładowe wypełnione formularze oceny/` |
| Edytowalne wzory DSC 2016 (DOCX, XLSX) i ich wersje tekstowe | `archive/docs/sources/sluzba-cywilna/raw/` i `.../text/arkusz-oceny-{A,B,C}-2016*.md` |
| Instrukcja Excela DSC (walidacje: duplikaty kryteriów, dwa X w wierszu, format daty) | `archive/docs/sources/sluzba-cywilna/text/arkusze-ocen-instrukcja-uzytkownika.txt` |
| Zasady liczenia terminów (przypadki testowe) | `archive/docs/sources/hackathon/raw/zasoby-kprm-mirror/extracted/6. Materiały dodatkowe/liczenie terminów.docx` |
| Przypadki użycia i warunki brzegowe KPRM, BPMN | `.../extracted/2. Przypadki użycia/`, `.../extracted/3. Schemat procesu/` |
| Dane maszynowe (kryteria, arkusze, skala, terminy) | [../legal/oceny-okresowe-dane.yaml](../legal/oceny-okresowe-dane.yaml) |

Uwaga: pakiet KPRM pochodzi z publicznego repozytorium innego uczestnika, nie z kanału oficjalnego. Warto porównać go z pakietem od mentorów.
