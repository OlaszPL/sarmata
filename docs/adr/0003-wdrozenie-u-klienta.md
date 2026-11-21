# Wdrożenie: Supabase w kontenerach, LLM natywnie, lokalny build, kreator TUI

Urząd instaluje system kreatorem TUI skompilowanym do jednego pliku (Windows, Linux, macOS), który uruchamiają `install.bat` albo `install.sh`. Supabase działa na darmowym Docker Engine (Linux natywnie, Windows przez WSL2), bo Docker Desktop jest płatny dla instytucji rządowych. Domyślnie jest to self-hosted compose sterowany przez kreator, a kreator pozwala też podłączyć zewnętrzną instancję Supabase. Runtime LLM działa natywnie, poza kontenerem, bo kontener odcina dostęp do GPU (na macOS w ogóle nie widzi Metal). Aplikację web kreator buduje lokalnie ze źródeł (`docker build` z lokalnymi tagami `current`, `candidate` i `previous`, więc wycofanie aktualizacji to przełączenie tagu) i nie korzysta z rejestru obrazów, bo repo jest prywatne, a rejestr dokładałby pracę w CI i problem z dostępem.

## Konsekwencje

- Aktualizacja to nowy build ze źródeł, więc na słabym sprzęcie trwa kilka minut. Kreator robi przed nią kopię bazy.
- Kreator musi umieć zainstalować Docker Engine (w tym WSL2 na Windows) i runtime LLM z wykrywaniem sprzętu.
- Kreator kompilujemy `bun build --compile` (Bun jako devDependency, tylko do kompilacji), bo uruchamia kod TS z monorepo bez zmian. Deno odrzucony przez problemy z rozwiązywaniem modułów z workspace'ów pnpm.

## Profile kreatora

Co zawiera każdy profil, opisuje jedna tabela w kodzie (`PROFILE_TABLE` w `infra/deploy/src/profiles.ts`), z której korzystają wszystkie kroki kreatora.

- **light:** jedno stanowisko na słabym sprzęcie. Minimalne Supabase (db, auth, rest, kong), worker w osobnym kontenerze (tylko on dostaje klucz serwisowy, ADR 0004), AI domyślnie wyłączone, dostęp tylko z localhost bez TLS.
- **standard:** jedno mocniejsze stanowisko albo mały urząd w sieci. Pełne Supabase, czyli do usług z profilu light dochodzą storage, imgproxy, meta i Studio (bez realtime, edge functions, analityki i puli połączeń, bo aplikacja ich nie używa), AI według tieru sprzętowego. Dostęp z tego komputera albo z sieci urzędu.
- **server:** urząd w sieci LAN, tylko Linux. Osobny worker, Bielik-One na vLLM, kopie bazy co noc.

Kreator wykrywa istniejący silnik kontenerów i używa go (także Docker Desktop, jeśli urząd ma licencję). Gdy silnika nie ma, instaluje Docker Engine, a na macOS Colima z Homebrew.

## Dostęp z sieci urzędu tylko przez HTTPS

Każda instalacja dostępna z sieci urzędu (standard w sieci i server) stoi za Caddy z HTTPS: certyfikat urzędu albo wewnętrzne CA Caddy. Kong, Studio i aplikacja słuchają tylko na `127.0.0.1`, a Caddy przekazuje do Konga wyłącznie `/auth/v1/*` (linki z e-maili logowania), bo aplikacja rozmawia z Supabase po stronie serwera. Bez tego standard w sieci wystawiał hasło Studio, loginy i ciasteczka sesji otwartym tekstem na całą sieć. Ceną jest certyfikat do rozesłania na komputery urzędu przy wewnętrznym CA.

## Aktualizacja i AI w kreatorze

