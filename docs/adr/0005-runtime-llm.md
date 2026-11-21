# Runtime LLM: llama.cpp wszędzie, Bielik-One tam, gdzie jest vLLM albo MLX

Używamy wyłącznie modeli Bielik. Tekst generuje llama-server (llama.cpp, MIT) w przypiętej wersji, uruchamiany natywnie: CUDA przy NVIDIA, Vulkan z CPU w pozostałych przypadkach, Metal na macOS. Bielik-One (model decyzyjny w stylu Jev) oficjalnie działa tylko na vLLM (Linux z NVIDIA) i MLX (Apple Silicon), więc kreator instaluje go tylko tam. Na innym sprzęcie decyzje podejmuje model tekstowy przez wymuszony schemat JSON. Aplikacja zna tylko adresy API zgodnych z OpenAI, więc runtime da się wymienić.

Kreator wykrywa RAM i VRAM, krótko mierzy CPU i GPU, a potem proponuje tier: bez GPU Bielik-4.5B-v3.0 Q8, GPU 8 GB lub więcej albo Mac 16 GB Bielik-11B-v3.1 Q4_K_M, serwer wyższa kwantyzacja. AI da się całkowicie wyłączyć, a w profilu light (słaby sprzęt, jedno stanowisko) jest domyślnie wyłączone. Research: `docs/sources/ai-lokalne/FINDINGS.md`.

## Odrzucone

- Ollama, LM Studio, vLLM jako jedyny runtime i inne silniki: porównanie w FINDINGS.
- Bielik-Minitron i Bielik-Guard: decyzja właściciela produktu (Minitron odpada, Guard nie jest wart zasobów).
- Własny endpoint decyzyjny na społecznościowym GGUF Bielik-One: kalibracja niesprawdzona.
