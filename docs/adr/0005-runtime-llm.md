# Runtime LLM: llama.cpp wszędzie, Bielik-One tam, gdzie jest vLLM albo MLX

Używamy wyłącznie modeli Bielik. Tekst generuje llama-server (llama.cpp, MIT) w przypiętej wersji, uruchamiany natywnie: CUDA przy NVIDIA, Vulkan z CPU w pozostałych przypadkach, Metal na macOS. Bielik-One (model decyzyjny w stylu Jev) oficjalnie działa tylko na vLLM (Linux z NVIDIA) i MLX (Apple Silicon), więc kreator instaluje go tylko tam. Na innym sprzęcie decyzje podejmuje model tekstowy przez wymuszony schemat JSON. Aplikacja zna tylko adresy API zgodnych z OpenAI, więc runtime da się wymienić.

Kreator wykrywa RAM i VRAM, krótko mierzy CPU i GPU, a potem proponuje tier: bez GPU Bielik-4.5B-v3.0 Q8_0, Mac poniżej 24 GB albo karta od 8 do 11 GB Bielik-4.5B-v3.0 Q4_K_M (tier szybki), Mac od 24 GB albo karta od 12 GB Bielik-11B-v3.1 Q4_K_M, serwer na tym sprzęcie wyższa kwantyzacja 11B. AI da się całkowicie wyłączyć, a w profilu light (słaby sprzęt, jedno stanowisko) jest domyślnie wyłączone. Research: `docs/sources/ai-lokalne/FINDINGS.md`.

## Tier szybki: Bielik-4.5B Q4_K_M poniżej Maca 24 GB i karty 12 GB

Pomiar na M2 z 16 GB (llama.cpp, Metal, Bielik-11B Q4_K_M): przetwarzanie promptu 90 do 140 tokenów na sekundę, generowanie 8 do 10 tokenów na sekundę, pełny szkic arkusza (około 1600 tokenów wyjścia jednym wywołaniem) trwał około 4 minut. Generowanie ogranicza przepustowość pamięci, więc model o połowę mniejszy generuje około 2 razy szybciej (szacunek 18 do 20 tokenów na sekundę dla 4.5B Q4_K_M na M2). Decyzja właściciela produktu: na takim sprzęcie domyślny jest Bielik-4.5B-v3.0 Q4_K_M, za cenę trochę słabszej polszczyzny. Bielik-11B jest domyślny dopiero na sprzęcie wyraźnie lepszym: Mac od 24 GB (pamięć 24576 MiB, próg w kodzie 23 GiB) albo karta od 12 GB (12282 MiB, próg 11,5 GiB). Na Macu z 16 GB lista wyboru to Bielik-4.5B Q4_K_M, potem Bielik-11B Q4_K_M i większe pliki 11B. Na Macu nie proponujemy Bielik-4.5B Q8_0, bo Q4_K_M tego samego modelu jest na Metal szybszy, a pamięć lepiej wykorzystać na 11B. Przełączenie w dev: `pnpm ai:setup --model bielik-11b-v3.1-q4_k_m`.

SpeakLeash publikuje Bielik-4.5B-v3.0 w GGUF tylko jako Q8_0 i fp16. Plik Q4_K_M pochodzi z `second-state/Bielik-4.5B-v3.0-Instruct-GGUF` (Second State, LlamaEdge, kwantyzacja llama.cpp z `speakleash/Bielik-4.5B-v3.0-Instruct`, Apache 2.0): `Bielik-4.5B-v3.0-Instruct-Q4_K_M.gguf`, 2 878 886 912 bajtów, SHA-256 `39fb78db…6763e1`, przypięty do commitu `5ed9534f`. Ten sam plik z tą samą sumą leży w `gaianet/Bielik-4.5B-v3.0-Instruct-GGUF`. Weryfikacja jak przy plikach oficjalnych: rozmiar i SHA-256 z API Hugging Face, sprawdzane po pobraniu.