- Aktualizacja ma punkt zatwierdzenia. Do startu nowej wersji każdy błąd cofa obrazy, pliki i dane (migawka wolumenu lokalnej bazy albo odtworzenie kopii w zewnętrznym Supabase). Po starcie kreator tylko sprząta stare kopie, a błąd sprzątania jest ostrzeżeniem.
- Aktualizację planuje kod nowej wersji: zainstalowane polecenie rozpakowuje paczkę i przekazuje sterowanie kreatorowi z tej paczki (`update --staged`), bo compose.yaml i `.env` należą do wersji, która je zapisuje.
- AI włącza się w aplikacji dopiero wtedy, gdy zarejestrowany serwer modelu tekstowego odpowiada. Bielik-One jest dodatkiem: jego błąd zostawia sam model tekstowy. Polecenie `sarmata ai` dogrywa albo naprawia AI na działającej instalacji. Użytkownik wybiera model spośród tych, które mieszczą się na sprzęcie.
- Dostęp z sieci i AI przez WSL wymagają Windows 11 22H2 (sieć `mirrored`, reguły zapory Hyper-V). Na Windows 10 kreator ich nie oferuje.
- Silnik WSL należy do jednego konta Windows i działa, gdy to konto jest zalogowane. Zadanie przy zalogowaniu budzi dystrybucję po restarcie.

## Drobne ustalenia kreatora

- Każdy profil tworzy skrót na pulpicie (tam, gdzie system to wspiera), który uruchamia stack i otwiera przeglądarkę.
- Kreator pyta o SMTP do powiadomień. Bez SMTP powiadomienia są tylko w aplikacji.
- vLLM i MLX (Bielik-One) instaluje przez `uv`, zgodnie z zasadą, że Python zawsze idzie przez uv. Gdy `uv` brakuje, kreator go instaluje (Homebrew albo oficjalny instalator przypiętej wersji).
- Licencje wszystkich komponentów są darmowe i pozwalają na przeniesienie praw: Supabase i Docker Engine (Apache-2.0), llama.cpp (MIT), vLLM (Apache-2.0), MLX (MIT), Typst (Apache-2.0), Caddy (Apache-2.0), Bun (MIT), modele Bielik (Apache-2.0).
- Runtime AI (llama-server, Bielik-One) słucha tylko na `127.0.0.1` i startuje z systemem: jako usługa systemd na Linuksie, agent launchd na macOS i zadanie przy zalogowaniu na Windows (więc na Windows działa, gdy konto jest zalogowane). Na Linuksie i w WSL kontenery dochodzą do niego przez przekaźnik `ai-relay`, który wystawia porty AI wyłącznie na adresie bramy mostu Dockera.
- Katalog instalacji i kopie bazy są dostępne tylko dla właściciela. Kopie nie są jeszcze szyfrowane.

## Otwarte

- Szyfrowanie kopii bazy (np. `age` z kluczem urzędu).
- Podpisane wydania i obrazy przypięte po skrócie (digest), nie po tagu.
- Usługi AI na Linuksie działają z konta, które instalowało. Osobne konto systemowe `sarmata` wymagałoby przeniesienia danych AI poza katalog domowy.

## Lista kontrolna pierwszego testu na sprzęcie

Rzeczy sprawdzalne tylko na prawdziwych komputerach albo maszynach wirtualnych:

