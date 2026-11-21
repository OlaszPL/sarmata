# Źródła: standardy UX, dostępność i dokumenty PDF

Pobrano: 2026-11-21. Katalog `raw/` zawiera oryginalne pliki (HTML, PDF, DOCX, ODT, JSON). Katalog `text/` zawiera wersje tekstowe z nagłówkiem `URL:` i datą pobrania. Analiza i rekomendacje są w [FINDINGS.md](FINDINGS.md).

Strony renderowane w JavaScript (Gov UI, ISO, pdfa.org, W3C, veraPDF) pobrano przez przeglądarkę Playwright. Ich surowy zapis to zbiorcze pliki JSON: `raw/govui-styleguide-render.json` i `raw/pdf-standardy-render.json`.

## 1. Gov.pl Design System (Przewodnik Gov UI, KPRM)

| Plik w `text/` | Źródło |
|---|---|
| govui-przewodnik | https://aplikacje.gov.pl/app/govpl-front-styleguide/ (strona główna, wersja 1.0 beta) |
| govui-jak-otrzymac-biblioteke | .../dokumentacja/jak-otrzymac-biblioteke (biblioteka SCSS na prośbę mailową) |
| govui-wytyczne-kolory, -typografia, -odstepy, -grid, -ikony | .../dokumentacja/wytyczne/... |
| govui-wytyczne-jezyk-i-tresc | .../dokumentacja/wytyczne/jezyk-i-tresc (rekomendacje językowe redakcji Portalu RP) |
| govui-wytyczne-dostepnosc-cyfrowa | .../dokumentacja/wytyczne/dostepnosc-cyfrowa |
| govui-komponenty-* (17 plików) | .../dokumentacja/komponenty/... (button, input, textarea, radio, checkbox, alert, select, datepicker, stepper, breadcrumbs, accordion, ramki, loadery, uploader, anchors) |
| govui-struktury-* (4 pliki) | .../dokumentacja/struktury/... (górna belka, stopka, menu boczne, tab menu) |
| opensans-ofl | https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OFL.txt (aktualna licencja fontu Open Sans) |

## 2. Zasady usług cyfrowych i mObywatel

| Plik | Źródło |
|---|---|
| mc-metareguly-2016 (.odt) | https://www.gov.pl/attachment/fa502e29-fbe4-48c2-b584-3724377631fe ("Metareguły i zasady budowy cyfrowych usług publicznych", MC, X 2016) |
| mc-kod-zrodlowy-mobywatel | https://www.gov.pl/web/cyfryzacja/kod-zrodlowy-aplikacji-mobywatel (BIP MC, 05.02.2026) |
| mc-opublikowalo-kod-mobywatela | https://www.gov.pl/web/cyfryzacja/ministerstwo-cyfryzacji-opublikowalo-kod-zrodlowy-mobywatela (29.12.2025) |
| instalki-kod-mobywatela-ui | https://www.instalki.pl/news/bezpieczenstwo/open-source-wedlug-ministerstwa-cyfryzacji-opublikowali-kod-mobywatela-ale-tylko-ui/ (prasa, licencja MIT, tryb tylko do odczytu) |
| android-kod-mobywatela | https://android.com.pl/tech/1005279-kod-zrodlowy-mobywatela-opublikowany/ (prasa) |

## 3. Prosty język

