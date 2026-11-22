# Instalacja w urzędzie

Instrukcja dla działu IT urzędu. Instalacja nie używa SOPS ani kont w usługach zewnętrznych: kreator generuje hasła i klucze lokalnie i zapisuje je tylko w pliku `.env` katalogu instalacji. Katalog instalacji jest dostępny tylko dla konta, które instalowało (Linux `0750`, macOS `0700`, Windows z Docker Desktop: lista ACL tylko dla tego konta, SYSTEM i Administratorów). Potrzebny jest dostęp do internetu w czasie instalacji (obrazy Dockera, pakiety npm do budowy aplikacji, opcjonalnie modele AI).

Obrazy aplikacji budują się na Debianie, a worker ma wbudowane wyszukiwanie przepisów (semble) razem z modelem embeddingów, który pobiera przy budowaniu z Hugging Face. W sieci z proxy podmieniającym certyfikaty TLS ustaw przed instalacją `SARMATA_BUILD_CA_FILE` na ścieżkę do pliku PEM z certyfikatem proxy (np. `export SARMATA_BUILD_CA_FILE=/etc/ssl/proxy.pem`). Instalator przekazuje go budowaniu jako sekret BuildKit `ca`. W zwykłej sieci zmienna nie jest potrzebna.

## Wybór profilu

| Profil | Dla kogo | Orientacyjny sprzęt | Dostęp |
|---|---|---|---|
| light | jedno stanowisko | 2 rdzenie, 4 GB RAM, 20 GB dysku, AI domyślnie wyłączone | tylko ten komputer, `http://localhost:3000` |
| standard | mocniejsze stanowisko albo mały urząd | 4 rdzenie, 8 GB RAM (z AI 16 GB albo karta 8 GB), 40 GB dysku | tylko ten komputer (`http://localhost:3000`) albo sieć urzędu przez HTTPS (`https://<nazwa-komputera>`, porty 80 i 443) |
| server | serwer z Linuksem w sieci urzędu | 4 rdzenie, 16 GB RAM, 60 GB dysku | `https://<nazwa-serwera>`, porty 80 i 443, kopia bazy co noc |

Każdy profil może zamiast lokalnej bazy użyć zewnętrznego projektu Supabase. Dostęp z sieci urzędu zawsze idzie przez HTTPS (Caddy), więc hasła i sesje nie przechodzą przez sieć otwartym tekstem. Supabase API, Studio i aplikacja słuchają tylko na `127.0.0.1`. Kreator pyta wtedy o certyfikat: wewnętrzne CA Caddy (plik `caddy-root.crt` z katalogu instalacji trzeba rozesłać do magazynu „Zaufane główne urzędy certyfikacji” komputerów urzędu, np. przez GPO) albo certyfikat urzędu z plików PEM.

## Windows 10 i 11 (light, standard)

Dostęp z sieci urzędu i moduł AI wymagają Windows 11 22H2 lub nowszego (tryb sieci `mirrored` WSL). Na Windows 10 22H2 kreator instaluje profil light albo standard tylko z dostępem z tego komputera i bez AI.

