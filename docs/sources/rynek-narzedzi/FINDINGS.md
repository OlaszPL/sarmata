# Przegląd rynku: narzędzia do ocen i rozwoju pracowników z AI

Kontekst: Cyfrowy Asystent Ocen Okresowych dla służby cywilnej z modułem "wirtualny HR partner" ([general-info.md](../../general-info.md), sekcja 3). Ograniczenia projektu: AI nie zastępuje przełożonego w ocenie, AI nie wnioskuje o emocjach pracownika (AI Act art. 5 ust. 1 lit. f), ocena wydajności przez AI to system wysokiego ryzyka (AI Act, załącznik III pkt 4 lit. b).

Stan na 2026-11-21. Lista źródeł i braków: [INDEX.md](INDEX.md). Opisy produktów pochodzą głównie od producentów. Tam, gdzie piszę "deklaruje", nie ma niezależnej weryfikacji.

**Najważniejsza obserwacja:** polskie systemy (enova365, HRnest, Calamari, Sedlak & Sedlak) obsługują arkusz i obieg dokumentu albo nic. Żaden nie wspiera przełożonego w przygotowaniu rozmowy ani w pisaniu oceny. Luka jest dokładnie tam, gdzie projekt chce działać.

## 1. Funkcje per produkt

Legenda: **tak** (potwierdzone w źródle), **częściowo**, **b.d.** (brak danych, nie znaczy "nie ma"), **nie** (źródło wprost mówi, że brak).

| Produkt | AI pomoc w pisaniu | Szkic z dowodami | Wykrywanie bias | Agenda 1:1 | Notatki przełożonego | Sugestie rozwoju | Pulse, wellbeing | Docenianie | Twarde granice AI | URL |
|---|---|---|---|---|---|---|---|---|---|---|
| Lattice | tak (Writing Assist, Agent) | tak (Evidence-based Review Drafts) | częściowo | tak (wspólna agenda, Agent w 1:1) | tak (publiczne i prywatne) | tak | tak | tak (Praise) | AI nie wybiera oceny i nie wysyła | lattice.com/blog/introducing-evidence-based-review-drafts |
| Leapsome | tak (przeredagowanie notatek) | b.d. | deklaracja bez mechanizmu | tak | tak (transkrypcje) | b.d. | b.d. | tak | każda sugestia wymaga akceptacji | leapsome.com/blog/introducing-leapsome-ai-for-reviews |
| 15Five (Kona) | tak | częściowo | b.d. | tak (Kona notetaker i coach) | tak | tak (plany dla menedżerów) | tak (Manager Effectiveness) | tak | coaching tylko dla menedżera, pauza na żądanie | success.15five.com/hc/en-us/articles/50988761575195 |
| Culture Amp | tak (AI Coach) | częściowo | b.d. | tak (pytania, odgrywanie ról) | b.d. | b.d. | tak | tak | deklaracja: AI nie służy decyzjom kadrowym | cultureamp.com/company/legal/our-approach-to-ai |
| Workday (Peakon, Talent) | tak | częściowo | b.d. (Textio Lift) | tak (Talent Highlights) | b.d. | tak (AI development items) | tak (od 10 komentarzy) | b.d. | szkic do edycji | doc.workday.com |
| SAP SuccessFactors | tak | b.d. | tak (text analyzer) | b.d. | b.d. | b.d. | b.d. | b.d. | b.d. | sap.com |
| BambooHR | częściowo | b.d. | b.d. | b.d. | b.d. | tak (cele) | tak (eNPS) | b.d. | włącza admin | bamboohr.com/product-updates/ai-summarized-feedback |
| Betterworks | tak | b.d. | deklaracja "unbiased" | tak (talking points) | b.d. | tak | b.d. | b.d. | brak opisu ograniczeń | betterworks.com/magazine/ai-performance-management |
| Microsoft Viva | nie dotyczy ocen | nie | b.d. | częściowo | nie | nie | tak | b.d. | progi poufności | learn.microsoft.com/viva/glint/setup/copilot-managers |
| Personio | częściowo (panel przy pisaniu) | tak (tematy linkują do źródeł) | b.d. | b.d. | tak | b.d. | b.d. | b.d. | min. 3 źródła, bez samooceny | support.personio.de/hc/en-us/articles/30612613685789 |
| Calamari | sprzeczne sygnały ("coming soon") | b.d. | b.d. | tak | tak | b.d. | b.d. | b.d. | b.d. | calamari.io/performance/anonymous-reviews |
| enova365 | nie | nie | nie | nie | nie | częściowo (karta kompetencji) | nie | nie | nie dotyczy | enova.pl/blog/oceny-pracownicze-jak-usprawnic-proces-ich-wystawiania-z-erp/ |
| HRnest | brak modułu ocen | | | | | | | | | hrnest.pl |
| Sedlak & Sedlak | brak produktu do ocen, są badania postaw | | | | | | częściowo | | | badaniahr.sedlak.pl/monitoring-postaw-pracownikow |