| Plik | Źródło |
|---|---|
| sc-zalecenie-prosty-jezyk | https://www.gov.pl/web/sluzbacywilna/zalecenie-szefa-sluzby-cywilnej-ws-prostego-jezyka |
| sc-zalecenie-prosty-jezyk-dostepna (.pdf) | https://www.gov.pl/attachment/d3566d11-1823-42ee-9a17-6d860b1ad172 (zalecenie Szefa SC, XII 2020, wersja dostępna, tagged PDF) |
| sc-prosty-jezyk | https://www.gov.pl/web/sluzbacywilna/prosty-jezyk |
| sc-prosty-jezyk-materialy | https://www.gov.pl/web/sluzbacywilna/prosty-jezyk-materialy |
| sc-gdzie-szukac-porad | https://www.gov.pl/web/sluzbacywilna/gdzie-szukac-porad-i-narzedzi |
| mc-prosty-jezyk | https://www.gov.pl/web/cyfryzacja/prosty-jezyk |
| dc-prosty-jezyk | https://www.gov.pl/web/dostepnosc-cyfrowa/prosty-jezyk |
| uw-prosty-jezyk-standard (.pdf) | https://www.uw.edu.pl/wp-content/uploads/2024/10/prosty-jezyk-%E2%80%93-standard.pdf ("Prosty język, ustandaryzowane zasady": Jasnopis, FJP, US, UAM, UW) |
| iso-24495-1 | https://www.iso.org/standard/78907.html (karta katalogowa ISO 24495-1:2023) |
| jasnopis | https://www.jasnopis.pl/ |
| logios | https://www.logios.pl/ (domena zaparkowana w dniu pobrania) |

## 4. Dostępność cyfrowa: prawo, wytyczne gov.pl, deklaracja dostępności

| Plik | Źródło |
|---|---|
| dc-home | https://www.gov.pl/web/dostepnosc-cyfrowa |
| dc-faq-podmioty | https://www.gov.pl/web/dostepnosc-cyfrowa/podmioty-publiczne (FAQ, m.in. intranet) |
| dc-wcag-na-skroty | https://www.gov.pl/web/baza-wiedzy/wcag-na-skroty |
| dc-formularze, dc-formularze-na-stronach | https://www.gov.pl/web/dostepnosc-cyfrowa/formularze oraz .../formularze-na-stronach-internetowych |
| dc-limity-czasowe, dc-kontrast, dc-tabele | .../limity-czasowe, .../kontrast-kolorow, .../tabele |
| dc-tresci-dostepne, dc-word-dostepne, dc-skany-dokumentow, dc-poradnik | .../tresci-dostepne-cyfrowo, .../jak-tworzyc-dostepne-dokumenty-tekstowe-w-edytorze-ms-word, .../czy-trzeba-publikowac-skany-dokumentow, .../poradnik |
| dc-deklaracja-dostepnosci | https://www.gov.pl/web/dostepnosc-cyfrowa/deklaracja-dostepnosci (żywa deklaracja MC, identyfikatory v2.0) |
| dc-deklaracja-dostepnosci2, dc-deklaracja-na-stronach | .../deklaracja-dostepnosci2, .../deklaracja-dostepnosci-na-stronach-internetowych |
| dd-govpl-deklaracja | https://www.gov.pl/web/gov/deklaracja-dostepnosci-serwisu-govpl |
| dd-warunki-techniczne-v1-2020 (.docx) | https://www.gov.pl/attachment/3cb8d677-3b5e-46a1-a32e-9acb3f4f002a (warunki techniczne deklaracji, wersja z 2020 r.) |
| pti-warunki-dd-v2-projekt-2024 (.docx) | https://pti.org.pl/wp-content/uploads/2024/08/001_Warunki-techniczne-Deklaracja-Dostepnosci%E2%80%94-uwagi_wersja_20240420_final.docx (projekt v2.0 z uwagami PTI) |
| mc-monitoring-dostepnosci-2022-2024 (.pdf) | https://www.gov.pl/attachment/03cf5310-2205-474b-9f0f-d0edd0f46bdf (raport MC z monitoringu) |
| mc-monitoring-dostepnosci-2024 (.docx) | https://www.gov.pl/attachment/fa369634-6411-49be-a203-9d9712068b01 (raport MC za 2024, II 2025) |
| etsi-en301549-v321 (.pdf) | https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf |
| etsi-en301549-v411 (.pdf) | https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf (V4.1.1, 2026-09) |
| ec-wad-standards | https://digital-strategy.ec.europa.eu/en/policies/web-accessibility-directive-standards-and-harmonisation |
| deque-en301549-v411 | https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/ (źródło wtórne, harmonogram cytowania w OJEU) |
| pfron-dostepne-dokumenty (.pdf) | https://bip.pfron.org.pl/fileadmin/Zamowienia/Zapytania_ofertowe/2024_rok/2024-03-18_Kwartalnik_2024/03_Zalacznik_nr_2A_Dostepne_dokumenty_w_PFRON.pdf |

