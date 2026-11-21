# sarmata

System Automatycznej Rejestracji i Monitorowania Awansów, Terminów i Analiz. Cyfrowy asystent ocen okresowych w służbie cywilnej.

## Jak uruchomić (dev)

Krok po kroku, od czystej maszyny do działającego środowiska.

1. **Narzędzia systemowe:** Node 24, pnpm 12.21.0, Docker (działający), sops, age, opcjonalnie direnv. Sprawdzenie i polecenia instalacji dla macOS, Debiana/Ubuntu i Windowsa:

       pnpm run doctor

   (`pnpm doctor` bez `run` to wbudowana komenda pnpm 12, nie nasz skrypt.)

2. **Klucz age zespołu** w `~/.config/sops/age/keys.txt` (albo ścieżka w `SOPS_AGE_KEY_FILE`). Nowa osoba generuje klucz `age-keygen -o ~/.config/sops/age/keys.txt`, przekazuje klucz publiczny, a ktoś z zespołu dopisuje go do `.sops.yaml` i robi `sops updatekeys secrets/dev.enc.env`.

3. **Zależności:**

       pnpm install

   Supabase CLI 3.2.0 przychodzi z tym krokiem (devDependency `@sarmata/database`).

4. **Sekrety i zmienne środowiskowe.** Pliki `.env*` nigdy nie trafiają do repo. `.env.local` w korzeniu powstaje z `secrets/dev.enc.env` (SOPS):
   - z direnv: `direnv allow` (raz na worktree). Od tej pory direnv sam odszyfrowuje `.env.local`, gdy plik nie istnieje albo zaszyfrowany plik jest nowszy, i ładuje go do powłoki,
   - bez direnv: `pnpm secrets:decrypt`.

5. **Baza danych** (wspólna instancja `sarmata` dla wszystkich worktree, nie koliduje z innymi stackami Supabase na portach 54321 do 54323):

       pnpm db:start
       pnpm db:reset

   `pnpm db:reset` czyści dane wszystkich worktree na wspólnej instancji, więc służy pierwszemu uruchomieniu albo świadomemu wyczyszczeniu. Nowy worktree potrzebuje tylko `pnpm regulations:sync`. `pnpm db:reset` kończy się synchronizacją oficjalnych wersji przepisów z `backend/regulations` do tabeli `regulation_versions`. To samo robi worker przy każdym starcie, a `pnpm regulations:sync` uruchamia ją osobno.

6. **AI lokalnie (opcjonalne, Mac z Apple Silicon).** Runtime LLM działa natywnie, bez Dockera (ADR 0005). Pierwsze `ai:setup` pobiera przypięty llama.cpp v1.0.0 z Metal (17 MB) i Bielik-11B-v3.1 Q4_K_M (6,7 GB) z kontrolą SHA-256 do `~/Library/Application Support/sarmata/ai` (wspólne dla wszystkich worktree, logi w `logs/`):

       pnpm ai:setup
       pnpm ai:start

   Serwer działa w tle pod `http://127.0.0.1:55490/v1`, zatrzymuje go `pnpm ai:stop`. Oba skrypty zapisują ustawienia `SARMATA_AI_*` (włączenie, adres i model, kontrakt z `backend/ai/src/config.ts`) do wygenerowanego `.env.ai.local` w korzeniu, który direnv ładuje zaraz po `.env.local` (bez direnv: `set -a; . ./.env.ai.local; set +a`). Na słabszym sprzęcie: `SARMATA_AI_MODEL=bielik-4.5b-v3.0-q8_0 pnpm ai:setup`. Sekretów ani tokenu Hugging Face nie trzeba, repozytoria modeli są publiczne. Pobieranie robi się raz na maszynę: w kolejnym worktree wystarczy `pnpm ai:env` (zapisuje tylko `.env.ai.local`, bez pobierania i bez startu serwera), a skrypt setup dla Termic woła go sam. Powtórne `ai:setup` też niczego nie ściąga, jeśli pliki mają poprawne sumy.