Krótsze wyjście ma większy wpływ niż sam model. Szkic arkusza powstaje wywołaniami po jednym kryterium (najwyżej 2 zdania i poziom), a potem jednym krótkim wywołaniem na uzasadnienie, wnioski IPRZ i pytania. Pełny szkic to około 400 do 600 tokenów wyjścia zamiast 1600. Przygotowanie rozmowy i sygnały HR mają listy z limitem pozycji w schemacie i niski `max_tokens`. Wszystkie wywołania szkicu zaczynają się tym samym tekstem (skala, kryteria, notatki), więc llama-server przetwarza go raz (`cache_prompt`), a kolejne wywołania tylko krótką końcówkę. Szacunek na M2 z 16 GB dla Bielik-4.5B Q4_K_M (18 do 20 tok/s, prompt 90 do 140 tok/s, ostrożnie jak dla 11B): przy 5 kryteriach i około 1100 tokenach wspólnego początku pierwsze zdanie widać po około 10 do 15 sekundach, pierwsze pełne kryterium po około 12 do 17 sekundach, cały szkic po około 35 do 45 sekundach. Przebieg streamuje wyjście do `ai_runs` (ADR 0008).

## Budżet pamięci i próg dla Bielik-One

Na Macu GPU korzysta z pamięci zunifikowanej, ale macOS pozwala mu użyć tylko części (`recommendedMaxWorkingSetSize`): około dwóch trzecich do 32 GB i trzech czwartych powyżej. Reszta zostaje dla systemu, przeglądarki i Dockera. Kreator liczy więc budżet GPU Maca jako 2/3 albo 3/4 pamięci (M2 16 GB: 10,7 GB), a przy NVIDIA jako pamięć największej karty.

Bielik-One instaluje się tylko wtedy, gdy na stałe mieści się w tym budżecie razem z modelem tekstowym: wagi modelu tekstowego, 2 GB na jego pamięć podręczną KV i bufory (kontekst 8k Bielika-11B to 1,6 GB w f16, w profilu server 4 GB) oraz pakiet Bielik-One w precyzji bfloat16, w której go skalibrowano (MLX: 4B około 9 GB, 11B około 26 GB, vLLM: 13 i 31 GB według README bielik-one). Wynikające progi:

| Sprzęt | Model tekstowy | Bielik-One |
| --- | --- | --- |
| Mac 16 GB (np. M2) | Bielik-4.5B Q4_K_M | nie naraz: 2,7 + 2 + 9 = 13,7 GB przy budżecie 10,7 GB, decyzje przez model tekstowy |
| Mac 24 GB | Bielik-11B Q4_K_M | nie naraz: 6,3 + 2 + 9 = 17,3 GB przy budżecie 16 GB, decyzje przez model tekstowy |
| Mac 32 i 36 GB | Bielik-11B Q4_K_M | 4B na MLX (budżet 21,3 i 27 GB) |
| Mac od 48 GB | Bielik-11B Q4_K_M | 11B na MLX (34,3 GB przy budżecie 36 GB) |
| NVIDIA 8 GB | Bielik-4.5B Q4_K_M | brak, 4B na vLLM sam potrzebuje 13 GB |
| NVIDIA 12 GB | Bielik-11B Q4_K_M | brak, próg to karta 24 GB |
| NVIDIA 16 GB | Bielik-11B Q4_K_M | nie naraz, decyzje przez model tekstowy |
| NVIDIA 24 GB | Bielik-11B Q4_K_M | 4B na vLLM (21,3 GB) |
| NVIDIA 48 GB, profil server | Bielik-11B Q8_0 | 11B na vLLM (11,1 + 4 + 31 = 46,1 GB) |

Rekomendacja (`recommendRuntime`) podaje sposób działania Bielik-One w polu `bielikOnePlan`: `concurrent` (na stałe obok modelu tekstowego, to samo co `bielikOne`) albo `text-only`. Bielik-One działa tylko tam, gdzie mieści się równocześnie z modelem tekstowym. Trybu przełączanego nie ma: pomiar na M2 pokazał decyzję w 94 do 119 s przez Bielik-One wobec 13 s przez model tekstowy, przy silnym swapie. `--with-bielik-one` zostaje jawnym wyborem do testów.

