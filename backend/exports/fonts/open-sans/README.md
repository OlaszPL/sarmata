# Open Sans

Krój dokumentów PDF i DOCX (wybór użytkownika). Licencja SIL Open Font License 1.1, tekst w `OFL.txt`.

## Źródło

Repozytorium `google/fonts`, katalog `ofl/opensans`, commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`. Repozytorium zawiera tylko czcionki zmienne (`OpenSans[wdth,wght].ttf` i `OpenSans-Italic[wdth,wght].ttf`). Kompilator Typst nie stosuje osi wagi, więc pogrubienie by znikało. Dlatego pliki w tym katalogu to statyczne instancje wycięte z tych czcionek (`wdth=100`, `wght=400` i `700`) przez `fontTools.varLib.instancer` z opcją `updateFontNames`:

- `OpenSans-Regular.ttf`, `OpenSans-Bold.ttf`
- `OpenSans-Italic.ttf`, `OpenSans-BoldItalic.ttf`

Szablony używają tylko tych czterech wariantów (`strong`, `emph`, kolor czerwony szkicu to też pogrubienie).

## Użycie

- Nazwę kroju trzyma stała `PDF_FONT_FAMILY` w `backend/exports/src/pdf/font.ts`.
- Kompilator Typst ładuje ten katalog rekurencyjnie. Nie da się u niego wyłączyć czcionek systemowych i wbudowanych, służą tylko jako zapasowe dla glifów spoza Open Sans.
- Build standalone Next.js dostaje pliki przez `outputFileTracingIncludes` w `frontend/web/next.config.mjs`, a obraz Docker kopiuje ten build.
- DOCX zapisuje tylko nazwę `Open Sans`, bez osadzania plików. Na komputerze bez tego kroju Word zastąpi go czcionką zapasową, układ może się nieznacznie różnić. PDF zawsze osadza krój.