7. **Aplikacja web** (po `pnpm db:start`):

       pnpm web:env
       pnpm --filter @sarmata/e2e exec playwright install chromium
       pnpm dev

   `web:env` zapisuje `frontend/web/.env.local` z adresem i kluczem lokalnego Supabase (oraz wszystkie `SARMATA_AI_*` z `.env.ai.local`, jeśli istnieje). Żeby aplikacja pracowała na zewnętrznej instancji Supabase, ustaw w powłoce `SUPABASE_URL` i `SUPABASE_PUBLISHABLE_KEY` przed `pnpm web:env`: skrypt użyje ich zamiast `supabase status`. Przeglądarka Chromium służy testom e2e i skillowi `app-walkthrough`. Aplikacja działa na `http://localhost:3000`.

8. **Worker kolejki zadań** (opcjonalnie, potrzebny dopiero dla zadań w tle):

       pnpm worker:dev

   Najpierw synchronizuje wersje przepisów, potem czyta kolejkę pgmq `jobs`. Ctrl+C kończy go po bieżącym zadaniu. Próba: `docker exec supabase_db_sarmata psql -U postgres -c "select public.job_queue_send('{\"type\":\"system.ping\",\"payload\":{\"note\":\"hi\"}}')"`, w logu pojawi się `pong`.

9. **Sprawdzenie całości.** CI na pull requeście robi tylko `pnpm check`, a pgTAP i e2e uruchamia na main:

       pnpm check
       pnpm db:test
       pnpm test:integration

   `pnpm test:integration` to testy repozytoriów na działającej bazie, z kontami demo, przy zatrzymanym workerze (test czyta wspólną kolejkę). CI ich nie uruchamia.

10. **Instalator dla urzędów (opcjonalnie).** Testy, binarki kreatora i podgląd instalacji bez zmian w systemie:

        pnpm --filter @sarmata/deploy test
        pnpm --filter @sarmata/deploy compile
        infra/deploy/dist/sarmata-macos-arm64 install --dry-run --answers infra/deploy/examples/light.json

    Prawdziwą instalację (`install` bez `--dry-run`) uruchamiaj tylko na maszynie wirtualnej albo osobnym komputerze: zakłada `~/Sarmata` (macOS) albo `/opt/sarmata` (Linux), kontenery projektu `sarmata` i porty 3000 i 8000.

Konta demo (hasło `Haslo-Demo-2026`): `admin@kropka.test`, `kadry@kropka.test`, `oceniajacy@kropka.test`. Czwarte konto, `bezurzedu@kropka.test`, nie ma urzędu i trafia na stronę `/brak-urzedu`.

## Skrypty

| Skrypt | Co robi |
|---|---|
| `pnpm run doctor` | sprawdza wymagane narzędzia i podpowiada instalację |
| `pnpm check` | lint, format, typecheck i testy (to samo co CI) |
| `pnpm test` | testy wszystkich pakietów przez Turborepo |
| `pnpm typecheck` | kontrola typów |
| `pnpm lint`, `pnpm format` | ESLint i Prettier |
| `pnpm secrets:decrypt` | odszyfrowuje `secrets/dev.enc.env` do `.env.local` |
| `pnpm db:start` / `db:stop` / `db:status` | instancja `sarmata`: API 55421, DB 55422, Studio 55423, Mailpit 55424 |
| `pnpm db:reset` | migracje od zera, dane demo i synchronizacja oficjalnych wersji przepisów |
| `pnpm db:test` | testy pgTAP |
| `pnpm db:types` | typy do `database/src/types.ts`, po każdej migracji |
| `pnpm test:integration` | testy repozytoriów na lokalnym Supabase, wymagają `pnpm db:reset` |
| `pnpm regulations:sync` | wstawia brakujące oficjalne wersje przepisów, kończy się błędem, gdy wersja w bazie różni się od kodu |
| `pnpm worker:dev` | worker kolejki pgmq z przeładowaniem po zmianie kodu |
| `pnpm worker:start` | worker kolejki pgmq bez przeładowania |
| `pnpm ai:setup` | llama.cpp i model Bielik do katalogu danych AI, wybór urządzenia, zapis `.env.ai.local` |
| `pnpm ai:env` | `.env.ai.local` dla tego worktree z już pobranego AI, bez pobierania |
| `pnpm ai:start` / `ai:stop` | wspólny llama-server w tle na porcie 55490 |
| `pnpm --filter @sarmata/deploy test` | testy instalatora (plany kroków, compose, sekrety, skróty) bez Dockera |
| `pnpm --filter @sarmata/deploy vendor:supabase [TAG]` | odświeża przypiętą kopię self-hosted Supabase w `infra/deploy/supabase/` |
| `docker build -f infra/deploy/docker/app.Dockerfile --target web -t sarmata/web:check .` | sprawdzenie obrazu aplikacji tak, jak buduje go instalator (cele: `web`, `worker`) |
| `pnpm --filter @sarmata/deploy compile` | binarki kreatora dla Windows x64, Linux x64 i arm64, macOS arm64 w `infra/deploy/dist/` (Bun pobiera runtime celu przy pierwszej kompilacji) |
| `pnpm --filter @sarmata/deploy release 1.0.0` | paczka dla urzędów `infra/deploy/release/sarmata-1.0.0.zip`: źródła z HEAD, binarki, `VERSION` |
| `infra/deploy/dist/sarmata-macos-arm64 install --dry-run --answers infra/deploy/examples/light.json` | lista kroków instalacji bez żadnych zmian (po `compile`) |
| `infra/deploy/dist/sarmata-macos-arm64 render --answers infra/deploy/examples/server.json --out /tmp/sarmata-server` | `compose.yaml`, `.env` i `Caddyfile` do obejrzenia, bez instalacji |

