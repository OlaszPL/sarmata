# Źródła: mapa folderów

Każdy folder ma `FINDINGS.md` (notatki merytoryczne ze źródłem przy każdym fakcie) i zwykle `INDEX.md` (lista pobranych plików z URL i sekcja „Nie udało się pobrać”). Pobrane oryginały (`raw/`) i wersje tekstowe (`text/`) przeniesiono do `archive/docs/sources/<folder>/` w katalogu głównym repo (w `.gitignore`, bez duplikatów, mapa usuniętych kopii w `archive/DUPLIKATY.tsv`). Ścieżki `raw/...` i `text/...` w plikach INDEX i FINDINGS czytaj względem tego miejsca.

Dokument zbiorczy: [../wymagania-i-kontekst.md](../wymagania-i-kontekst.md). Akty prawne: [../legal/](../legal/).

| Folder | Zakres |
|---|---|
| [sluzba-cywilna/](sluzba-cywilna/) | gov.pl/web/sluzbacywilna, dsc.kprm.gov.pl, KSAP: poradniki o ocenach, wzory arkuszy, FAQ i wyjaśnienia DSC, standardy ZZL, IPRZ |
| [../legal/NOTES-zarzadzenie-nowelizacja-strategia.md](../legal/NOTES-zarzadzenie-nowelizacja-strategia.md) | zarządzenie nr 6 Szefa SC (standardy ZZL), procedowana nowelizacja ustawy o SC, Strategia ZZL 2034, inne wytyczne Szefa SC |
| [sprawozdania-szefa-sc/](sprawozdania-szefa-sc/) | roczne sprawozdania Szefa SC 2016 do 2025, statystyki ocen, szkoleń, stopni, kadr (z CSV) |
| [orzecznictwo-uodo-ai/](orzecznictwo-uodo-ai/) | orzecznictwo o ocenach okresowych, UODO i EDPB, wytyczne KE do AI Act, zalecenia dot. AI w administracji |
| [praktyka-urzedow/](praktyka-urzedow/) | wewnętrzne zarządzenia urzędów o ocenach i IPRZ, formularze pomocnicze, raporty NIK, istniejące narzędzia |
| [it-administracji/](it-administracji/) | EZD RP, podpisy i tożsamość, infrastruktura państwa, open source, polskie modele AI (PLLuM, Bielik), systemy kadrowe |
| [hr-metodyka/](hr-metodyka/) | informacja zwrotna, błędy oceniania, pytania do rozmów per kryterium, rozwój, wypalenie i dobrostan, docenianie |
| [szkolenia-katalog/](szkolenia-katalog/) | plany szkoleń centralnych, KSAP, e-learning, otwarte zasoby, katalog per kryterium (z CSV) |
| [ai-lokalne/](ai-lokalne/) | runtime LLM (llama.cpp i alternatywy, backendy GPU), rodzina Bielik i Bielik-One, progi sprzętowe |
| [hackathon/](hackathon/) | strona i regulamin hackathonu, zasoby organizatora, poprzednie edycje |
| [benchmarki-zagraniczne/](benchmarki-zagraniczne/) | OECD, UK, Kanada, Australia, Estonia, Niemcy, Francja, Irlandia, Singapur, USA, Holandia |
| [rynek-narzedzi/](rynek-narzedzi/) | Lattice, Leapsome, 15Five, Culture Amp, Workday, SAP, Viva i polskie narzędzia, pułapki AI w ocenach |
| [interesariusze/](interesariusze/) | uwagi z konsultacji nowelizacji, Rada SC, związki zawodowe, RPO, media |
| [ux-standardy/](ux-standardy/) | standardy projektowania usług publicznych, gov.pl design system, prosty język, dostępność, dostępne PDF |
| [../analiza/proces-i-przypadki-uzycia.md](../analiza/proces-i-przypadki-uzycia.md) | model stanów, proces z rolami, przypadki użycia i brzegowe odtworzone z przepisów |
