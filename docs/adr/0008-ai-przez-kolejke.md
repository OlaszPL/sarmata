# Wszystkie wywołania AI przez kolejkę

Każda usługa AI (szkic arkusza, kontrola jakości, strażnik danych wrażliwych, przygotowanie rozmowy, propozycje kryteriów, momenty docenienia, sygnały HR partnera, asystent procedury) działa tak samo. Serwis `ai` w procesie Next.js, z JWT użytkownika, zbiera migawkę wejścia przez RLS i zapisuje przebieg `queued` w tabeli `ai_runs`. Trigger wysyła zadanie `ai.run` do pgmq. Worker przejmuje przebieg (`claim`), woła moduł `AiRunner` z `@sarmata/ai` i zapisuje wynik albo porażkę. Front odpytuje `ai.get(id)`. Tabela `ai_runs` jest naraz dziennikiem użycia AI i stanem zadania.

## Dlaczego

1. Lokalny Bielik na CPU pisze szkic arkusza minutami. Kolejka nie trzyma żądania HTTP i przeżywa przeładowanie strony.
2. Migawka wejścia powstaje w kontekście użytkownika, więc worker z kluczem serwisowym nie czyta notatek i nie omija RLS. Worker widzi tylko to, co użytkownik mógł zobaczyć.
3. Tylko kontener workera potrzebuje `uv` i semble, tekstów prawnych (`backend/regulations/<wersja>/sources/`) i plików promptów (`backend/ai/prompts/`, czytane przez `readFileSync` bez bundlera Next.js). Web nie importuje `@sarmata/ai`, kontrakty są w `@sarmata/domain`.
4. Jedna ścieżka zamiast dwóch: jeden dziennik, jeden zestaw kodów błędów.

## Konsekwencje

- Krótkie kontrole (jakość tekstu, strażnik) czekają na wolny worker (`SARMATA_WORKER_IDLE_DELAY_MS`). Deterministyczny strażnik słów kluczowych działa dalej od razu przy zapisie notatki.
- Wdrożenie ma jedną instancję workera, więc przebiegi idą po kolei, a drugi slot llama-servera zostaje na razie niewykorzystany. `claim` chroni przed podwójnym dostarczeniem po ponowieniu i po restarcie workera: przebieg `running` starszy niż 10 minut przejmuje kolejne dostarczenie.
- Porażka modelu kończy przebieg jako `failed` bez ponowień, użytkownik prosi od nowa. Błąd bazy rzuca wyjątek, więc pgmq dostarcza zadanie ponownie.
- Przebieg czekający w kolejce, gdy admin wyłączył AI, kończy się porażką `disabled` bez wywołania modelu.
- Klient wstawia przebieg tylko przez kolumny wejścia. Kolumny wyniku zapisuje wyłącznie worker (rola serwisowa).
- Treść przebiegów (wejście, wynik, komunikat porażki, tekst po edycji fragmentu) usuwa retencja notatek (B9), metadane zostają.

## Odrzucone

- **Krótkie usługi synchronicznie w żądaniu HTTP:** dwie ścieżki, dwa sposoby logowania i semble w obrazie aplikacji webowej.
- **Worker buduje migawkę sam kluczem serwisowym:** omija RLS, więc odbiorcy notatek byliby opisani w dwóch miejscach.
