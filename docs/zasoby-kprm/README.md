# Zasoby KPRM do wyzwania „Cyfrowy Asystent Ocen Okresowych”

Pakiet z sekcji 7 treści wyzwania (`docs/general-info.md`): akty prawne, przypadki użycia, schemat procesu (BPMN), formularze ocen ze schematami pól, 13 wypełnionych przykładów, materiały dodatkowe (liczenie terminów, poradnik).

Pochodzenie: oficjalny pakiet od organizatorów KPRM, otrzymany 21.11.2026. Wcześniej był tu nieoficjalny odpowiednik z publicznego repozytorium innego uczestnika (github.com/Ch3shireDev/hacknation-2026, commit `5162722ac483939c986ff264db449ead485acf58`). Porównanie sum SHA-1: wszystkie pliki są bajtowo identyczne poza trzema. BPMN (`.xpdl`, `extended attributes.xml`) różni się tylko końcami linii (CRLF). Wyciąg z ustawy różni się treścią (niżej). Doszedł `Poradnik - oceny okresowe w służbie cywilnej.pdf`, identyczny z poradnikiem DSC 2016 w `archive/docs/sources/sluzba-cywilna/raw/`. Pominięto pliki systemowe (`Thumbs.db`, pliki blokady Worda `~$...docx`). Sumy archiwów kopii nieoficjalnej: `docs/sources/hackathon/INDEX.md`.

Aktualizacja 21.11.2026 (druga paczka od organizatorów, folder „aktualne”): wyciąg z ustawy (`1. Akty prawne/2. Ustawa o służbie cywilnej - wyciąg przepisów.docx`) został wymieniony na poprawiony. Teraz art. 81 ust. 2 i art. 83 ust. 2 są „(uchylony)”, a art. 82 i 83 mówią o ocenianym zamiast o członku korpusu, czyli zgodnie z tekstem jednolitym Dz.U. 2026 poz. 590 (`docs/legal/ustawa-o-sluzbie-cywilnej-tj-2026.md`). Poprzednia rozbieżność (brzmienie sprzed 2016 r.) jest wyjaśniona. Pozostałe pliki tej paczki oraz PDF-y opisu i regulaminu zadania są bajtowo identyczne z już posiadanymi.

Najważniejsze dla budowy aplikacji:

- `4. Formularze ocen/`: wzory A, B, C (PDF), schematy pól (DOCX, wersje Markdown w `docs/analiza/schematy-pol-kprm/`), arkusz B w Excelu z formułami,
- `5. Przykładowe wypełnione formularze oceny/`: 13 arkuszy, w tym 4 oceny negatywne (EX-4, EX-7, EX-9, EX-12), jako dane testowe,
- `6. Materiały dodatkowe/liczenie terminów.docx`: przypadki testowe dla kalendarza ocen,
- `2. Przypadki użycia/` i `3. Schemat procesu/`: use cases, warunki brzegowe, BPMN.

Specyfikacja ekranów oparta na tych plikach: `docs/analiza/formularze-arkuszy-A-B-C.md`.
