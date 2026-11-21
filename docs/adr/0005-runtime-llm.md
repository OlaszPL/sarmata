# Runtime LLM: llama.cpp wszędzie, Bielik-One tam, gdzie jest vLLM albo MLX

Używamy wyłącznie modeli Bielik. Tekst generuje llama-server (llama.cpp, MIT) w przypiętej wersji, uruchamiany natywnie: CUDA przy NVIDIA, Vulkan z CPU w pozostałych przypadkach, Metal na macOS. Bielik-One (model decyzyjny w stylu Jev) oficjalnie działa tylko na vLLM (Linux z NVIDIA) i MLX (Apple Silicon), więc kreator instaluje go tylko tam. Na innym sprzęcie decyzje podejmuje model tekstowy przez wymuszony schemat JSON. Aplikacja zna tylko adresy API zgodnych z OpenAI, więc runtime da się wymienić.

Kreator wykrywa RAM i VRAM, krótko mierzy CPU i GPU, a potem proponuje tier: bez GPU Bielik-4.5B-v3.0 Q8, GPU 8 GB lub więcej albo Mac 16 GB Bielik-11B-v3.1 Q4_K_M, serwer wyższa kwantyzacja. AI da się całkowicie wyłączyć, a w profilu light (słaby sprzęt, jedno stanowisko) jest domyślnie wyłączone. Research: `docs/sources/ai-lokalne/FINDINGS.md`.

## Budżet pamięci i próg dla Bielik-One

Na Macu GPU korzysta z pamięci zunifikowanej, ale macOS pozwala mu użyć tylko części (`recommendedMaxWorkingSetSize`): około dwóch trzecich do 32 GB i trzech czwartych powyżej. Reszta zostaje dla systemu, przeglądarki i Dockera. Kreator liczy więc budżet GPU Maca jako 2/3 albo 3/4 pamięci (M2 16 GB: 10,7 GB), a przy NVIDIA jako pamięć największej karty.

Bielik-One instaluje się tylko wtedy, gdy na stałe mieści się w tym budżecie razem z modelem tekstowym: wagi modelu tekstowego, 2 GB na jego pamięć podręczną KV i bufory (kontekst 8k Bielika-11B to 1,6 GB w f16, w profilu server 4 GB) oraz pakiet Bielik-One w precyzji bfloat16, w której go skalibrowano (MLX: 4B około 9 GB, 11B około 26 GB, vLLM: 13 i 31 GB według README bielik-one). Wynikające progi:

| Sprzęt | Model tekstowy | Bielik-One |
| --- | --- | --- |
| Mac 16 GB (np. M2) | Bielik-11B Q4_K_M | brak: 6,3 + 2 + 9 = 17,3 GB przy budżecie 10,7 GB |
| Mac 24 GB | Bielik-11B Q4_K_M | brak: budżet 16 GB |
| Mac 32 i 36 GB | Bielik-11B Q4_K_M | 4B na MLX (budżet 21,3 i 27 GB) |
| Mac od 48 GB | Bielik-11B Q4_K_M | 11B na MLX (34,3 GB przy budżecie 36 GB) |
| NVIDIA 12 GB | Bielik-11B Q4_K_M | brak, próg to karta 24 GB |
| NVIDIA 24 GB | Bielik-11B Q4_K_M | 4B na vLLM (21,3 GB) |
| NVIDIA 48 GB, profil server | Bielik-11B Q8_0 | 11B na vLLM (11,1 + 4 + 31 = 46,1 GB) |

Na Macu z 16 GB instaluje się więc tylko model tekstowy w dobrej jakości (Bielik-11B Q4_K_M), a decyzje podejmuje on z wymuszonym schematem JSON (`@sarmata/ai`). Kreator i `pnpm ai:setup` zawsze piszą po polsku, który wariant wybrały i dlaczego, z potrzebną pamięcią, dostępnym budżetem i progiem, od którego oba modele mieszczą się naraz. Bielik-One nigdy nie znika po cichu. Z tego samego budżetu wynika model w profilu server na Macu 16 GB: Q4_K_M zamiast Q5_K_M.

Rozważone i odrzucone dla 16 GB: kwantyzacja Bielik-One na MLX (4 albo 8 bitów). Backend MLX bielik-one w przypiętej wersji podpina LoRA tylko do warstw `nn.Linear` bez kwantyzacji, a `calibration.json` wprost wyklucza serwowanie po kwantyzacji bez osobnego sprawdzenia (przy FP8 na vLLM zmienia się 2 do 18% decyzji blisko granicy). Wymagałoby to łatki na kod bielik-one i własnej walidacji kalibracji, więc decyzja właściciela produktu: na 16 GB sam model tekstowy.

Do testów na słabszym Macu `pnpm ai:setup --with-bielik-one` instaluje mimo to Bielik-One 4B (MLX mieści go samego: 9 z 10,7 GB) z ostrzeżeniem, że modele działają tylko pojedynczo (`pnpm ai:start --only text|decision`), a `pnpm ai:smoke` sprawdza każdy endpoint osobno. Model bazowy Bielik-One 11B (`speakleash/Bielik-11B-v3.1-Instruct`) jest bramkowany (konto Hugging Face i akceptacja licencji), model bazowy 4B (`Qwen/Qwen3.5-4B`) nie.

## Pobieranie raz na maszynę

Wszystkie pliki AI leżą w jednym katalogu danych na konto i system: `~/Library/Application Support/sarmata/ai` na macOS, `$XDG_DATA_HOME/sarmata/ai` (domyślnie `~/.local/share/sarmata/ai`) na Linuksie i w WSL, `%LOCALAPPDATA%\sarmata\ai` na Windows. Korzystają z niego wszystkie worktree, kreator i skrypty `pnpm ai:*`: llama.cpp, modele GGUF, pamięć podręczna Hugging Face dla Bielik-One (`HF_HOME=<katalog>/huggingface`), środowisko Pythona Bielik-One i logi. `.env.ai.local` w worktree zawiera tylko adresy. Modele nie trafiają do obrazów Dockera ani do repozytorium: aplikacja w kontenerze łączy się z natywnym runtime przez HTTP, więc żaden kontener nie montuje modeli. Ponowne uruchomienie z dowolnego worktree pomija pliki ze zgodnym SHA-256, liczy sumę pliku bez znacznika `.sha256` zamiast pobierać go jeszcze raz, wznawia przerwany plik `.part` żądaniem HTTP Range, a blokada `.lock` z numerem procesu nie pozwala dwóm worktree pisać tego samego pliku. Pliki Bielik-One pobiera i wznawia `huggingface_hub` według etagów. Windows i WSL to dwa systemy, więc każdy ma własny katalog, ale kreator na Windows uruchamia runtime natywnie, poza WSL.

## Odrzucone

- Ollama, LM Studio, vLLM jako jedyny runtime i inne silniki: porównanie w FINDINGS.
- Bielik-Minitron i Bielik-Guard: decyzja właściciela produktu (Minitron odpada, Guard nie jest wart zasobów).
- Własny endpoint decyzyjny na społecznościowym GGUF Bielik-One: kalibracja niesprawdzona.
- Bielik-One skwantyzowany na MLX, żeby zmieścił się obok modelu tekstowego na Macu 16 GB: wymaga łatki na bielik-one i nowej walidacji kalibracji (sekcja wyżej).