1. Zaloguj się na konto, z którego system będzie używany na co dzień, i uruchom kreator z tego konta. Dystrybucja WSL należy do jednego konta Windows: instalacja z konta działu IT nie będzie widoczna dla urzędnika. Okna uprawnień administratora pojawią się same.
2. Rozpakuj `sarmata-<wersja>.zip`, np. do `C:\Sarmata\paczka`.
3. Uruchom dwuklikiem `infra\deploy\install.bat`. Gdy SmartScreen ostrzeże przed nieznanym wydawcą, wybierz „Więcej informacji”, potem „Uruchom mimo to”.
4. Jeśli komputer nie ma WSL2, kreator go zainstaluje (okno uprawnień administratora) i poprosi o restart. Po restarcie uruchom `install.bat` jeszcze raz.
5. Kreator zakłada dystrybucję WSL `sarmata` z Docker Engine (darmowy, bez Docker Desktop). Jeśli Docker Desktop jest uruchomiony, kreator użyje go zamiast WSL. Jeśli jest zainstalowany, ale nie działa, kreator zatrzyma się z prośbą o jego uruchomienie (nie przechodzi wtedy na WSL).
6. Odpowiedz na pytania: profil, dostęp, baza, nazwa urzędu, konto administratora, SMTP, model AI, skrót na pulpicie. Pierwsza budowa aplikacji trwa 10 do 20 minut.
7. Kreator ustawia w `%USERPROFILE%\.wslconfig` pracę WSL w tle (`instanceIdleTimeout=-1`), a przy dostępie z sieci albo AI także sieć `mirrored`. Ten plik dotyczy wszystkich dystrybucji WSL konta. Przy dostępie z sieci dodaje regułę zapory Hyper-V dla portów 80 i 443 (drugie okno uprawnień administratora).
8. System działa, gdy to konto jest zalogowane: zadanie „Sarmata WSL” uruchamia go po zalogowaniu, a skrót „Sarmata” na pulpicie dodatkowo otwiera przeglądarkę. Po wylogowaniu koledzy w sieci tracą dostęp. Do pracy całodobowej służy profil server na Linuksie.

## Linux (server, także light i standard)

Obsługiwane: Ubuntu 22.04, 24.04, 26.04, Debian 12 i 13, RHEL 8 do 10 (oraz Rocky i Alma), Fedora 43 do 45.

1. Zaloguj się na konto z `sudo`. Na minimalnej instalacji serwera doinstaluj `unzip`: `sudo apt install unzip` albo `sudo dnf install unzip`. Rozpakuj paczkę: `unzip sarmata-<wersja>.zip && cd sarmata`.
2. Na RHEL i zgodnych z zainstalowanym `podman` albo `runc` usuń je najpierw (`sudo dnf remove podman runc`), bo kolidują z Docker Engine. Kreator sprawdza to sam i zatrzyma się z tym poleceniem.
3. Uruchom `sh infra/deploy/install.sh`.
4. Kreator instaluje Docker Engine z oficjalnego repozytorium Dockera, dodaje konto do grupy `docker` (działa po ponownym zalogowaniu) i zakłada katalog `/opt/sarmata`. Do tego czasu polecenia Dockera idą przez `sudo`, które może w trakcie budowy ponownie zapytać o hasło (widać to w terminalu).
5. Profil server pyta o nazwę serwera z DNS urzędu i certyfikat. Przy certyfikacie urzędu podaj ścieżki do plików PEM certyfikatu (z łańcuchem) i klucza. Oba pliki muszą być czytelne dla konta, które uruchamia kreator (klucz z `/etc/ssl/private` skopiuj najpierw, np. `sudo install -m 600 -o $USER klucz.pem ~/klucz.pem`). Kreator zapisuje klucz w instalacji z prawami `600`.
6. Otwórz w zaporze porty 80 i 443 (np. `sudo ufw allow 80,443/tcp` albo `sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload`).
7. Profil server robi kopię bazy codziennie o 02:00 czasu polskiego do `/opt/sarmata/backups` i trzyma 14 najnowszych. Kopie mają prawa `600` i należą do roota.

## macOS z Apple Silicon (light, standard)