Na Macu z 16 GB instaluje się więc tylko model tekstowy (Bielik-4.5B Q4_K_M), a decyzje podejmuje on z wymuszonym schematem JSON (`@sarmata/ai`). Kreator i `pnpm ai:setup` zawsze piszą po polsku, który wariant wybrały i dlaczego, z potrzebną pamięcią, dostępnym budżetem i progiem, od którego oba modele mieszczą się naraz. Bielik-One nigdy nie znika po cichu. W profilu server na Macu 16 GB obowiązuje ten sam tier szybki (Bielik-4.5B Q4_K_M).

Rozważone i odrzucone dla 16 GB: kwantyzacja Bielik-One na MLX (4 albo 8 bitów). Backend MLX bielik-one w przypiętej wersji podpina LoRA tylko do warstw `nn.Linear` bez kwantyzacji, a `calibration.json` wprost wyklucza serwowanie po kwantyzacji bez osobnego sprawdzenia (przy FP8 na vLLM zmienia się 2 do 18% decyzji blisko granicy). Wymagałoby to łatki na kod bielik-one i własnej walidacji kalibracji, więc decyzja właściciela produktu: na 16 GB sam model tekstowy.

Do testów na słabszym Macu `pnpm ai:setup --with-bielik-one` instaluje mimo to Bielik-One 4B (MLX mieści go samego: 9 z 10,7 GB) z ostrzeżeniem, że modele działają tylko pojedynczo (`pnpm ai:start --only text|decision`), a `pnpm ai:smoke` sprawdza każdy endpoint osobno. Model bazowy Bielik-One 11B (`speakleash/Bielik-11B-v3.1-Instruct`) jest bramkowany (konto Hugging Face i akceptacja licencji), model bazowy 4B (`Qwen/Qwen3.5-4B`) nie.

## Pobieranie raz na maszynę

Wszystkie pliki AI leżą w jednym katalogu danych na konto i system: `~/Library/Application Support/sarmata/ai` na macOS, `$XDG_DATA_HOME/sarmata/ai` (domyślnie `~/.local/share/sarmata/ai`) na Linuksie i w WSL, `%LOCALAPPDATA%\sarmata\ai` na Windows. Korzystają z niego wszystkie worktree, kreator i skrypty `pnpm ai:*`: llama.cpp, modele GGUF, pamięć podręczna Hugging Face dla Bielik-One (`HF_HOME=<katalog>/huggingface`), środowisko Pythona Bielik-One i logi. `.env.ai.local` w worktree zawiera tylko adresy. Modele nie trafiają do obrazów Dockera ani do repozytorium: aplikacja w kontenerze łączy się z natywnym runtime przez HTTP, więc żaden kontener nie montuje modeli. Ponowne uruchomienie z dowolnego worktree pomija pliki ze zgodnym SHA-256, liczy sumę pliku bez znacznika `.sha256` zamiast pobierać go jeszcze raz, wznawia przerwany plik `.part` żądaniem HTTP Range, a blokada `.lock` z numerem procesu nie pozwala dwóm worktree pisać tego samego pliku. Pliki Bielik-One pobiera i wznawia `huggingface_hub` według etagów. Windows i WSL to dwa systemy, więc każdy ma własny katalog, ale kreator na Windows uruchamia runtime natywnie, poza WSL.

## Odrzucone

- Ollama, LM Studio, vLLM jako jedyny runtime i inne silniki: porównanie w FINDINGS.
- Bielik-Minitron i Bielik-Guard: decyzja właściciela produktu (Minitron odpada, Guard nie jest wart zasobów).
- Własny endpoint decyzyjny na społecznościowym GGUF Bielik-One: kalibracja niesprawdzona.
- Bielik-One skwantyzowany na MLX, żeby zmieścił się obok modelu tekstowego na Macu 16 GB: wymaga łatki na bielik-one i nowej walidacji kalibracji (sekcja wyżej).
