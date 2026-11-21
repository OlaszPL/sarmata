# Wszystkie wywołania AI przez kolejkę

Każda usługa AI (szkic arkusza, kontrola jakości, strażnik danych wrażliwych, przygotowanie rozmowy, propozycje kryteriów, momenty docenienia, sygnały HR partnera, asystent procedury) działa tak samo. Serwis `ai` w procesie Next.js, z JWT użytkownika, zbiera migawkę wejścia przez RLS i zapisuje przebieg `queued` w tabeli `ai_runs`. Trigger wysyła zadanie `ai.run` do pgmq. Worker przejmuje przebieg (`claim`), woła moduł `AiRunner` z `@sarmata/ai` i zapisuje wynik albo porażkę. Front odpytuje `ai.get(id)`. Tabela `ai_runs` jest naraz dziennikiem użycia AI i stanem zadania.

## Dlaczego

1. Lokalny Bielik na CPU pisze szkic arkusza minutami. Kolejka nie trzyma żądania HTTP i przeżywa przeładowanie strony.
2. Migawka wejścia powstaje w kontekście użytkownika, więc worker z kluczem serwisowym nie czyta notatek i nie omija RLS. Worker widzi tylko to, co użytkownik mógł zobaczyć.
3. Tylko kontener workera potrzebuje `uv` i semble, tekstów prawnych (`backend/regulations/<wersja>/sources/`) i plików promptów (`backend/ai/prompts/`, czytane przez `readFileSync` bez bundlera Next.js). Web nie importuje `@sarmata/ai`, kontrakty są w `@sarmata/domain`.
4. Jedna ścieżka zamiast dwóch: jeden dziennik, jeden zestaw kodów błędów.

## Konsekwencje

- Krótkie kontrole (jakość tekstu, strażnik) czekają na wolny worker (`SARMATA_WORKER_IDLE_DELAY_MS`). Deterministyczny strażnik słów kluczowych działa dalej od razu przy zapisie notatki, a strażnik AI to osobna kontrola przed zapisem (`notes.check`), której brak wyniku nie blokuje zapisu.
- Wdrożenie ma jedną instancję workera, więc przebiegi idą po kolei, a drugi slot llama-servera zostaje na razie niewykorzystany. `claim` chroni przed podwójnym dostarczeniem po ponowieniu i po restarcie workera: przebieg `running` starszy niż 3 minuty, którego worker tak samo długo nie zapisał postępu, przejmuje kolejne dostarczenie.
- Porażka modelu kończy przebieg jako `failed` bez ponowień, użytkownik prosi od nowa. Błąd bazy rzuca wyjątek, więc pgmq dostarcza zadanie ponownie.
- Przebieg czekający w kolejce, gdy admin wyłączył AI, kończy się porażką `disabled` bez wywołania modelu.
- Klient wstawia przebieg tylko przez kolumny wejścia. Kolumny wyniku zapisuje wyłącznie worker (rola serwisowa).
- Treść przebiegów (wejście, wynik, komunikat porażki, tekst po edycji fragmentu) usuwa retencja notatek (B9), metadane zostają.

## Postęp przebiegu (streaming)

Długie usługi (szkic arkusza, przygotowanie rozmowy, sygnały HR) streamują odpowiedź modelu (`stream: true` w API zgodnym z OpenAI, zdarzenia SSE parsuje `@sarmata/ai`). Wynik końcowy dalej przechodzi walidację schematem JSON. Worker zapisuje stan przebiegu w `ai_runs` najwyżej raz na sekundę (pierwszy zapis od razu, potem najnowszy stan, pośrednie są pomijane):

- `partial_text`: surowy tekst bieżącego wywołania modelu (JSON w trakcie pisania),
- `partial_output`: gotowa część wyniku zgodna z `aiPartialOutputSchemas` z `@sarmata/domain`. Parser częściowego JSON bierze tylko domknięte elementy list i pola, więc front pokazuje całe zdania, nigdy urwane. W szkicu arkusza są to gotowe kryteria i gotowe zdania bieżącego kryterium, w sygnałach HR najpierw rozstrzygnięte sygnały, potem pytania i działania,
- `output_tokens`: tokeny wyjścia wszystkich wywołań przebiegu,
- `progress_updated_at`: czas zapisu, zarazem puls workera dla `claim`.

Po zakończeniu worker zeruje `partial_text` i `partial_output` (wynik jest w `output`), a `output_tokens` zostaje jako metadana użycia. Treść postępu istnieje więc tylko podczas działania przebiegu, retencja B9 nie musi jej osobno czyścić, poza przebiegiem, który utknął w `running`. Zapis postępu jest best effort: błąd zapisu trafia do logu, a przebieg działa dalej. Zapis po `finish` nic nie zmienia (warunek `status = 'running'`). Front odpytuje `ai.get(id)` mniej więcej co sekundę. Kolumny są zwykłymi kolumnami wiersza, więc da się je też subskrybować przez Supabase Realtime, ale polling wystarcza i nie wymaga publikacji tabeli.

Szkic arkusza nie jest już jednym dużym JSON-em: osobne krótkie wywołanie dla każdego kryterium, potem jedno na uzasadnienie, wnioski IPRZ i pytania (ADR 0005). Pierwsze kryterium jest gotowe po kilkunastu sekundach, a wywołanie urwane na limicie `max_tokens` zachowuje swoje gotowe zdania.

## Odrzucone

- **Krótkie usługi synchronicznie w żądaniu HTTP:** dwie ścieżki, dwa sposoby logowania i semble w obrazie aplikacji webowej.
- **Worker buduje migawkę sam kluczem serwisowym:** omija RLS, więc odbiorcy notatek byliby opisani w dwóch miejscach.
- **Zapis postępu przy każdym tokenie:** 10 do 20 zapisów na sekundę na przebieg obciąża bazę bez widocznej różnicy w interfejsie.
- **Streaming z llama-servera prosto do przeglądarki:** omija kolejkę, RLS migawki i dziennik użycia.