## Aplikacja web

| Skrypt | Co robi |
|---|---|
| `pnpm web:env` | zapisuje `frontend/web/.env.local` z adresem i kluczem publicznym lokalnego Supabase, a ustawione w powłoce `SUPABASE_URL` i `SUPABASE_PUBLISHABLE_KEY` mają pierwszeństwo |
| `pnpm dev` | Next.js w trybie deweloperskim (port ze zmiennej `PORT`, domyślnie 3000) |
| `pnpm e2e` | testy Playwright: logowanie i wylogowanie każdym kontem demo, dostępność (axe, WCAG 2.1 AA) |
| `pnpm e2e:ui` | te same testy w trybie UI Playwright |
| `pnpm e2e:walk` | zrzuty ekranów dla wybranych kont i ścieżek (`WALK_ACCOUNTS`, `WALK_PATHS`), opis w `.claude/skills/app-walkthrough/SKILL.md` |

Font Open Sans jest na licencji SIL Open Font License 1.1.

## Zmienne środowiskowe

Żadna z nich nie jest sekretem zespołu. Lokalne klucze Supabase podaje `supabase status`, więc nie trafiają do `secrets/dev.enc.env`. W instalacji u klienta ustawia je kreator.

| Zmienna | Kto używa | Skąd w dev |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | testy integracyjne, worker | `scripts/with-supabase-env.mjs` czyta je z `supabase status`, chyba że `SUPABASE_URL` jest już ustawione (zewnętrzna instancja) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | aplikacja web | `frontend/web/.env.local`, zapisuje go `pnpm web:env` (z `supabase status` albo z ustawionych w powłoce zmiennych zewnętrznej instancji) |
| `SITE_URL` | aplikacja web | domyślnie `http://localhost:3000`, `scripts/termic-run.sh` ustawia adres taska. Na razie nic go nie czyta (zaproszenia i reset hasła) |
| `PORT` | `pnpm dev` | domyślnie 3000, `scripts/termic-run.sh` ustawia port taska |
| `SARMATA_AI_ENABLED` | `@sarmata/ai` | domyślnie `false`, AI wyłączone |
| `SARMATA_AI_TIMEOUT_MS` | `@sarmata/ai` | domyślnie `60000` |
| `SARMATA_AI_TEXT_BASE_URL`, `SARMATA_AI_TEXT_MODEL` | `@sarmata/ai`, model tekstowy zgodny z OpenAI | np. `http://127.0.0.1:55490/v1` i `bielik-11b-v3.1-instruct` przy lokalnym llama-server z `pnpm ai:start`, bez nich model tekstowy jest wyłączony |
| `SARMATA_AI_DECISION_BASE_URL`, `SARMATA_AI_DECISION_MODEL` | `@sarmata/ai`, Bielik-One `/v1/systemone` | np. `http://127.0.0.1:8026/v1` i `decision`, bez nich decyzje są wyłączone |
| `SARMATA_AI_TEXT_API_KEY`, `SARMATA_AI_DECISION_API_KEY` | `@sarmata/ai` | tylko gdy serwer modelu wymaga klucza. To sekret: dopisz go do `secrets/dev.enc.env` przez `sops secrets/dev.enc.env`, nigdy jawnie do repo |
| `SARMATA_WORKER_IDLE_DELAY_MS` | worker | domyślnie `1000`, przerwa po pustym odczycie kolejki |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_EMAIL`, `SMTP_SENDER_NAME` | worker | opcjonalne i na razie nieużywane: kreator je przekazuje, worker tylko sprawdza ich poprawność do czasu powiadomień. `SMTP_HOST` wymaga też portu i adresu nadawcy |

W instalacji urzędu te same zmienne ustawia kreator w `.env` katalogu instalacji. Kontener `web` dostaje `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_URL` i `SARMATA_AI_*`, a `SUPABASE_SECRET_KEY` trafia wyłącznie do kontenera `worker` (ADR 0004).

## Pliki konfiguracyjne

- W repo: `.envrc`, `.sops.yaml`, `secrets/*.enc.env` (zaszyfrowane), `.mcp.json`, `.claude/`, `.agents/`, `.codex/`, `scripts/termic-*.sh`, `database/supabase/config.toml`, `infra/deploy/supabase/` (kopia `docker/` z supabase/supabase, nie edytować ręcznie), `infra/deploy/docker/` (Dockerfile aplikacji i `dbtool.sh` dla instalacji w urzędach).
- Poza repo: `.env`, `.env.local` i inne `.env*` (powstają z SOPS albo ze skryptów, np. `.env.ai.local` z `pnpm ai:setup`), klucze age, katalog danych AI `~/Library/Application Support/sarmata/ai` (llama.cpp, modele, logi), `.termic/customization-manifest.json` (generuje go Termic).

## Termic

W ustawieniach projektu sarmata w Termic ustaw:

- skrypt setup: `./scripts/termic-setup.sh`. Robi automatycznie: ostrzeżenia z `doctor` (krok 1), `pnpm install` (krok 3), `direnv allow` i sekrety (krok 4), start wspólnej bazy bez `db:reset` oraz `pnpm regulations:sync` (krok 5), `pnpm ai:env` bez pobierania modeli (krok 6), `web:env` i Chromium dla Playwright (krok 7).
- skrypt run: `./scripts/termic-run.sh`

Skrypt run uruchamia `pnpm dev` na porcie wyliczonym z nazwy taska (`$TERMIC_TASK`, zakres 3001 do 3999, poza Termic port 3000) i ustawia `SITE_URL` aplikacji na ten sam adres. Port bieżącego taska pokazuje `node scripts/task-port.mjs`.

Skrypt setup po starcie wspólnej bazy synchronizuje oficjalne wersje przepisów (`pnpm regulations:sync`).

## Instalacja w urzędzie

Instrukcja dla działu IT urzędu. Instalacja nie używa SOPS ani kont w usługach zewnętrznych: kreator generuje hasła i klucze lokalnie i zapisuje je tylko w pliku `.env` katalogu instalacji (prawa tylko dla właściciela). Potrzebny jest dostęp do internetu w czasie instalacji (obrazy Dockera, pakiety npm do budowy aplikacji, opcjonalnie modele AI).

### Wybór profilu

| Profil | Dla kogo | Orientacyjny sprzęt | Dostęp |
|---|---|---|---|
| light | jedno stanowisko | 2 rdzenie, 4 GB RAM, 20 GB dysku, AI domyślnie wyłączone | tylko ten komputer, `http://localhost:3000` |
| standard | mocniejsze stanowisko albo mały urząd | 4 rdzenie, 8 GB RAM (z AI 16 GB albo karta 8 GB), 40 GB dysku | ten komputer albo sieć urzędu, porty 3000 i 8000 |
| server | serwer w sieci urzędu | Linux, 4 rdzenie, 16 GB RAM, 60 GB dysku | `https://<nazwa-serwera>` przez Caddy, porty 80 i 443 |

Każdy profil może zamiast lokalnej bazy użyć zewnętrznego projektu Supabase.

### Windows 10 i 11 (light, standard)

1. Rozpakuj `sarmata-<wersja>.zip`, np. do `C:\Sarmata\paczka`.
2. Uruchom dwuklikiem `infra\deploy\install.bat`. Gdy SmartScreen ostrzeże przed nieznanym wydawcą, wybierz „Więcej informacji”, potem „Uruchom mimo to”.
3. Jeśli komputer nie ma WSL2, kreator go zainstaluje (okno uprawnień administratora) i poprosi o restart. Po restarcie uruchom `install.bat` jeszcze raz.
4. Kreator zakłada dystrybucję WSL `sarmata` z Docker Engine (darmowy, bez Docker Desktop). Jeśli urząd ma licencję Docker Desktop i jest on uruchomiony, kreator użyje go zamiast WSL.
5. Odpowiedz na pytania: profil, baza, nazwa urzędu, konto administratora, SMTP, AI, skrót na pulpicie. Pierwsza budowa aplikacji trwa 10 do 20 minut.
6. Skrót „Sarmata” na pulpicie uruchamia system i otwiera przeglądarkę. Dla profilu standard w sieci kreator włącza tryb sieci `mirrored` WSL i regułę zapory Hyper-V (drugie okno uprawnień administratora).

### Linux (server, także light i standard)

Obsługiwane: Ubuntu 22.04, 24.04, 26.04, Debian 12 i 13, RHEL 8 do 10 (oraz Rocky i Alma), Fedora 43 do 45.

1. Zaloguj się na konto z `sudo` i rozpakuj paczkę: `unzip sarmata-<wersja>.zip && cd sarmata`.
2. Uruchom `sh infra/deploy/install.sh`.
3. Kreator instaluje Docker Engine z oficjalnego repozytorium Dockera, dodaje konto do grupy `docker` (działa po ponownym zalogowaniu) i zakłada katalog `/opt/sarmata`.
4. Profil server pyta o nazwę serwera z DNS urzędu i certyfikat:
   - wewnętrzne CA Caddy: po instalacji roześlij plik `/opt/sarmata/caddy-root.crt` do magazynu „Zaufane główne urzędy certyfikacji” na komputerach urzędu (np. przez GPO),
   - certyfikat urzędu: podaj ścieżki do plików PEM certyfikatu (z łańcuchem) i klucza.
5. Otwórz w zaporze porty 80 i 443 (np. `sudo ufw allow 80,443/tcp` albo `sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload`).
6. Profil server robi co noc kopię bazy do `/opt/sarmata/backups` i trzyma 14 ostatnich.

### macOS z Apple Silicon (light, standard)

1. Zainstaluj Docker Desktop (jeśli urząd ma licencję) albo Colima: `brew install colima docker docker-compose`, potem `colima start --cpu 4 --memory 8`.
2. Rozpakuj paczkę i uruchom `sh infra/deploy/install.sh`.
3. Skrót `Sarmata.command` na pulpicie uruchamia system i otwiera przeglądarkę.

### Zewnętrzne Supabase

Kreator pyta o adres projektu, klucz publiczny, klucz serwisowy i adres połączenia z bazą (do migracji i kopii). W panelu projektu Supabase trzeba samodzielnie włączyć hook Custom Access Token z funkcją `access.custom_access_token_hook`, ustawić Site URL na adres aplikacji i skonfigurować SMTP dla e-maili logowania.

### Codzienna obsługa

| Polecenie (Windows: `install.bat <polecenie>` z paczki albo skrót) | Co robi |
|---|---|
| `sarmata start --open` | uruchamia system i otwiera przeglądarkę (to robi skrót na pulpicie) |
| `sarmata stop`, `sarmata status` | zatrzymanie, stan usług |
| `install.sh update` z rozpakowanej nowej paczki | kopia bazy, budowa nowej wersji obok działającej, migracje, restart, przy błędzie automatyczny powrót do poprzedniej wersji i danych |
| `sarmata update --from sarmata-<wersja>.zip` | to samo z pliku zip (Linux, macOS, WSL) |
| `sarmata uninstall` | usuwa system, zostawia końcową kopię bazy w `backups/` (`--purge` usuwa wszystko) |

Polecenie `sarmata` leży w `/opt/sarmata/bin` (Linux), `~/Sarmata/bin` (macOS) albo `%LOCALAPPDATA%\Programs\Sarmata` (Windows). Kopie bazy są w `backups/` katalogu instalacji: `/opt/sarmata` (Linux, a na Windows w WSL pod `\\wsl.localhost\sarmata\opt\sarmata`), `~/Sarmata` (macOS), `C:\ProgramData\Sarmata` (Windows z Docker Desktop).

## Dokumentacja

Architektura: `docs/architektura.md`, decyzje: `docs/adr/`, słownik: `GLOSSARY.md`, wymagania: `docs/wymagania-i-kontekst.md`, znak i logo: `docs/brand/`.