1. Jeśli urząd ma licencję Docker Desktop, zainstaluj go i uruchom. W przeciwnym razie wystarczy Homebrew (https://brew.sh): kreator sam zainstaluje Colima (`brew install colima docker docker-compose docker-buildx`), dopisze katalog wtyczek Homebrew do `~/.docker/config.json` (`cliPluginsExtraDirs`, bez tego `docker compose` i BuildKit nie działają) i uruchomi Colima z 2 rdzeniami i 4 GB (light) albo 4 rdzeniami i 8 GB (standard).
2. Rozpakuj paczkę i uruchom `sh infra/deploy/install.sh`.
3. Skrót `Sarmata.command` na pulpicie uruchamia system i otwiera przeglądarkę.

## Pierwsze logowanie

Po instalacji zaloguj się kontem administratora podanym w kreatorze: e-mail administratora jako login i hasło (co najmniej 12 znaków).

Przy instalacji z gotowego pliku odpowiedzi (`install --answers infra/deploy/examples/<profil>.json`) konto administratora to:

| Login | Hasło |
|---|---|
| `admin@kropka.test` | `Haslo-Demo-2026` |

Te pliki służą do instalacji testowych. W urzędzie użyj własnych danych albo zmień hasło zaraz po pierwszym logowaniu.

Instalacja zakłada tylko urząd i konto administratora, bez danych demo. Konta oceniających i kadr administrator dodaje w aplikacji (Ustawienia, Konta).

Dane demo (`database/supabase/seed.sql`, ładowane przez `pnpm db:reset` albo `pnpm start` w środowisku deweloperskim, opis w [dla-deweloperow.md](dla-deweloperow.md)) mają 3 konta w urzędzie „Urząd Ministerstwa Testowego w Kropce Wielkopolskiej”, wszystkie z tym samym hasłem:

| Login | Hasło | Rola |
|---|---|---|
| `oceniajacy@kropka.test` | `Haslo-Demo-2026` | oceniający (Olga Oceniająca), przełożona Marka, Ewy, Stefana i Jana |
| `kadry@kropka.test` | `Haslo-Demo-2026` | kadry (Karol Kadrowy) |
| `admin@kropka.test` | `Haslo-Demo-2026` | administrator (Anna Administracyjna) |

Seed zakłada też konto testowe `bezurzedu@kropka.test` z tym samym hasłem, bez urzędu. Po zalogowaniu widzi tylko stronę „brak urzędu”. Pracownicy demo (Marek, Ewa, Stefan, Jan, Roman) nie mają kont, bo oceniany nie korzysta z aplikacji.

## Zewnętrzne Supabase

To opcja. Domyślnie kreator stawia bazę i logowanie (Supabase) lokalnie, na tym samym komputerze, i nie pyta o żadne klucze. Poniższe kroki dotyczą tylko wyboru zewnętrznej instancji.

Przy zewnętrznej instancji kreator pyta o adres projektu, klucz publiczny, klucz serwisowy i adres połączenia z bazą (do migracji i kopii). W panelu projektu Supabase trzeba samodzielnie włączyć hook Custom Access Token z funkcją `access.custom_access_token_hook`, ustawić Site URL na adres aplikacji i skonfigurować SMTP dla e-maili logowania. Kopie obejmują schematy aplikacji (`public`, `access`) i listę migracji, a konta logowania zostają w projekcie Supabase.

## Moduł AI

Kreator wykrywa sprzęt i proponuje modele Bielik, które się zmieszczą: najpierw zalecany, potem mniejsze i większe, albo „bez AI”. Gdy obok modelu tekstowego zmieści się na stałe Bielik-One (Mac z Apple Silicon od 32 GB, Linux z kartą NVIDIA od 24 GB), kreator pyta, czy go zainstalować. W przeciwnym razie pisze, dlaczego go pomija, ile pamięci by potrzebował i od jakiego sprzętu się zmieści, a decyzje podejmuje model tekstowy z wymuszonym formatem JSON. Na Macu z 16 GB instaluje się więc tylko Bielik-4.5B Q4_K_M. Model bazowy Bielik-One 11B (Mac od 48 GB, karta od 48 GB) wymaga konta Hugging Face z zaakceptowaną licencją: token zapisuje `HF_HOME="<katalog danych AI>/huggingface" uvx --from huggingface_hub hf auth login`. Modele pobierają się raz na maszynę do katalogu danych AI konta (szczegóły w części dev wyżej). Bielik-One instaluje się przez `uv`, a gdy go brakuje, kreator instaluje `uv` sam (Homebrew na macOS, oficjalny instalator przypiętej wersji do katalogu danych AI na Linuksie).

AI instaluje się po uruchomieniu systemu. Kreator rejestruje najpierw serwer modelu tekstowego i włącza AI w aplikacji dopiero wtedy, gdy ten serwer odpowiada. Bielik-One jest dodatkiem: gdy się nie uda, AI działa z samym modelem tekstowym. Gdy nie uda się nic, aplikacja działa bez AI. Polecenie `sarmata ai` doinstalowuje, zmienia albo naprawia moduł AI na działającej instalacji, a `sarmata ai --off` go wyłącza. Usługi AI startują z systemem: systemd na Linuksie, launchd na macOS, zadanie przy zalogowaniu na Windows.

## Codzienna obsługa

| Polecenie (Windows: `install.bat <polecenie>` z paczki albo skrót) | Co robi |
|---|---|
| `sarmata start --open` | uruchamia system i otwiera przeglądarkę (to robi skrót na pulpicie) |
| `sarmata stop`, `sarmata status` | zatrzymanie, wersja i stan usług |
| `install.sh update` z rozpakowanej nowej paczki | sprawdzenie wolnego miejsca (10 GB), kopia bazy, budowa nowej wersji obok działającej, migracje, restart, przy błędzie automatyczny powrót do poprzedniej wersji i danych |
| `sarmata update --from sarmata-<wersja>.zip` | rozpakowuje paczkę (Linux, macOS, WSL) i przekazuje aktualizację kreatorowi nowej wersji, dalej jak wyżej |
| `sarmata ai` | instalacja, zmiana albo naprawa modułu AI |
| `sarmata restore <plik>.dump` | odtworzenie bazy z kopii w `backups/` (najpierw kopia bieżącej bazy) |
| `sarmata uninstall` | usuwa system, zostawia w `backups/` końcową kopię bazy i klucze potrzebne do jej odtworzenia (`--purge` usuwa wszystko) |

Polecenie `sarmata` leży w `/opt/sarmata/bin` (Linux), `~/Sarmata/bin` (macOS) albo `%LOCALAPPDATA%\Programs\Sarmata` (Windows). Kopie bazy są w `backups/` katalogu instalacji: `/opt/sarmata` (Linux, a na Windows w WSL pod `\\wsl.localhost\sarmata\opt\sarmata`), `~/Sarmata` (macOS), `C:\ProgramData\Sarmata` (Windows z Docker Desktop). Aktualizacja nie przechodzi na starszą wersję. Po udanym starcie nowej wersji kreator sprząta stare kopie, a błąd sprzątania tylko ostrzega i nie cofa aktualizacji.

Przy zewnętrznym Supabase nieudana aktualizacja odtwarza bazę z kopii zrobionej tuż przed nią (`backups/pre-update-<data>.dump`). Przy lokalnej bazie wraca migawka całego wolumenu bazy.

Kopie bazy nie są jeszcze szyfrowane. Chroni je tylko dostęp do katalogu instalacji, więc kopie przenoszone poza serwer trzeba zaszyfrować samodzielnie.

## Gdy instalacja się nie uda

Kreator można uruchomić ponownie z tej samej paczki: każdy krok da się powtórzyć, a kreator użyje haseł z istniejącego `.env`, więc baza z pierwszej próby dalej pasuje. Plik `sarmata.json` powstaje na samym końcu i dopiero on oznacza gotową instalację.

## Odtwarzanie kopii

1. Na działającej instalacji (także świeżej, po ponownej instalacji z tej samej albo nowszej paczki) skopiuj plik kopii do katalogu `backups/`.
2. Uruchom `sarmata restore <plik>.dump`. Kreator robi kopię bieżącej bazy (`pre-restore-<data>.dump`), zatrzymuje aplikację, odtwarza dane, nakłada migracje nowszej wersji i uruchamia system.
3. Kopia z lokalnej bazy przywraca schematy aplikacji, konta logowania (`auth`) i metadane plików (`storage`). Role, rozszerzenia i ustawienia Supabase pochodzą ze świeżej instalacji.
4. Sekrety w Supabase Vault wymagają klucza pgsodium z kopii końcowej (`backups/pgsodium_root.key-<data>`), a komputery urzędu ufają certyfikatom Caddy tylko z tym samym CA (`backups/caddy-ca-<data>`). Oba odtwarza się ręcznie przy zatrzymanym systemie (`sarmata stop`): klucz do wolumenu `db-config` (`/etc/postgresql-custom/pgsodium_root.key`), CA do wolumenu `caddy-data` (`/data/caddy/pki/authorities/local`), potem `sarmata start`.