Tekst ustawy o dostępności cyfrowej i rozporządzenia KRI 2024 jest już w repozytorium: `docs/legal/text/13-ustawa-dostepnosc-cyfrowa-tj-2023.txt` oraz `docs/legal/text/15-rozp-rm-krajowe-ramy-interoperacyjnosci-2024.txt`.

## 5. GOV.UK Design System i Service Manual

| Plik | Źródło |
|---|---|
| govuk-ds-home | https://design-system.service.gov.uk/ (stopka: treści na OGL v3.0, kod GOV.UK Frontend v6.6.0) |
| govuk-question-pages | https://design-system.service.gov.uk/patterns/question-pages/ |
| govuk-check-answers | https://design-system.service.gov.uk/patterns/check-answers/ |
| govuk-complete-multiple-tasks | https://design-system.service.gov.uk/patterns/complete-multiple-tasks/ (dawny wzorzec "task list") |
| govuk-task-list-component | https://design-system.service.gov.uk/components/task-list/ |
| govuk-summary-list | https://design-system.service.gov.uk/components/summary-list/ |
| govuk-confirmation-pages | https://design-system.service.gov.uk/patterns/confirmation-pages/ |
| govuk-validation, govuk-error-summary, govuk-error-message | .../patterns/validation/, .../components/error-summary/, .../components/error-message/ |
| govuk-textarea, govuk-character-count, govuk-radios, govuk-text-input, govuk-button | .../components/... |
| govuk-start-using, govuk-production | .../get-started/, .../get-started/production/ |
| govuk-service-manual-one-thing-per-page | https://www.gov.uk/service-manual/design/form-structure |
| govuk-service-manual-writing-forms | https://www.gov.uk/service-manual/design/designing-good-questions |
| govuk-sm-look-like-govuk | https://www.gov.uk/service-manual/design/making-your-service-look-like-govuk (zakaz korony, GDS Transport i kolorów GOV.UK poza GOV.UK) |
| govuk-frontend-license | https://raw.githubusercontent.com/alphagov/govuk-frontend/main/LICENSE.txt (MIT) |
| govuk-frontend-gh-api, govuk-frontend-releases-api (.json) | https://api.github.com/repos/alphagov/govuk-frontend (+ /releases) |

## 6. Dostępne PDF (PDF/UA, tagged PDF) i darmowe narzędzia

| Plik | Źródło |
|---|---|
| iso-14289-1, iso-14289-2 | https://www.iso.org/standard/64599.html, https://www.iso.org/standard/82278.html (karty katalogowe) |
| pdfa-matterhorn | https://pdfa.org/resource/the-matterhorn-protocol/ (Matterhorn Protocol 1.1) |
| pdfa-pdfua-2-announcement | https://pdfa.org/iso-14289-2-pdfua-2/ |
| w3c-wcag21-pdf-techniques | https://www.w3.org/WAI/WCAG21/Techniques/#pdf (techniki PDF1 do PDF23) |
| weasyprint-features, weasyprint-api-ref | https://doc.courtbouillon.org/weasyprint/stable/common_use_cases.html, .../api_reference.html |
| weasyprint-gh-api, weasyprint-releases-api (.json) | https://api.github.com/repos/Kozea/WeasyPrint (+ /releases) |
| typst-pdf-docs | https://typst.app/docs/reference/pdf/ |
| typst-gh-api, typst-releases-api (.json) | https://api.github.com/repos/typst/typst (+ /releases) |
| puppeteer-pdfoptions | https://pptr.dev/api/puppeteer.pdfoptions (Puppeteer 25.18.1) |
| playwright-page-pdf | https://playwright.dev/docs/api/class-page |
| libreoffice-pdf-export | https://help.libreoffice.org/latest/en-US/text/shared/01/ref_pdf_export_general.html |
| libreoffice-licenses | https://www.libreoffice.org/about-us/licenses/ (MPL 2.0) |
| puppeteer-license, playwright-license | https://raw.githubusercontent.com/puppeteer/puppeteer/main/LICENSE , https://raw.githubusercontent.com/microsoft/playwright/main/LICENSE (Apache 2.0) |
| verapdf-readme, verapdf-gh-api, verapdf-releases-api | https://raw.githubusercontent.com/veraPDF/veraPDF-library/integration/README.md, https://api.github.com/repos/veraPDF/veraPDF-library (+ /releases) |
| verapdf-home, verapdf-home-render | https://verapdf.org/, https://verapdf.org/software/ (komunikat o czasowym wyłączeniu serwisu) |
| pac-home | https://pac.pdf-accessibility.org/en (PAC 2026) |