1. Windows 11 23H2 lub nowszy, czysta maszyna bez WSL: `wsl --install --no-distribution`, okno UAC, restart, drugie uruchomienie, `wsl --install Ubuntu-24.04 --name sarmata --no-launch --web-download` rejestruje dystrybucję, `/etc/wsl.conf` z systemd działa, `[general] instanceIdleTimeout=-1` działa, Docker Engine instaluje się w WSL.
2. Windows 11, standard w sieci: sieć `mirrored` i reguła Hyper-V udostępniają porty 80 i 443 innemu komputerowi, porty publikowane przez Docker w WSL działają w trybie `mirrored`.
3. Windows 10 22H2: kreator nie oferuje dostępu z sieci ani AI, instalacja tylko dla tego komputera przechodzi.
4. Windows z Docker Desktop: lista ACL `C:\ProgramData\Sarmata`, montowania katalogów, zmiany nazw katalogów przy aktualizacji, skrót po restarcie, gdy Docker Desktop jeszcze nie działa (komunikat „nie działa”, a nie „brak instalacji”).
5. Windows z nazwą konta ze spacją i polskimi literami: ścieżka paczki przez `toWslPath`, argumenty zadań harmonogramu, tworzenie `.lnk` i okno skrótu, które zostaje otwarte przy błędzie.
6. Windows z AI: llama-server na `127.0.0.1:55491`, `ai-relay` w WSL dochodzi do niego przez loopback `mirrored` (`docker compose exec worker node -e "fetch('http://host.docker.internal:55491/v1/models').then((r) => console.log(r.status))"` wypisuje 200).
7. SmartScreen i Defender wobec `sarmata-windows-x64.exe` z Buna, Gatekeeper z podpisem ad hoc z `install.sh` i z kreatora aktualizacji na macOS.
8. Ubuntu 24.04, profil server z wewnętrznym CA: ponowne pytanie `sudo` w czasie budowy jest widoczne, eksport `caddy-root.crt` i zaufanie na kliencie Windows przez GPO, nocne kopie o 02:00, ich prawa `600` i katalog `0750`.
9. Linux z AI i włączonym ufw: `ss -ltnp` pokazuje llama-server i Bielik-One tylko na `127.0.0.1`, a socat tylko na adresie `docker0`, kontenery z `sarmata_default` dochodzą do `172.17.0.1:55491` przez ufw, port 55491 zamknięty z innego komputera, jednostki systemd z `NoNewPrivileges` i `ProtectSystem=full` startują (także vLLM).
10. RHEL 9 i 10 (oraz Rocky albo Alma) z zainstalowanym podman: kreator zatrzymuje się z poleceniem usunięcia, SELinux w trybie enforcing z montowaniami bez `:z` (`./backups`, `./Caddyfile`, `dbtool.sh`, migracje), strefy firewalld.
11. Fedora 43 z `dnf config-manager addrepo --from-repofile` (dnf5) i fabrycznym podman.
12. macOS z Homebrew bez silnika: kreator instaluje Colima, `docker compose` i BuildKit działają dzięki `cliPluginsExtraDirs`, `host.docker.internal` dochodzi do loopbacku Maca dla AI, `~/Sarmata/backups` jest zapisywalne przez montowanie Colima.
13. Profil light na 2 vCPU i 4 GB RAM (WSL domyślnie bierze połowę RAM): budowa obrazu Next.js kończy się bez braku pamięci, czas w porównaniu z 10 do 20 minutami z README.
14. Świeży stack self-hosted: migracje jako rola `postgres` (`pg_cron`, `pgmq`, `supabase_vault` przez supautils), konto administratora przez `access.create_account`, logowanie z hookiem Custom Access Token, który dodaje `office_id` i rolę do JWT.
15. Zewnętrzne Supabase: migracje przez `EXTERNAL_DATABASE_URL`, hook włączony w panelu, klucz `sb_publishable_` przyjęty przez aplikację, nieudana aktualizacja odtwarza kopię `pre-update`.
16. Aktualizacja z wymuszonymi błędami: zepsuta migracja (powrót plików, obrazów i danych), błąd w sprzątaniu po starcie (tylko ostrzeżenie, nowa wersja działa), aktualizacja przez `sarmata update --from` z paczką, w której zmienił się compose (planuje ją kreator nowej wersji), wymiana `sarmata.exe` w czasie działania.
17. Usunięcie bez `--purge`, potem `sarmata restore` końcowej kopii na świeżej instalacji, z kluczem pgsodium i CA Caddy z `backups/`.
18. `sarmata ai` na działającej instalacji: wybór mniejszego modelu, instalacja `uv`, gdy go brakuje, Bielik-One, który nie wstaje (zostaje sam model tekstowy), `sarmata ai --off`.
