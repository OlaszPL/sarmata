# Krajobraz IT administracji rządowej: ustalenia dla Cyfrowego Asystenta Ocen Okresowych

Stan wiedzy na 21.11.2026. Każdy fakt ma źródło (URL) i nazwę pliku lokalnego w `text/` lub `raw/` (zob. `INDEX.md`).
Oznaczenia wiarygodności:

- **[P]** źródło pierwotne (gov.pl, NASK, COI, Dz.U., M.P., karta modelu, publikacja autorów),
- **[W]** źródło wtórne (prasa branżowa, agregatory),
- **[S]** tylko streszczenie wyszukiwarki, strony nie udało się pobrać,
- **[O]** własny szacunek lub wniosek, niepotwierdzony źródłem.

---

## 1. EZD RP i inne systemy EZD

### 1.1. Czym jest EZD RP

- EZD RP to bezpłatny system klasy EZD rozwijany przez NASK, powstały w projekcie realizowanym z Wojewodą Podlaskim, oparty na doświadczeniach EZD PUW. Obsługuje korespondencję z klientami, z innymi podmiotami przez ePUAP oraz komunikację wewnętrzną. Integracja z systemami zewnętrznymi idzie przez API. [P] https://www.gov.pl/web/ezd-rp/o-ezd-rp (`ezdrp-o-ezd-rp`, b.d.)
- Definicja „systemu EZD” pochodzi z § 2 pkt 13 rozporządzenia PRM z 18.01.2011 w sprawie instrukcji kancelaryjnej (Dz.U. 2011 nr 14 poz. 67): system teleinformatyczny do wykonywania czynności kancelaryjnych, dokumentowania przebiegu spraw oraz gromadzenia i tworzenia dokumentów elektronicznych. [P] tamże oraz `../../legal/text/17-rozp-prm-instrukcja-kancelaryjna-2011.txt`
- **Licencja nie jest otwarta.** EZD RP jest udostępniane na licencji „freeware” NASK. Prawa autorskie ma NASK, wartość licencji to 1 zł na użytkownika, licencja zakazuje dekompilacji i inżynierii wstecznej (dozwolone jest tylko rozpowszechnianie kodu, który NASK sam ujawnił). Licencjodawca może wymagać rejestracji instalacji. [P] https://www.gov.pl/web/ezd-rp/licencja-ezd-rp (`ezdrp-licencja`, b.d.)

### 1.2. Skala wdrożeń

- 27.05.2026: 2000 produkcyjnych wdrożeń finansowanych z KPO od 09.2024, łącznie 2925 jednostek od 04.2022. Wśród wdrożeń są jednostki rządowe, samorządowe, szkoły, oddziały KRUS, Wody Polskie. [P] https://www.gov.pl/web/ezd-rp/2000-produkcyjnych-wdrozen-ezd-rp-dzieki-srodkom-z-kpo (`ezdrp-2000-wdrozen-kpo`)
- Rozliczenie projektu KPO (okres 01.09.2024 do 31.08.2026, wartość 214 517 601 zł): EZD uruchomiony produkcyjnie w 3050 podmiotach, 207 923 przeszkolonych uczestników, chmura SaaS2 EZD RP dla 300 000 pracowników. [P] https://www.gov.pl/web/ezd-rp/kpo (`ezdrp-kpo`)
- NASK, wrzesień 2026 (dane z czerwca 2026): ponad 6600 podmiotów wspieranych przez NASK w obszarze EZD, około 280 tys. użytkowników EZD PUW i około 220 tys. użytkowników EZD RP. NASK nazywa te systemy „naturalnym kanałem dystrybucji Asystenta Urzędniczego AI”. [P] https://www.gov.pl/attachment/71655d1d-eda3-41d7-adca-7937f87074ce (`att-71655d1d`)
- Dla porównania 12.03.2026: 5622 podmioty, około 124 tys. użytkowników EZD RP. [P] https://www.gov.pl/attachment/c739cf89-8532-4d0b-99d8-73231fc5904f (`att-c739cf89`, 18.03.2026)
- Badanie MC i COI (2026, 604 jednostki, w tym 76% gmin, 1,7% ministerstw, 5,3% jednostek podległych ministerstwom). Wiodący system EZD (N=439): pozostałe 20,5%, EZD PUW 17,5%, SIDAS EZD/mADKOM 14,4%, Nefeni EZD Proton 11,6%, Edicta 9,1%, EZD RP 8,2%, ZETO eKancelaria 7,7%, FINN EZD 5,9%, e-Instytucja 5,0%. W obszarze „obieg dokumentów” 20,2% jednostek odpowiedziało „nie dotyczy”. Próba jest zdominowana przez gminy, więc nie opisuje administracji rządowej wprost. [P] https://www.gov.pl/attachment/257ade16-d8d2-4f48-a4db-5309be07380a (`mc-coi-badanie-open-source-2026`)

### 1.3. Obowiązek stosowania systemu klasy EZD

- MC 14.07.2025 i 08.12.2025: od 1.01.2028 system klasy EZD ma być obowiązkowy dla administracji publicznej. [P] `mc-ezdrp-era-bez-papieru`, `mc-ezd-fundament-cyfryzacji`
- NASK 18.03.2026 podkreśla: „Obowiązek EZD (nie EZD RP!!!) od 1 stycznia 2028 r. (ustawa o EZD)”. Plan: SaaS EZD RP dla około 650 tys. użytkowników do 2029, standaryzacja wymagań dla systemów klasy EZD i ujednolicona instrukcja kancelaryjna (z NDAP), migracja z EZD PUW, wstrzymanie rozwoju EZD PUW w 2Q.2029, koniec wsparcia serwisowego EZD PUW 31.03.2031. [P] `att-c739cf89`
- Prawo.pl (przedruk PAP): MC potwierdza, że obowiązek nie wejdzie 1.01.2028, najwcześniej rok później. Daty publikacji nie ustalono. [S] https://www.pap.pl/mediaroom/prawopl-obowiazkowe-elektroniczne-zarzadzanie-dokumentacja-moze-wystartowac-dopiero-po
- Część firm IT (Stowarzyszenie STODAP) zarzuca projektowi EZD RP monopolizację rynku i zapowiada skargę do KE o niedozwoloną pomoc publiczną. [W] https://itwiz.pl/polskie-firmy-it-protestuja-przeciwko-obecnemu-modelowi-cyfryzacji-administracji-samorzadowej/ (`itwiz-firmy-protestuja`, 21.11.2025)