## Nie udało się pobrać

| Co | URL | Powód |
|---|---|---|
| Galeria kodu i design systemu mObywatela | https://www.mobywatel.gov.pl/kod-zrodlowy-mobywatel-mobilny | Przekierowanie na login.gov.pl. Dostęp tylko po uwierzytelnieniu (profil zaufany, e-dowód, bank). Licencję MIT znamy wyłącznie ze źródeł prasowych. |
| Nieoficjalna kopia kodu mObywatela | https://codeberg.org/fajfer/mObywatel | HTTP 403 |
| Biblioteka SCSS Gov.pl Design System | brak publicznego URL | Udostępniana tylko na prośbę mailową (redakcja@cyfra.gov.pl). Brak publicznego repozytorium, pakietu npm, pliku Figma i deklaracji licencji. |
| Oficjalna biblioteka Figma gov.pl lub mObywatel | brak | Wyszukiwanie nie wskazało oficjalnego pliku Figma. |
| Strona Figma GOV.UK | https://design-system.service.gov.uk/get-started/design-in-figma/ | HTTP 404 (zgadnięty adres, nie szukano dalej) |
| Warunki techniczne deklaracji dostępności v2.0 (tekst ostateczny) | https://mc.bip.gov.pl/objasnienia-prawne/warunki-techniczne-publikacji-oraz-struktura-dokumentu-elektronicznego-deklaracji-dostepnosci.html | Przekierowanie na stronę główną gov.pl/web/bip (przywracanie systemu SSDIP). Zastępczo: projekt v2.0 z PTI oraz żywa deklaracja MC z identyfikatorami v2.0. |
| Pracownia Prostej Polszczyzny UWr | https://ppp.uni.wroc.pl/ | Wygasły certyfikat TLS, przez HTTP odpowiedź 404 |
| Logios | https://www.logios.pl/ | Domena zaparkowana (narzędzie polecane przez gov.pl jest niedostępne) |
| Pełne teksty ISO 24495-1, ISO 14289-1, ISO 14289-2 | iso.org | Normy płatne. Pobrano tylko karty katalogowe. PDF/UA-2 jest bezpłatny w PDF Association, ale nie pobierano (pdfa.org blokuje pobieranie skryptem). |
| Matterhorn Protocol 1.1 (PDF) | https://pdfa.org/wp-content/uploads/2021/04/Matterhorn-Protocol-1-1.pdf | HTTP 403 (pobrano tylko stronę opisową) |
| Podręcznik "Dostępność cyfrowa dokumentów" (US) | https://cwod.usz.edu.pl/files/pliki/IV%20Dost%C4%99pno%C5%9B%C4%87%20cyfrowa%20dokument%C3%B3w.pdf | HTTP 404 |
| Polska norma PN-ISO 24495-1 | sklep.pkn.pl | Wyszukiwarka PKN nie zwróciła wyniku. Nie potwierdzono polskiej wersji normy. |
| Nowszy (po 2016) rządowy "standard usług cyfrowych" | brak | Nie znaleziono dokumentu o takiej nazwie. Najbliższy odpowiednik to "Metareguły" MC z 2016 r. |
