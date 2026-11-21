# Wdrożenie: Supabase w kontenerach, LLM natywnie, lokalny build, kreator TUI

Urząd instaluje system kreatorem TUI skompilowanym do jednego pliku (Windows, Linux, macOS), który uruchamiają `install.bat` albo `install.sh`. Supabase działa na darmowym Docker Engine (Linux natywnie, Windows przez WSL2), bo Docker Desktop jest płatny dla instytucji rządowych. Domyślnie jest to self-hosted compose sterowany przez kreator, a kreator pozwala też podłączyć zewnętrzną instancję Supabase. Runtime LLM działa natywnie, poza kontenerem, bo kontener odcina dostęp do GPU (na macOS w ogóle nie widzi Metal). Aplikację web kreator buduje lokalnie ze źródeł (`docker build` z lokalnymi tagami `current`, `candidate` i `previous`, więc wycofanie aktualizacji to przełączenie tagu) i nie korzysta z rejestru obrazów, bo repo jest prywatne, a rejestr dokładałby pracę w CI i problem z dostępem.

## Konsekwencje

- Aktualizacja to nowy build ze źródeł, więc na słabym sprzęcie trwa kilka minut. Kreator robi przed nią kopię bazy.
- Kreator musi umieć zainstalować Docker Engine (w tym WSL2 na Windows) i runtime LLM z wykrywaniem sprzętu.
- Kreator kompilujemy `bun build --compile` (Bun jako devDependency, tylko do kompilacji), bo uruchamia kod TS z monorepo bez zmian. Deno odrzucony przez problemy z rozwiązywaniem modułów z workspace'ów pnpm.

## Profile kreatora

- **light:** jedno stanowisko na słabym sprzęcie. Minimalne Supabase (db, auth, rest, kong), worker w osobnym kontenerze (tylko on dostaje klucz serwisowy, ADR 0004), AI domyślnie wyłączone, dostęp tylko z localhost bez TLS.
- **standard:** jedno mocniejsze stanowisko albo mały urząd w sieci. Pełne Supabase, czyli do usług z profilu light dochodzą storage, imgproxy, meta i Studio (bez realtime, edge functions, analityki i puli połączeń, bo aplikacja ich nie używa), AI według tieru sprzętowego.
- **server:** urząd w sieci LAN. Osobny worker, Bielik-One na vLLM, kopie zapasowe, HTTPS przez Caddy jako reverse proxy (certyfikat urzędu albo wewnętrzne CA Caddy).

Kreator wykrywa istniejący silnik kontenerów i używa go (także Docker Desktop, jeśli urząd ma licencję). Gdy silnika nie ma, instaluje Docker Engine.

## Drobne ustalenia kreatora

- Każdy profil tworzy skrót na pulpicie (tam, gdzie system to wspiera), który uruchamia stack i otwiera przeglądarkę.
- Kreator pyta o SMTP do powiadomień. Bez SMTP powiadomienia są tylko w aplikacji.
- vLLM i MLX (Bielik-One) instaluje przez `uv`, zgodnie z zasadą, że Python zawsze idzie przez uv.
- Licencje wszystkich komponentów są darmowe i pozwalają na przeniesienie praw: Supabase i Docker Engine (Apache-2.0), llama.cpp (MIT), vLLM (Apache-2.0), MLX (MIT), Typst (Apache-2.0), Caddy (Apache-2.0), Bun (MIT), modele Bielik (Apache-2.0).
- Runtime AI (llama-server, Bielik-One) słucha tylko na `127.0.0.1` i działa jako usługa systemowa. Na Linuksie i w WSL kontenery dochodzą do niego przez przekaźnik `ai-relay`, który wystawia porty AI wyłącznie na adresie bramy mostu Dockera.