**Wniosek:** urzędy będą miały „jakiś” system klasy EZD, ale nie wszystkie EZD RP. Integracja musi obsługiwać EZD RP natywnie i resztę przez format neutralny.

### 1.4. Model wdrożenia EZD RP (wzorzec dla nas)

- Dwie ścieżki: SaaS EZD RP w chmurze rządowej (bez kosztów dla podmiotów publicznych) albo instalacja on-premise. MC 14.07.2025: „Jednostki publiczne nie ponoszą żadnych kosztów wdrożenia ani utrzymania”. [P] `mc-ezdrp-era-bez-papieru`
- Wymagania on-premise (31.01.2026): maszyny wirtualne i Kubernetes (rekomendowana dystrybucja RKE2, system Ubuntu), relacyjna baza zgodna z PostgreSQL lub MS SQL, Redis i RabbitMQ, składowanie plików NFS lub S3 (np. MinIO), DNS, certyfikat wildcard, SMTP. EZD RP deklaruje neutralność wobec systemu operacyjnego i dystrybucji Kubernetes. Środowisko testowe: 24 vCPU, 64 GB RAM, 2 TB dysku. Produkcja: 1000 jednocześnie pracujących osób to 42 vCPU i 90 GB RAM, 10 000 osób to 120 vCPU i 196 GB RAM. Dla 1000 użytkowników repozytorium plików rośnie o 6,7 GB tygodniowo. [P] https://www.gov.pl/web/ezd-rp/wymagania-sprzetowe-i-programowe (`ezdrp-wymagania-sprzetowe-programowe`)
- Projekt FERC (01.04.2025 do 01.11.2029, 275 578 000 zł): Platforma EZD RP low-code (moduły automatyzacji, formularzy, repozytoriów, integracji, analiz, Asystenta AI, Automatyzacji AI), usługa A2A, kolejne 300 tys. użytkowników SaaS. Harmonogram: 2026 do 2027 budowa, 2028 beta-testy z partnerami, 2029 uruchomienie produkcyjne. Pryncypium „Neutralność i otwartość, stosowanie otwartych standardów”. [P] `att-c739cf89`, https://www.gov.pl/attachment/1994072b-861f-4a8d-afb5-d16f87f5fcd1 (`att-1994072b`)

**Wniosek [O]:** nawet flagowy system państwowy wymaga Kubernetesa przy instalacji lokalnej, a małe jednostki wybierają SaaS. Nasze narzędzie musi być wyraźnie lżejsze niż EZD RP albo dostępne centralnie.

### 1.5. API EZD RP