### Szczegóły wybranych produktów

**Lattice** ([Evidence-based Review Drafts](https://lattice.com/blog/introducing-evidence-based-review-drafts), [AI update](https://lattice.com/trust/ai-update), [Writing Assist](https://lattice.com/blog/writing-assist-leverage-ai-to-deliver-high-quality-feedback-with-ease), [1:1](https://help.lattice.com/hc/en-us/articles/360059920054))
- Szkic oceny z danych w systemie (1:1, feedback, cele, wcześniejsze oceny). Przed generowaniem okno kontekstu ze źródłami, które recenzent może odznaczyć, i zakresem czasu.
- Wskaźnik pewności. Przy braku danych oznaczenie "Needs more context" zamiast ogólnika. Szkic wskazuje konkretne rekordy.
- Kontekst agenta ograniczony do uprawnień recenzenta. Agent nie wybiera ocen i nie wysyła ("No Auto-Ratings", "No Auto-Submit").
- Writing Assist: użytkownik pisze, klika "Assist", wstawia, zastępuje albo generuje ponownie. Producent: 70% akceptacji.
- 1:1: tematy dodają obie strony, prywatne notatki tylko dla autora, AI tworzy podsumowanie i action items.
- Prywatność: Lattice przestał usuwać PII przed wysłaniem do OpenAI. Deklaruje brak trenowania na danych.

**Leapsome** ([AI for reviews](https://www.leapsome.com/blog/introducing-leapsome-ai-for-reviews), [transkrypcje](https://help.leapsome.com/hc/en-us/articles/30845027133213-AI-powered-meeting-transcripts)): AI przeredagowuje notatki menedżera. "All Leapsome AI recommendations can be altered and must be approved by the user". Treści AI oznaczone. Bias tylko jako deklaracja.

**15Five, Kona** ([Kona](https://success.15five.com/hc/en-us/articles/50988761575195), [Manager Effectiveness](https://www.15five.com/blog/building-the-manager-effectiveness-indicator)): Kona jest widocznym uczestnikiem spotkania, "Kona pause" lub "Kona leave". Transkrypcje usuwane po 30 dniach, niedostępne dla HR i menedżerów. Coaching tylko dla menedżera, dotyczy jego zachowań (docenianie, rozliczalność), nie stanu pracownika.

**Culture Amp** ([zasady AI](https://www.cultureamp.com/company/legal/our-approach-to-ai), [AI Coach](https://www.cultureamp.com/platform/ai/coach), [Ratings Preview](https://support.cultureamp.com/en/articles/11710756-the-science-behind-ratings-preview)): AI Coach w poufnej przestrzeni (pytania, odgrywanie ról). Deklaruje, że AI nie służy ocenie wyników, choć szkicuje oceny. Sentyment komentarzy niewyłączalny. ISO/IEC 42001. Ratings Preview: reakcje "popieram, wstrzymuję się, mam pytania", niezgoda tylko z dowodem.

**Workday** ([development items](https://doc.workday.com/admin-guide/en-us/human-capital-management/talent/development-items/concept--ai-generated-development-items.html), [Peakon](https://doc.workday.com/peakon/en-us/workday-peakon-employee-voice/insights/comments/concept--ai-comment-summarization.html)): działanie rozwojowe z 1 do 3 umiejętności, wyjście o stałej strukturze (cel, umiejętności, kroki, rezultat), przyciski Insert, Replace, Regenerate, Discard, "Make More Challenging", "Make Easier". Peakon: podsumowania od 10 komentarzy, włączone domyślnie. "Sensitive comments" na liście słów z ryzykiem fałszywych alarmów.

**SAP SuccessFactors** (tylko z wyników wyszukiwania): "Improve My Feedback", "Generate Comments", text analyzer dla języka "biased, discriminatory, or harmful" (Joule Premium).

**Microsoft Viva** ([Glint](https://learn.microsoft.com/en-us/viva/glint/setup/copilot-managers), [Insights](https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/privacy-settings), [Pulse](https://support.microsoft.com/en-us/viva/pulse/copilot-in-viva-pulse/report-summarization-using-copilot-in-viva-pulse)): progi poufności, minimalna grupa 5 osób, podsumowanie Pulse tylko dla autora. Productivity Score (2020) wycofał dane per osoba po krytyce ([The Register](https://www.theregister.com/2020/12/01/productivity_score/)).

**Personio** ([AI summaries](https://support.personio.de/hc/en-us/articles/30612613685789-Set-up-AI-summaries)): podsumowanie z 12 miesięcy, min. 3 źródła, bez samooceny i bez ocen liczbowych, jawne wagi źródeł, widok tematyczny i chronologiczny. "Meant to support, not replace, the manager's judgment". Model: Anthropic.

**Calamari** ([anonymous reviews](https://www.calamari.io/performance/anonymous-reviews)): blok "Response visibility" przy każdym pytaniu pokazuje na żywo, kto przeczyta odpowiedź.

**enova365** ([blog](https://enova.pl/blog/oceny-pracownicze-jak-usprawnic-proces-ich-wystawiania-z-erp/)): arkusze w workflow ERP, karta kompetencji, bez AI.

**Textio Lift** ([ogłoszenie](https://textio.com/blog/announcing-textio-for-performance-feedback)): coach pisania sprawdzający trafność, konkretność, wykonalność i ukierunkowanie na rozwój. Kieruje od uwag o osobowości do uwag o pracy.

## 2. Badania i krytyka

### Bias w tekstach ocen
- **Correll, Simard (HBR 2016):** 57% kobiet dostało niekonkretną pochwałę wobec 43% mężczyzn. Zalecenie: jednolita struktura oceny z częścią rozwojową.
- **Textio 2022:** kobiety o 22% częściej dostają feedback o osobowości. Textio 2023: niska jakość feedbacku to o 63% większe ryzyko odejścia.
- **Behavioural Insights Team, RCT 2021, brytyjski sektor publiczny** (46 176 odpowiedzi 360): kobiety dostawały konkretniejszy feedback o mocnych stronach i mniej konkretny o rozwoju. Płeć dało się przewidzieć z języka modelem ML, choć słowniki tego nie wychwyciły. Zmiana instrukcji w formularzu nie zmniejszyła bias. Zalecenie: oceniać efekty, nie wkład typu godziny. Kopia: `raw/bit-gender-bias-performance-feedback-rct-2021.txt`.
- **LLM powiela stereotypy:** Wan i in. (EMNLP Findings 2023), eksperyment Textio z ChatGPT ("the feedback written by ChatGPT just isn't that helpful").

### Skuteczność AI w pisaniu
- Dane producentów bez weryfikacji: Lattice 70% akceptacji, BCG 40% krótsze pisanie, SAP 65% mniej czasu na bias.
- **Frontiers in Psychology 2026** (192 osoby): tekst ujawniony jako AI oceniany gorzej (gotowość do poprawy 6,02 wobec 4,43, relacja 4,69 wobec 3,23 w skali 7). Tekst człowieka poprawiony przez AI odbierany jak ludzki.
- **IZA DP 18371:** LLM oceniający pojedynczo powtarza łagodność i tendencję centralną.
- **JPMorgan 2025:** AI może szkicować, nie może przypisywać ocen ani wpływać na wynagrodzenie.

### Homogenizacja
- **Doshi, Hauser (Science Advances 2024):** pomysły z AI podnoszą jakość pojedynczego tekstu, ale teksty stają się podobne. Dla urzędu: oceny z jednego modelu będą brzmiały tak samo.

### Monitoring i profilowanie
- **H&M, 35,3 mln EUR (Hamburg 2020):** notatki z rozmów po nieobecnościach (diagnozy, religia, rodzina), dostęp do 50 menedżerów. Ostrzeżenie dla notatek z 24 miesięcy i obsługi długich nieobecności.
- **Amazon France Logistique, CNIL 32 mln EUR (2024):** wskaźniki bezczynności per osoba.
- **Microsoft Productivity Score (2020):** wycofanie danych indywidualnych.
- **Predykcja wypalenia i odejścia:** fałszywe alarmy, wstrzymywanie rozwoju osobom oznaczonym (SHRM), brak pewnego pojedynczego wskaźnika (przegląd 2025).
- **AI Act art. 5 ust. 1 lit. f:** zakaz dotyczy wnioskowania o emocjach na podstawie danych biometrycznych (art. 3 pkt 39, wytyczne KE). Sentyment samego tekstu nie jest wprost objęty, ale projekt przyjmuje szerszą granicę.

## 3. Wzorce UX dla przełożonych

- **Przygotowanie rozmowy:** prywatna przestrzeń (cel, pytania, odgrywanie trudnej rozmowy, wiadomość po rozmowie). Tematy z danych (cele, feedback, otwarte action items). Coaching menedżera po rozmowie. Mapowanie: trzy szablony dla rozmowy rozpoczynającej, oceniającej i bieżącej informacji zwrotnej.
- **Agenda 1:1:** obie strony dodają tematy, action items przechodzą na kolejne spotkanie, treści AI oznaczone. W administracji „prywatna” notatka i tak podlega prawu dostępu (RODO art. 15), lepiej nazwać ją „roboczą” i opisać, kiedy pracownik ją zobaczy.
- **Evidence log:** szkic cytuje zapisy, wybór źródeł i zakresu czasu, uczciwy brak danych, jawne wagi, widok chronologiczny przeciw efektowi świeżości.
- **Brag document (Julia Evans):** lista osiągnięć pracownika, pomaga przy zmianie przełożonego, rytm co 2 tygodnie albo co 6 miesięcy.
- **Kalibracja:** w przepisach SC jej nie ma. Odpowiednik: przegląd spójności ocen przez kadry i DG na danych zagregowanych, bez zmiany oceny przez nikogo poza oceniającym.

## 4. Pomysły do przeniesienia i czego unikać

### Przenieść
1. **Szkic z cytowaniem notatek.** Każde zdanie linkuje do notatki, zdanie bez źródła oznaczone (Lattice, Personio).
2. **"Za mało danych" zamiast ogólników.** Kryterium bez notatek: propozycja pytania do rozmowy, nie tekst.
3. **Okno kontekstu** z wyborem źródeł i zakresu, nigdy ponad uprawnienia użytkownika.
4. **Twarde granice w UI:** AI nie ustawia poziomu, nie wypełnia skal, nie podpisuje, nie wysyła.
5. **Najpierw przełożony, potem AI** (Frontiers 2026).
6. **Kontrola jakości treści zamiast listy złych słów:** przykład, skutek, następny krok, praca a nie osobowość, równie konkretna część rozwojowa (Textio Lift, BIT 2021).
7. **Strażnik danych wrażliwych w notatkach** (RODO art. 9, lekcja H&M). Przy nieobecnościach zapisujemy fakt i wpływ na zadania, bez przyczyny.
8. **Blok "kto to zobaczy"** przy każdej notatce i polu (Calamari).
9. **Wspólna agenda rozmowy** z action items przechodzącymi dalej.
10. **Dziennik osiągnięć pracownika** jako wejście do samooceny i pakiet przy zmianie oceniającego.
11. **Generator działań rozwojowych o stałej strukturze** (cel, kroki, forma, efekt) z przyciskami wstaw, zastąp, odrzuć, łatwiej, trudniej (Workday).
12. **Coaching przełożonego, nie diagnoza pracownika** (np. brak docenienia od 8 tygodni, brak rozmowy od 6 miesięcy, zmiana zakresu bez rozmowy).
13. **Sygnały obciążenia ze struktury pracy, podane jako pytania**, bez etykiety "ryzyko wypalenia".
14. **Progi anonimowości ankiet zespołowych** (min. 5 osób, podsumowanie tylko dla autora).
15. **Przegląd spójności ocen dla kadr** na agregatach, decyzja zostaje u oceniającego.

Uzupełniająco: oznaczanie treści AI, ocena kciukiem, dziennik użycia AI per ocena (który fragment był sugestią i czy go zmieniono) jako wsparcie nadzoru ludzkiego z AI Act.

### Unikać
1. Gotowych ocen z jednego kliknięcia.
2. "Detektora bias" na liście słów sprzedawanego jako gwarancja.
3. Teczek cieni (notatki bez minimalizacji, dane o zdrowiu i życiu prywatnym).
4. Metryk aktywności per osoba (maile, logowania, czas w EZD).
5. Analizy emocji i sentymentu pracownika, w tym wbudowanej w komponenty dostawców.
6. Indywidualnych wskaźników "ryzyka wypalenia" lub "ryzyka odejścia".
7. Sprzeczności między deklarowanym przeznaczeniem a funkcjami (AI Act wymaga precyzyjnego przeznaczenia).
8. Niejawnych przepływów do zewnętrznego modelu. Dla administracji: model w infrastrukturze krajowej lub UE, DPIA, brak trenowania, jawna lista podprocesorów.
9. Funkcji AI włączonych domyślnie bez decyzji administratora i informacji dla pracowników.
10. Pokazywania propozycji poziomu oceny (kotwiczenie, łagodność LLM).

## 5. Otwarte pytania

- Czy asystent poprawiający tekst przełożonego mieści się w art. 6 ust. 3 lit. b AI Act, skoro szkic z dziennika obserwacji jest bliski profilowaniu?
- Kiedy i jak pokazać pracownikowi notatki przełożonego, żeby nie powstała teczka cieni i nie zniechęcić do notowania?
- Czy dane o realizacji zadań z EZD są potrzebne, czy wystarczą notatki przełożonego i dziennik pracownika?