- REST API, wersja v2. Dokumentacja publiczna w Swaggerze na środowisku demo (https://integrator-api.demo.ezdrp.gov.pl/swagger/index.html). Środowisko demo nie pozwala generować kluczy ani wywoływać metod. 21.11.2026 adres zwracał stronę „Technical Break”, więc specyfikacji OpenAPI nie pobrano. [P] https://www.gov.pl/web/ezd-rp/piaskownica-api (`ezdrp-piaskownica-api`)
- Uwierzytelnienie: klucz API generuje w EZD RP użytkownik z uprawnieniem `Administracja.KluczeApi` na poziomie „Instytucja”, wskazując użytkownika technicznego. Wywołania wymagają tokenu z SSO dla użytkownika z przypisanym ApiKey oraz nagłówka `SID` (identyfikator stanowiska). [P] `ezdrp-podrecznik-uwierzytelnianie`, `ezdrp-podrecznik-subskrypcje`
- Przykładowe metody: `POST /ezdrp/integrator/v2/dokumenty/_search`, `POST /ezdrp/integrator/v2/dokumenty/{idDokumentPrzestrzeni}/rpw`, zakładanie sprawy, dodawanie zadania typu dokument, dodawanie adresata, porządkowanie akt. [P] `ezdrp-podrecznik-integracja`, `ezdrp-podrecznik-dodawanie-dokumentu-rpw`, `ezdrp-podrecznik-zakladanie-sprawy`
- Webhooki: `POST /ezdrp/integrator/v2/subskrypcje` z listą zdarzeń, adresem URL odbiorcy i adresem e-mail na błędy. Kanał dostawy: tylko HTTP. Cztery próby wysyłki, potem dezaktywacja (odblokowanie `PATCH /ezdrp/integrator/v2/odbiorcy/aktywuj`). Zdarzenia istotne dla nas: `ezdrp.v2.dokument.akceptacja.zaakceptowano/odrzucono/anulowano`, `ezdrp.v2.dokument.podpis.zlozono/odrzucono/anulowano`, `ezdrp.v2.zadanie.zakonczono`, `ezdrp.v2.rpw.sprawa.utworzono`. [P] https://podrecznik.ezdrp.gov.pl/subskrypcje-zdarzen-w-ezd-rp/ (`ezdrp-podrecznik-subskrypcje`)
- Piaskownica API: dostęp bezpłatny po wniosku, osobna instancja z kontami testowymi, dostęp sieciowy przez whitelistę lub IPsec, wsparcie integracja-ezdrp@nask.pl w dni robocze 8:00 do 16:00. Regulamin z 18.08.2022. Ponad 131 podmiotów w piaskownicy, 123 zgłoszone integracje, w tym 3 kadrowo-płacowe. NASK zastrzega: „EZD RP jako system jednolity … nie zastąpi systemów dziedzinowych”. [P] `ezdrp-regulamin-piaskownicy`, https://www.gov.pl/attachment/452c46ff-b92f-49b7-a94b-459ad0e019aa (`att-452c46ff`)
- Lista oficjalnie zintegrowanego oprogramowania obejmuje głównie skanowanie, obsługę spraw dziedzinowych i automatyzację (np. WEBCON przez PCG Academia, docuRob). NASK zaznacza, że lista ma charakter informacyjny. [P] `ezdrp-oprogramowanie-zintegrowane`

### 1.6. AI w EZD RP (ryzyko nakładania się i szansa na integrację)

- NASK, 09.2026: „Asystent Urzędniczy AI” ma być zestawem kontrolowanych funkcji, zintegrowanym z EZD RP „i innymi systemami klasy EZD”, przetwarzającym dane na infrastrukturze rządowej. Pierwsze umiejętności: streszczanie dokumentów, porównywanie wersji, asystent prawny, anonimizator, asystent pism. Hasło: „AI rekomenduje. Urzędnik decyduje. System dokumentuje.” Modele dostarcza AI Hub (PLLuM). [P] `att-71655d1d`
- MC 08.12.2025: moduły AI oparte na PLLuM mają trafić do EZD RP, testy dla zaproszonych użytkowników w 1Q.2026. [P] `mc-ezd-fundament-cyfryzacji`

### 1.7. Metadane, instrukcja kancelaryjna, KRI

- Instrukcja kancelaryjna: zestawy metadanych określa załącznik nr 1, część A (przesyłka wpływająca), B (przesyłka wychodząca), C (pisma), D (sprawa). Tabele załącznika w PDF są obrazami, nie zostały wyciągnięte do tekstu. § 32 ust. 1: akceptacja projektów pism odbywa się wyłącznie w systemie EZD (w jednostkach, gdzie EZD jest podstawowym sposobem dokumentowania). [P] `../../legal/text/17-rozp-prm-instrukcja-kancelaryjna-2011.txt`
- KRI (Dz.U. 2024 poz. 773): kodowanie UTF-8 (§ 17), udostępnianie zasobów w co najmniej jednym formacie z załącznika nr 2 (§ 18). Załącznik nr 2 wymienia m.in. .txt, .rtf, .pdf, .odt, .ods, .docx, .xlsx, .csv (RFC 4180), .xml, .xsd, a dla podpisu XAdES, PAdES, CAdES, ASiC (ETSI). Standardy IETF i W3C tam, gdzie brak norm krajowych (§ 16). Zarządzanie usługą według PN-ISO/IEC 20000 (§ 15), system zarządzania bezpieczeństwem informacji (§ 19), rozliczalność przez logi, obowiązkowo dostęp z uprawnieniami administracyjnymi i do konfiguracji (§ 20). [P] `../../legal/text/15-rozp-rm-krajowe-ramy-interoperacyjnosci-2024.txt`

### 1.8. ePUAP i e-Doręczenia

- Projekt nowelizacji ustawy o doręczeniach elektronicznych: JST od 1.01.2028 tracą możliwość korespondencji z podmiotami publicznymi przez ePUAP. Projekt wymaga też współpracy systemów klasy EZD z centralnym systemem doręczeń. [W] https://www.prawo.pl/samorzad/e-doreczenia-w-samorzadach-szybciej-niz-planowano-epuap-tylko-do-2028-r,1548946.html (`prawopl-epuap-2028`, 21.07.2026)
- MC planuje wyłączenie ePUAP i e-Doręczenia jako podstawowy kanał. [P] `att-c15ad801`

Dla oceny okresowej (dokument wewnętrzny pracodawcy) ePUAP i e-Doręczenia nie są potrzebne. [O]

---

## 2. Podpisy i tożsamość

### 2.1. Rodzaje podpisów i ich skutki

- **Podpis zaufany (PZ):** „Dane w postaci elektronicznej opatrzone podpisem zaufanym są równoważne pod względem skutków prawnych dokumentowi opatrzonemu podpisem własnoręcznym, chyba że przepisy odrębne stanowią inaczej” (art. 20ae ust. 2 ustawy o informatyzacji). Bezpłatny. [P] `../../legal/text/14-ustawa-o-informatyzacji-tj-2026.txt`
  - PZ zawiera imię, nazwisko, **numer PESEL**, identyfikator środka identyfikacji i czas złożenia. [P] `att-1d4a4f91`
  - **Wniosek:** pracownik może prawnie skutecznie podpisać arkusz oceny PZ, bo przepisy o ocenach mówią tylko o „podpisie”. Wada: PESEL podpisującego trafia do pliku. [O]
- **Podpis osobisty (e-dowód):** zaawansowany podpis z certyfikatem w e-dowodzie (imię, nazwisko, obywatelstwo, PESEL). W kontaktach z administracją równoważny odręcznemu, z innymi podmiotami tylko po wzajemnym uzgodnieniu. Usługa „Podpisz dokument” w mObywatelu działa od 25.02.2025: plik PDF do 10 MB, NFC, PIN2. [P] `att-1d4a4f91`, https://www.gov.pl/web/cyfryzacja/podpisz-dokument-w-aplikacji-mobywatel--szybko-bezpiecznie-cyfrowo (`mc-podpisz-dokument-mobywatel`, 11.03.2025)
  - Otwarte pytanie: czy relacja pracownik i urząd jako pracodawca to „kontakt z administracją publiczną”. Nie znaleziono rozstrzygnięcia. [O]
- **Podpis kwalifikowany:** równoważny własnoręcznemu (art. 25 ust. 2 eIDAS). Certyfikaty są płatne u dostawców usług zaufania (np. KIR Szafir/mSzafir, Asseco SimplySign, Enigma Cencert, PWPW Sigillum). [P] `kir-szafir`, `mbank-mszafir`
  - Od 10.2025 mObywatel daje bezpłatny podpis kwalifikowany od tych czterech dostawców, ale do 5 dokumentów miesięcznie, PDF do 5 MB, **wyłącznie w sprawach prywatnych**. Nie nadaje się więc do obiegu kadrowego w urzędzie. [W] https://itwiz.pl/podpis-kwalifikowany-dostepny-bezplatnie-w-mobywatelu/ (`itwiz-podpis-kwalifikowany-mobywatel`, 23.10.2025), [P] `mbank-mszafir`
- **SZAFIR:** produkt KIR jest komercyjny, płatny jest certyfikat. Nie znaleziono darmowej ścieżki kwalifikowanej dla pracodawcy. [P] `kir-szafir`, `mbank-mszafir`

### 2.2. Integracja techniczna podpisu

- **Węzeł Podpisu** (MC/COI) pozwala systemowi zewnętrznemu zlecić złożenie podpisu zaufanego, kwalifikowanego lub osobistego. Usługi SOAP (WS-Security) oraz od 11.2025 REST (dokumentacja w Swagger UI). Wymagania: mTLS z certyfikatem klienckim, podpisane żądania, wpis systemu przez administratora PZ na listę systemów zewnętrznych, nadanie uprawnień. Przed integracją trzeba spełnić „Procedurę integracji systemów oraz wymiany certyfikatu do integracji systemów z podpisem zaufanym” z BIP MC. Formaty: XAdES (otoczony i otaczający), PAdES. Instrukcja v1.2 z 23.02.2026. [P] https://www.gov.pl/attachment/1d4a4f91-c2c4-41f4-9f05-1e7bf5ef2653 (`att-1d4a4f91`)
- Osobna usługa weryfikacji podpisanego dokumentu (TpSigning, SignatureVerification, TpPdfSigning), instrukcja v1.1 z 15.05.2026. [P] `att-2c4b0f24`
- Wzorzec Architektury Informacyjnej Państwa: system przekierowuje użytkownika do systemu podpisu, użytkownik wybiera typ podpisu, podpisane dokumenty wracają do systemu zlecającego. [P] `mc-ia-podpis-elektroniczny-dokumentu`
- **Ścieżka bez integracji:** usługa gov.pl „Podpisz dokument elektronicznie” przyjmuje m.in. .pdf, .docx, .odt, .xml, plik do 25 MB, podpis PZ jest bezpłatny, można wybrać format podpisu. [P] https://www.gov.pl/web/gov/podpisz-dokument-elektronicznie-wykorzystaj-podpis-zaufany (`govpl-podpisz-dokument-pz`, akt. 19.11.2025)
- Do weryfikacji podpisów lokalnie istnieje biblioteka UE **DSS** (licencja LGPL-2.1, aktywnie rozwijana, ostatni push 04.11.2026). [P] `github-repo-esig_dss.json`

### 2.3. Logowanie: Węzeł Krajowy (login.gov.pl)

- Do Węzła Krajowego przyłącza się systemy podmiotów publicznych świadczące „usługi online” przez Internet z uwierzytelnieniem środkiem identyfikacji elektronicznej. Węzeł przekazuje minimalny zestaw danych (imię, nazwisko, data urodzenia, identyfikator). [P] https://www.gov.pl/web/login/dla-integratorow (`login-dla-integratorow`)
- Procedura v3.6 (25.02.2026): SAML 2.0, dwa etapy przez portal wspolpraca.ct.gov.pl, wniosek produkcyjny podpisany **kwalifikowanym** podpisem osoby reprezentującej instytucję, integrator kupuje własne certyfikaty do podpisu komunikatów SSO/SLO i szyfrowania asercji. [P] `att-70d6b613`
- **Wniosek [O]:** Węzeł Krajowy służy do usług dla obywateli. Dla wewnętrznej aplikacji kadrowej to ciężka procedura bez korzyści, bo pracownicy mają już konta w domenie urzędu.

### 2.4. Jak podpisuje się w EZD RP

- Podpis w EZD RP: kwalifikowany na karcie lub USB z czytnikiem albo kwalifikowany chmurowy (dostawcy zdefiniowani przez administratora). Podpisywanie przez lokalną aplikację **NASK Desk**, uprawnienie `Dokumenty.Podpisywanie`. Formaty: PAdES (domyślny, DOC/DOCX konwertowany do PDF), XAdES otoczony, XAdES wewnętrzny otaczający, XAdES zewnętrzny. [P] `ezdrp-podrecznik-konfiguracja-podpisu`, `ezdrp-podrecznik-podpis-w-chmurze`, `ezdrp-podrecznik-podpisywanie-w-sprawie`
- Obok podpisu EZD RP ma osobną czynność **akceptacji** (zadanie „Do akceptacji lub podpisu”), która nie jest podpisem elektronicznym. [P] `ezdrp-podrecznik-szukaj-podpis`, `ezdrp-podrecznik-podpisywanie-w-sprawie`
- Papierowy dokument włączany do dokumentacji elektronicznej wymaga skanu z kwalifikowanym podpisem lub pieczęcią (art. 94^8 § 2 KP). Dokument wytworzony elektronicznie tego wymogu nie ma. [P] `../../wymagania-i-kontekst.md` sekcja 17

---

## 3. Infrastruktura, standardy i polityka

### 3.1. WIIP, Rządowa Chmura Obliczeniowa, Rządowy Klaster Bezpieczeństwa

- Uchwała nr 97 RM z 11.09.2019 (M.P. 2019 poz. 862) ustanawia Inicjatywę WIIP: Rządowa Chmura Obliczeniowa (RChO), Rządowy Klaster Bezpieczeństwa (RKB, ochrona RChO według SCCO), publiczne chmury obliczeniowe (PChO), zasada pierwszeństwa chmury (niekorzystanie z chmury wymaga uzasadnienia). [P] `uchwala-97-rm-2019-wiip`
- Załącznik nr 2 do uchwały klasyfikuje systemy. Kategoria 10 („rejestry, ewidencje oraz inne bazy danych … prowadzone przez podmioty na własny użytek … o charakterze wspomagającym”, np. wewnętrzne ewidencje) może działać w RChO, PChO w jurysdykcji krajowej i PChO w jurysdykcji państwa UE, po analizie ryzyka. Kategoria 8 (szczególne kategorie danych z art. 9 i 10 RODO) też dopuszcza wszystkie trzy, zależnie od analizy. Decyzja należy do właściciela systemu. [P] `uchwala-97-rm-2019-wiip`
- Według prezentacji MC z 2025 uchwała wiąże tylko Radę Ministrów i podległe jej organy, stąd prace nad „ustawą chmurową”. Statusu ustawy na 11.2026 nie potwierdzono. [S]
- Projekt WIIP (POPC, 188 718 396,90 zł): budowa RChO i RKB, dostęp do PChO, SCCO, usługa DR. [P] `mc-projekt-wiip`
- **SCCO v2.00 (03.2025):** SCCO1 informacje inne niż prawnie chronione, SCCO2 informacje prawnie chronione, SCCO3 niejawne „zastrzeżone”, SCCO4 niejawne. Dla SCCO2 przetwarzanie dozwolone w centrach danych w UE (EOG, jeśli respektuje prawo UE), w PChO, RChO z RKB albo chmurze prywatnej. [P] `mc-scco-v2-2025-03`
- Warunki PChO dla administracji (MC 20.08.2025): analiza ryzyka i klasyfikacja według załącznika nr 2 WIIP, SCCO, opinia właściwego CSIRT przed startem, jurysdykcja UE/EOG, suwerenność danych. Zakup przez katalog ZUCH lub zamówienia centralne. [P] `mc-chmura-cz4`
- UZP 13.10.2026: chmurę publiczną administracja kupuje głównie przez umowy wykonawcze do umów ramowych wspieranych przez MC w ramach WIIP. [P] `att-a7b5d1aa`

**Wniosek [O]:** dane ocen okresowych to dane osobowe, czyli SCCO2. System to wewnętrzna ewidencja wspomagająca (kategoria 10). Hostowanie centralne w RChO albo w chmurze w UE jest dopuszczalne po analizie ryzyka. Dane o zdrowiu przesunęłyby system do kategorii 8, czego warto unikać.

### 3.2. Typowy stos technologiczny w urzędach

Badanie MC i COI 2026 (N=604, w większości gminy, ostrożnie przy uogólnianiu na administrację rządową). [P] `mc-coi-badanie-open-source-2026`

| Obszar | Wynik |
|---|---|
| System operacyjny | Microsoft Windows 99,8%, Linux 0,2% |
| Pakiet biurowy (N=589) | Microsoft Office/365 92,4%, LibreOffice 7,5% |
| Poczta (N=454) | Outlook/365 46,5%, Thunderbird 31,9% |
| Komunikacja (N=373) | Microsoft Teams 70,2%, Zoom 15,8% |
| Tożsamość i dostęp (N=492) | **Microsoft Active Directory 97%** |
| Bazy danych (N=376) | MS SQL 54,5%, PostgreSQL 11,4%, Firebird 10,9% |
| Finanse i kadry | 95,4% oprogramowanie własnościowe |
| AI (N=175 z odpowiedzią) | ChatGPT 70,9%, Copilot 13,7%, Gemini 10,3%. 66,4% wszystkich: „nie dotyczy” |
| Model IT | dział IT i wsparcie zewnętrzne 57,3%, dział IT bez wsparcia 24,8%, brak działu IT i wsparcie zewnętrzne 11,9%, brak działu IT i brak wsparcia 6% |
| Liczba komputerów | 10 do 50: 46,5%, 51 do 100: 24,7%, powyżej 1000: 2,5% |

**Wnioski [O]:** SSO trzeba oprzeć na AD/LDAP. Serwer w urzędzie to najczęściej Windows. Prawie co piąty urząd nie ma własnego działu IT, więc potrzebna jest opcja centralna (SaaS). Pracownicy już używają publicznych czatbotów, więc legalna ścieżka AI z anonimizacją ma realną wartość.

- Docker Desktop wymaga płatnej subskrypcji dla „Government entities”. Silnik Docker Engine (projekt Moby) ma inne, otwarte warunki. [P] https://docs.docker.com/subscription/desktop-license/ (`docker-desktop-license`)

### 3.3. Polityka open source i repozytoria kodu

- Strategia Cyfryzacji Polski do 2035 r. (uchwała nr 130 RM z 9.06.2026, M.P. 2026 poz. 620), sekcja 4.6: Polska „nie posiada strategii rozwoju i wspierania otwartego oprogramowania” ani centralnej jednostki do jego adopcji. Cele: Biuro Programów Otwartego Oprogramowania, inwentaryzacja OSS w administracji, program wdrażania otwartego oprogramowania i otwartych standardów, zasady przetargów wspierające OSS, **repozytorium zweryfikowanego pod kątem bezpieczeństwa otwartego oprogramowania dla administracji**, wsparcie otwartych systemów AI w administracji. [P] `mp-2026-620-strategia-cyfryzacji-2035`
- MC 03.06.2026: konsultacje konkursu (FERC działanie 2.4) na pilotażowe wdrożenia OSS w JST. W MC powołano zespół ds. OSS. [P] `mc-konkurs-open-source-jst`
- **code.gov.pl:** nie znaleziono takiego repozytorium. COI ma organizację GitHub `coi-gov-pl` (24 publiczne repozytoria, ostatnie zmiany 2023), organizacja `NASK-PIB` ma 0 publicznych repozytoriów. [P] `github-coi-gov-pl-repos.json`, API GitHub 21.11.2026
- Kod mObywatela opublikowano częściowo 29.12.2025, obowiązek publikacji aktualnego kodu usunięto nowelizacją z 15.05.2024. [P] `sejm-interpelacja-14536-kod-mobywatel` (08.01.2026)
- Licencje EUPL: nie znaleziono polskiego dokumentu rządowego, który zaleca EUPL. [O]
- MC „Metareguły i zasady budowy cyfrowych usług publicznych” (10.2016): m.in. otwartość usług na integrację, nie powielaj tego, co istnieje, pozyskuj tylko niezbędne dane. [P] `att-fa502e29`
- **Design System GOV.PL:** wspomniany w Architekturze Informacyjnej Państwa jako zbiór wytycznych dla portali w serwisie gov.pl. Publicznej biblioteki komponentów (npm, Figma, GitHub) nie znaleziono. [P] `mc-ia-bloki-budowlane`, [O]
- Dostępność cyfrowa: WCAG 2.1 AA przez EN 301 549, także dla intranetu. Zob. `../../wymagania-i-kontekst.md` sekcja 20.

---

## 4. Polskie modele językowe

### 4.1. PLLuM i HIVE AI

- Rodzina PLLuM 2512 (grudzień 2025, publikacja na HF 01 i 02.2026). [P] https://huggingface.co/CYFRAGOVPL/PLLuM-12B-instruct-2512 (`hf-card-CYFRAGOVPL_PLLuM-12B-instruct-2512.md`)

| Model | Parametry | Baza | Licencja |
|---|---|---|---|
| PLLuM-4B (base, instruct, chat) | 4B | gemma-3-4b-pt | apache-2.0 według karty |
| Llama-PLLuM-8B | 8B | Llama-3.1-8B | Llama 3.1 Community License |
| PLLuM-12B | 12B | Mistral-Nemo-Base-2407 | apache-2.0 |
| Llama-PLLuM-70B | 70B | Llama-3.1-70B | Llama 3.1 Community License |

- Starsze wydanie 2412 zawierało też PLLuM-8x7B (Mixtral) oraz warianty `-nc-` na licencji **CC-BY-NC-4.0** (tylko użytek niekomercyjny). [P] `hf-card-CYFRAGOVPL_PLLuM-8x7B-chat-2412.md`
- Uwaga [O]: karta podaje apache-2.0 dla 4B zbudowanego na Gemma 3, której własne warunki (Gemma Terms of Use) mogą obowiązywać dalej. Wymaga sprawdzenia przed użyciem.
- Modele trenowano także pod RAG, karta podaje szablon promptu z cytowaniem dokumentów. Do modeli dołączono publiczne podsumowanie danych treningowych zgodne z AI Act. [P] karta modelu
- MC 21.05.2026: 11 nowych modeli, obsługa ponad 20 gatunków tekstów urzędowych, upraszczanie języka urzędowego, praca na wzorach dokumentów, lepsze działanie w RAG. 4B dla ograniczonej mocy (najlepiej po dostrojeniu), 8B i 12B „polecane do wdrożeń produkcyjnych, np. jako silnik w systemach RAG”, 70B do złożonych zadań. [P] https://samorzad.gov.pl/web/gov/wiecej-szybciej-po-polsku-rodzina-modeli-pllum-sie-powieksza (`govpl-pllum-rodzina-sie-powieksza-2026-05`)
- HIVE AI: konsorcjum koordynowane przez NASK, dotacja MC nr 1/WI/DBI/2025, 18 983 055 zł, pilotaże w mObywatelu i w wybranych instytucjach (np. MC). [P] `nask-hive-ai-about`
- Wirtualny asystent w mObywatelu działa na PLLuM od 31.12.2025, odpowiada na podstawie oficjalnych stron (RAG), nie przetwarza danych osobowych. [P] `mc-mobywatel-wirtualny-asystent` (30.12.2025)
- **API PLLuM dla urzędów:** nie znaleziono publicznie dostępnego API ani usługi „model jako usługa” dla administracji (stan 21.11.2026). Najbliższy plan to Asystent Urzędniczy AI w EZD RP i AI Hub. [O] na podstawie `att-71655d1d` i wyszukiwań
- Lubuskie Centrum Cyfryzacji opublikowało na HF własne kwantyzacje PLLuM-12B-nc-chat (f16, q8), co wskazuje na lokalne uruchamianie PLLuM przez jednostkę publiczną. [P] `hf-api-search-pllum.json`

### 4.2. Bielik (SpeakLeash, ACK Cyfronet AGH)

- Licencja Apache-2.0. Repozytoria na HF mają bramkę „gated: auto” (trzeba zalogować się i zaakceptować warunki udostępnienia danych). [P] `hf-card-speakleash_*.api.json`, `hf-page-bielik-11b-v3.1-instruct`
- Bielik-11B-v3.1-Instruct (akt. 10.11.2026): 11B, architektura llama, pretrening 500B tokenów, SFT 26M próbek, RL (zmodyfikowany GRPO), nacisk na polski i języki europejskie. Uruchamianie: vLLM (od 0.24, z parserami narzędzi z `speakleash/bielik-tools`), SGLang, Docker Model Runner, Transformers. [P] `hf-page-bielik-11b-v3.1-instruct`
- Rodzina: 1.5B, 4.5B (v3.0), Minitron-7B, 11B (v2.x, v3.0, v3.1), Bielik-Guard 0.1B i 0.5B (klasyfikator bezpieczeństwa treści), od 11.2026 Bielik-One (modele decyzyjne w stylu Jev, bez generowania tekstu, szczegóły w `../ai-lokalne/FINDINGS.md`). [P] `hf-api-models-speakleash.json`
- Bielik 11B v3 rozszerza architekturę Mistral 7B v0.2 do 11B (depth up-scaling). [P] https://arxiv.org/pdf/2601.11579 (`arxiv-2601.11579`, 30.12.2025)

### 4.3. Jakość po polsku

- Open PL LLM Leaderboard (SpeakLeash, lm-evaluation-harness): Bielik-11B-v3.0-Instruct 65,93 (5-shot), powyżej m.in. Meta-Llama-3.1-70B-Instruct. Polish EQ-Bench: Bielik-11B-v3.0-Instruct 71,20, Llama-3.3-70B-Instruct 70,73. [P] `arxiv-2601.11579` (wyniki raportowane przez autorów modelu)
- **PLLuM nie jest ujęty w Open PL LLM Leaderboard**, bo trenowano go na częściach treningowych zadań benchmarku. Autorzy wskazują inne rankingi (Polish MT-Bench, Polish EQ-Bench, CPTUB). [P] `openpl-leaderboard-about.txt`
- Agregator Codesota (05.2026): PLCC PLLuM-12B-nc-chat 72, Bielik-11B-v3.0-Instruct 69, najwyżej Gemini 3.1 Pro 97. [S]
- Niezależny test Oxido (12 modeli, 20 zadań, za „Rzeczpospolitą”): najwyżej Gemini 3.1 Pro 8,13/10, Bielik 3.0 i PLLuM w dolnej części, przy znacznie mniejszej liczbie parametrów. [W] `spidersweb-pllum-bielik-test-2026-03` (17.03.2026)

**Wniosek [O]:** polskie modele 11 do 12B są wystarczające do zadań redakcyjnych na podstawie notatek przełożonego i RAG po przepisach, ale słabsze od czołowych modeli komercyjnych. To argument za architekturą, w której model da się wymienić.

### 4.4. Wymagania sprzętowe i silniki

- Rozmiary plików GGUF (pamięć potrzebna na same wagi):

| Model | Q4_K_M | Q8_0 | BF16/F16 |
|---|---|---|---|
| Bielik-11B-v3.1-Instruct (oficjalne) | 6,72 GB | 11,87 GB | 22,34 GB |
| Bielik-4.5B-v3.0-Instruct (oficjalne) | brak | 5,06 GB | 9,52 GB |
| PLLuM-12B-instruct, wydanie 2412 (społecznościowe, mradermacher) | 7,48 GB | 13,02 GB | brak |
| Llama-PLLuM-70B-instruct (społecznościowe) | 42,52 GB | około 75 GB (2 części) | brak |

  [P] `hf-api-tree-bielik-11b-v3.1-gguf.json`, `hf-api-tree-bielik-4.5b-gguf.json`, `hf-api-tree-mradermacher_*.json`
- Silniki: llama.cpp (MIT), Ollama (MIT), vLLM (Apache-2.0). Karta GGUF Bielika podaje gotowe polecenia `ollama run hf.co/speakleash/Bielik-11B-v3.1-Instruct-GGUF:Q4_K_M` i `llama serve -hf …` (serwer zgodny z OpenAI). [P] `github-repo-*.json`, `hf-page-bielik-11b-v3.1-instruct-gguf`
- Szacunek [O], niezweryfikowany pomiarem: model 11 do 12B w Q4_K_M mieści się na GPU z 12 do 16 GB VRAM razem z kontekstem kilku tysięcy tokenów. Na samym CPU (llama.cpp) działa, ale generowanie dłuższego tekstu trwa wtedy dziesiątki sekund. Model 70B wymaga serwera z około 48 GB VRAM lub więcej nawet po kwantyzacji 4-bitowej. Modele 4B do 4.5B w Q8 mieszczą się w 8 GB.

### 4.5. Anonimizacja tekstów po polsku

- CLARIN-PL Anonymizer: usługa i kod open source (GitLab CLARIN-PL), zastępuje dane wrażliwe tagami typu [OSOBA], ma tryb pseudonimizacji, korzysta z NER (WiNER, Liner2). Licencji nie zweryfikowano. [S] https://wiki.clarin-pl.eu/pl/nlpservices/list/anonymizer
- Model NER clarin-pl/FastPDN, licencja CC-BY-4.0 (akt. 05.2023). [P] API HF 21.11.2026
- NASK planuje „Anonimizator” jako umiejętność Asystenta Urzędniczego AI. [P] `att-71655d1d`, `att-c739cf89`

---

## 5. Systemy kadrowe w administracji

- **Brak centralnego systemu kadrowego dla służby cywilnej.** Nie znaleziono projektu „e-Kadry” dla SC. [O] na podstawie wyszukiwań
- KPRM DSC udostępniał urzędom **BOSC** (Baza Ocen w Służbie Cywilnej): baza MS Access 2010 (z Access Runtime), import ocen z arkuszy MS Excel 2010, raporty pomocne przy sprawozdaniu dyrektora generalnego wysyłanym przez **SWEZ_HR**. Wersja 4.0 z 2015 r. [P] `att-16e8617e` (ten sam dokument w `../sluzba-cywilna`)
- Sprawozdanie dyrektora generalnego (art. 25 ust. 5 ustawy o SC) składa się w systemie **Centrum Kompetencji Państwa (CKP)**, moduł „sprawozdania”. Opiekun merytoryczny: DSC KPRM, administrator: COAR. Sprawozdanie ma sześć tabel, każda jako formularz w CKP. Instrukcja nie opisuje importu z pliku. [P] `att-7ea533d7` (wersja dla sprawozdania za 2020), `att-49653f7e`
- Formularz DSC-OCK (oceny pracownicze, kompetencje miękkie, WLB), wygenerowany 31.10.2025. [P] `att-99b009da`, `att-adf387c6`
- Rynek systemów kadrowo-płacowych jest rozproszony. Badanie MC i COI, obszar „Finanse i kadry” (N=591): pozostałe 40,1%, INFO-SYSTEM Groszek 20%, RADIX 11,3%, ZETO Software 9,8%, Respons Rekord SI 8,5%, Softres 6,1%, Korelacja DISTRICTUS 4,2%. Własnościowe 95,4%. Próba głównie samorządowa. [P] `mc-coi-badanie-open-source-2026`
- Popularne w administracji rządowej marki (Sputnik, Asseco, Comarch, enova365, Symfonia, Vulcan) nie pojawiają się w tym zestawieniu jako osobne pozycje. Udziału tych systemów w urzędach SC nie ustalono. [O]
- Wspólny format eksportu z systemów kadrowych nie istnieje. KRI wymaga od systemów publicznych udostępniania danych w formatach z załącznika nr 2, w tym .csv, .xml, .xlsx, .ods. [P] KRI, [O]

---

## 6. Wnioski dla architektury

### 6.1. Sposób dystrybucji

1. **Jedna aplikacja webowa, trzy tryby uruchomienia z tego samego kodu:**
   - (a) **centralny SaaS** prowadzony przez KPRM lub COI w RChO albo w chmurze w UE (SCCO2, kategoria 10 WIIP). Dla około 18% urzędów bez działu IT to jedyna realna opcja (badanie MC i COI). Wzorzec: SaaS EZD RP.
   - (b) **instalacja w urzędzie** jako obraz kontenera OCI uruchamiany przez Podman lub Docker Engine na Linuksie, albo jako paczka dla Windows Server (99,8% urzędów ma Windows). Nie zakładać Docker Desktop, bo dla podmiotów rządowych jest płatny.
   - (c) **duży urząd** z Kubernetesem: chart Helm, PostgreSQL zewnętrzny, wiele instancji. Wzorzec: EZD RP (RKE2, PostgreSQL).
2. **Baza danych:** PostgreSQL jako docelowa, SQLite dla najmniejszej instalacji jednostanowiskowej. Nie uzależniać od MS SQL, choć 54,5% urzędów go ma.
3. **Lekkość:** instalacja testowa EZD RP to 24 vCPU i 64 GB RAM. Nasz system bez AI powinien działać na maszynie 2 vCPU, 4 GB RAM. [O]
4. **Licencja kodu:** otwarta (np. EUPL-1.2 lub Apache-2.0) i publiczne repozytorium. To odpowiada celom sekcji 4.6 Strategii Cyfryzacji i odróżnia nas od EZD RP (freeware). [O]

### 6.2. Aktualizacja

- Wersjonowane, podpisane wydania obrazu, automatyczne migracje bazy, kanał „stable”. W trybie SaaS poprawki trafiają do wszystkich od razu.
- Reguły z przepisów (arkusze, kryteria, skala, terminy) jako wersjonowana konfiguracja (np. YAML z numerem aktu prawnego), wydawana niezależnie od kodu. Pozwala to wydać zmiany po nowelizacji ustawy o SC bez przebudowy (wymóg T-06).

### 6.3. SSO i konta

- **AD/LDAP jako podstawa** (97% urzędów ma Active Directory). Dwie drogi: bezpośrednie wiązanie LDAP(S) albo OIDC/SAML przez Keycloak (Apache-2.0) lub ADFS/Entra ID, jeśli urząd je ma.
- Konta lokalne z MFA dla najmniejszych jednostek.
- **Nie używać Węzła Krajowego** dla pracowników: jest przeznaczony dla usług online dla obywateli i wymaga formalnej procedury z podpisem kwalifikowanym i zakupionymi certyfikatami.

### 6.4. Podpis

Poziomy, od najprostszego:

1. **Zatwierdzenie w systemie** (odpowiednik „akceptacji” w EZD RP): uwierzytelniony użytkownik, znacznik czasu, skrót SHA-256 dokumentu, wpis w niezmienialnym dzienniku (KRI § 20). Tryb domyślny.
2. **Podpis elektroniczny PAdES na PDF/A arkusza**, bez integracji: system generuje PDF, pracownik podpisuje go na gov.pl („Podpisz dokument”, PZ, bezpłatnie, do 25 MB) albo w mObywatelu (podpis osobisty, do 10 MB) albo kwalifikowanym podpisem urzędu. Podpisany plik wraca do systemu, który weryfikuje go lokalnie biblioteką DSS (LGPL-2.1). Uprzedzić użytkownika, że PZ i podpis osobisty zapisują w pliku jego PESEL.
3. **Integracja z Węzłem Podpisu** (REST): tylko w trybie centralnym, bo wymaga procedury formalnej, certyfikatu klienckiego i wpisu u administratora PZ. Jedna integracja operatora obsłuży wszystkie urzędy.
4. **Podpis w EZD RP:** wysłanie arkusza do EZD jako dokument z zadaniem „Do podpisu” i odbiór zdarzenia `ezdrp.v2.dokument.podpis.zlozono`.
5. **Wydruk do podpisu odręcznego** jako tryb awaryjny.

Formę wymaganego podpisu trzeba potwierdzić z mentorami (pytanie 2 w `../../wymagania-i-kontekst.md`, sekcja 21).

### 6.5. Model AI: lokalny czy zewnętrzny

- **AI jako moduł opcjonalny.** Cały proces oceny działa bez AI.
- **Jedna abstrakcja: API zgodne z OpenAI** (`/v1/chat/completions`). Pozwala podłączyć llama.cpp, Ollama, vLLM, przyszły AI Hub lub Asystenta Urzędniczego AI NASK oraz model komercyjny bez zmian w kodzie.
- **Domyślnie model lokalny** na licencji Apache-2.0: Bielik-11B-v3.1-Instruct (Q4_K_M, 6,72 GB) albo PLLuM-12B-instruct-2512. Dla słabszego sprzętu Bielik-4.5B lub PLLuM-4B. Unikać wariantów `-nc-` (CC-BY-NC-4.0). Llama-PLLuM (licencja Llama 3.1) traktować ostrożnie przy wymogu „bez płatnych licencji” i neutralności.
- **Tryb centralny:** jeden serwer GPU obsługuje wiele urzędów. To tańsze niż GPU w każdym urzędzie. [O]
- **Model zewnętrzny tylko przez warstwę anonimizacji:** NER po polsku (np. podejście CLARIN-PL Anonymizer lub FastPDN) zamienia imiona, nazwiska, PESEL, nazwy komórek i stanowisk na pseudonimy. Mapa pseudonimów zostaje w urzędzie, tekst wraca i jest odtwarzany lokalnie. Do tego centra danych w UE (SCCO2), umowa powierzenia (art. 28 RODO) i rejestr wywołań.
- Nie zapisywać danych o zdrowiu (art. 9 RODO). Analiza sentymentu i sygnałów wypalenia przez Bielik-One jest dozwolona jako sugestia (ustalenie z KPRM).
- Bielik-Guard (0.1B do 0.5B) może filtrować wejście i wyjście modelu. [O]

### 6.6. Integracja z EZD i e-mail

- **Adapter EZD RP (REST v2):** konto techniczne i klucz API od administratora instytucji, nagłówek SID. Operacje: założenie lub wskazanie sprawy, dodanie dokumentu (PDF arkusza) z metadanymi, zadanie „Do akceptacji lub podpisu”, subskrypcja zdarzeń akceptacji i podpisu (webhook HTTP, więc system musi być osiągalny z EZD RP). Testy w Piaskownicy API (bezpłatnej, na wniosek).
- **Adapter ogólny dla innych EZD** (EZD PUW, SIDAS, Proton, Edicta i inne): paczka do pobrania lub wysyłki e-mailem do kancelarii: PDF/A arkusza, plik XML z metadanymi według części C i D załącznika nr 1 instrukcji kancelaryjnej (tytuł, data, autor, znak sprawy wpisywany ręcznie). Ten sam adapter obsłuży urzędy bez EZD.
- **E-mail (SMTP):** powiadomienia o terminach i zadaniach. Treść powiadomień bez danych oceny, tylko link do systemu.
- Śledzić Platformę EZD RP low-code (beta 2028) i Asystenta Urzędniczego AI. Moduł ocen może później stać się procesem na tej platformie albo jej źródłem danych.

### 6.7. Eksport i import

- **Import pracowników i struktury:** szablon CSV (UTF-8, RFC 4180) i XLSX/ODS, bo nie ma wspólnego formatu z systemów kadrowych. Mapowanie kolumn w interfejsie. Opcjonalnie synchronizacja z AD (atrybuty `department`, `title`, `manager`).
- **Import historyczny:** arkusze Excel z wzorów DSC oraz dane z BOSC (Access), jeśli urząd go używa.
- **Eksport:** PDF/A arkusza (do akt osobowych, część B), CSV/XLSX/ODS zestawień, XML z XSD dla arkuszy (KRI zaleca publikację schematów w repozytorium interoperacyjności, § 14), zestawienie pod tabele sprawozdania DSC-OCK do przepisania w CKP.
- Formaty zgodne z załącznikiem nr 2 KRI.

### 6.8. Bezpieczeństwo i zgodność

- RBAC według ról z procesu oceny, dziennik zdarzeń zgodny z KRI § 20, szyfrowanie transmisji (TLS) i kopii zapasowych.
- Dokument klasyfikacji systemu według WIIP (kategoria 10, SCCO2) i szablon DPIA w dokumentacji wdrożeniowej, żeby urząd nie musiał ich pisać od zera. [O]
- Interfejs zgodny z WCAG 2.1 AA (EN 301 549). Brak publicznej biblioteki komponentów gov.pl, więc własne komponenty z wizualnym nawiązaniem do gov.pl. [O]


## Uzupełnienie: wymagania archiwalne dla EZD (Sejm, 23.10.2026)

- Drugie czytanie rządowego projektu zmiany ustawy o narodowym zasobie archiwalnym i archiwach (druki nr 3000 i 3081): wymagania dla systemu EZD (integralność, ochrona przed zmianą dokumentów spraw załatwionych i usunięciem, dostęp i odczyt). Pełne odwzorowanie cyfrowe dokumentacji papierowej w EZD zyska status oryginału. Systemy mają 24 miesiące na dostosowanie. To nie jest ustawa wprowadzająca obowiązek EZD. [P] https://api.sejm.gov.pl/sejm/term10/proceedings/67/2026-10-23/transcripts/094 (`text/sejm-2026-10-23-transkrypt-094`, `-113`)
- Wniosek [O]: zakończona ocena musi być nienaruszalna (wersjonowanie, skrót dokumentu, PDF/A).
