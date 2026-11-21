# AI lokalne: runtime i modele Bielik

Stan na 21.11.2026. Dwie części: porównanie silników uruchomieniowych (część 1) i rodzina modeli Bielik z Bielik-One (część 2). Decyzje: `docs/adr/0005-runtime-llm.md`.

# Część 1. Runtime


Cel: wybrać silnik inferencji dla opcjonalnego lokalnego modelu (Bielik, PLLuM) w aplikacji Next.js + Supabase. Wymagania: Windows, Linux i macOS, CPU oraz GPU NVIDIA, AMD, Intel i Apple, licencja bez opłat z prawem redystrybucji, API zgodne z OpenAI, instalacja bez Dockera, modele GGUF 4B do 12B, aktywny rozwój.

Uzupełnia `docs/sources/it-administracji/FINDINGS.md` sekcja 4.4 (rozmiary plików GGUF, licencje modeli). Tych danych tu nie powtarzam.

Oznaczenia: [P] źródło pierwotne (repozytorium, dokumentacja, regulamin), [S] źródło wtórne, [O] własna ocena lub szacunek. Numery w nawiasach kwadratowych odsyłają do listy źródeł na końcu.

## 1. Tabela porównawcza

| Silnik | Licencja | OS | GPU | Autowybór backendu | API OpenAI | Instalacja | Bielik i PLLuM GGUF | Ostatnie wydanie | Ocena |
|---|---|---|---|---|---|---|---|---|---|
| **llama.cpp (llama-server)** | MIT [1] | Windows x64 i arm64, Linux, macOS [2] | CPU, CUDA 12.4 i 13.5, Vulkan, ROCm 10.0, SYCL, OpenVINO, Metal [2] | Tak. Ładuje biblioteki backendów w czasie działania [6][7]. Skrypt llama.app wybiera CUDA, potem ROCm, potem Vulkan, potem CPU [10] | Pełne: chat, completions, responses, embeddings, JSON schema, narzędzia, obrazy, do tego API Anthropic [12] | Paczka zip (bez instalatora), winget, skrypt PowerShell, Homebrew [2][9][10] | Natywnie, oficjalne GGUF Bielika [48] | v1.0.0 z 13.11.2026, nocne buildy codziennie (b12606 z 21.11.2026) [2][3] | **Wybór główny** |
| Ollama | MIT [17] | Windows, Linux, macOS [18][19] | CUDA, ROCm v7, Vulkan, Metal [20] | Tak, Vulkan domyślnie włączony [20] | Chat, streaming, JSON, narzędzia, obrazy base64. Bez `tool_choice` i obrazów przez URL [21] | OllamaSetup.exe bez uprawnień admina, zip do usługi [19] | Tak, przez `hf.co/...` [48] | v0.40.17 z 10.11.2026 [18] | **Zapasowy** |
| Lemonade (AMD) | Apache-2.0 [46] | Windows 11, Linux, macOS [46] | llama.cpp: CUDA, Vulkan, ROCm, CPU, Metal, do tego NPU AMD [46] | Częściowo, `lemonade backends` pokazuje backendy dostępne na komputerze [46] | OpenAI, Anthropic i Ollama [46] | MSI, deb, rpm, pkg, wersja embeddable zip [47] | Tak (GGUF przez llama.cpp) [46] | 2026.47.1 z 18.11.2026 [47] | Alternatywa dla floty AMD |
| llamafile (Mozilla.ai) | Apache-2.0 i MIT [23] | Windows, Linux, macOS [23] | CUDA, ROCm, Vulkan [24] | Częściowo, powrót do CPU po błędzie GPU [24] | Serwer llama.cpp [24] | Jeden plik wykonywalny, na Windows limit 4 GB [23] | Tak, zewnętrzne GGUF [23] | 0.10.6 z 15.09.2026, bazuje na b10441 [24] | Odrzucony: opóźnienie wobec llama.cpp |
| LM Studio / lms | Własnościowa, darmowa także w pracy [25][26] | Nie badano | Nie badano | Nie badano | Nie badano | Instalator GUI, bez prawa dystrybucji [25] | Nie badano | Regulamin z 23.08.2026 [25] | **Odrzucony: licencja** |
| KoboldCpp | AGPL-3.0 [27] | Windows, Linux, macOS [27] | CUDA, Vulkan, ROCm ze źródeł, Metal [27] | Nie, flagi `--usecuda` i `--usevulkan` [27] | `/v1`, narzędzia, obrazy przez mmproj [27] | Jeden exe [27] | Tak, fork llama.cpp [O] | 1.124.2 z 31.10.2026 [28] | Odrzucony: copyleft AGPL, profil hobbystyczny |
| LocalAI | MIT [29] | Linux, macOS. Windows tylko przez kontener [29] | CUDA, ROCm, SYCL, Vulkan, Metal [29] | Tak [29] | Szerokie, z narzędziami i gramatykami [29] | Skrypt, kontener [29] | Tak, backend llama.cpp [29] | v5.0.1 z 20.11.2026 [29] | Odrzucony: brak natywnego Windows |
| Jan | Apache-2.0 [31] | Windows, Linux, macOS [30] | CPU, Vulkan, Metal, CUDA 12 i 13, HIP [30] | Nie badano | Serwer `localhost:1337` [30] | Aplikacja desktopowa [30] | Tak, silnik llama.cpp [30] | v0.8.8 z 28.10.2026 (API GitHub) | Odrzucony: aplikacja GUI, nie usługa |
| vLLM | Apache-2.0 (API GitHub) | Tylko Linux, Windows przez WSL [32] | CUDA, ROCm, Intel XPU, CPU [32] | Nie badano | Nie badano | Nie badano | Model źródłowy tak (FINDINGS 4.2), o GGUF dokumentacja milczy [32] | Push 21.11.2026 (API GitHub) | Odrzucony: brak Windows |
| SGLang | Apache-2.0 (API GitHub) | Linux z NVIDIA i CUDA 13 [33] | CUDA [33] | Nie badano | Nie badano | pip, kontener [33] | Model źródłowy tak (FINDINGS 4.2) | Push 21.11.2026 (API GitHub) | Odrzucony: brak Windows |
| MLC-LLM / WebLLM | Apache-2.0 [34][35] | Windows, Linux, macOS, przeglądarka [34] | Vulkan, CUDA, ROCm, Metal, WebGPU [34] | Nie badano | REST zgodny z OpenAI [34] | Kompilacja modelu pod silnik [34] | O GGUF strona milczy, modele kompilowane pod MLCEngine [34] | Push 21.11.2026 (API GitHub) | Odrzucony: brak GGUF |
| mistral.rs | MIT [36] | Windows (skrypt PowerShell), Linux, macOS [36] | CUDA, Metal, CPU. Vulkan i ROCm niewymienione [36] | Nie badano | `/v1`, narzędzia ze schematem [36] | Skrypt PowerShell [36] | Tak, GGUF [36] | v0.9.5 z 19.10.2026 (API GitHub) | Odrzucony: brak AMD i Intel GPU |
| ONNX Runtime GenAI | Nie badano | Nie badano | CUDA, DirectML, WebGPU, OpenVINO, QNN [37] | Nie badano | Strona nie wspomina o serwerze HTTP [37] | Biblioteka [37] | Nie, modele ONNX [37] | Nie badano | Odrzucony: brak serwera i GGUF |
| Foundry Local (Microsoft) | SDK MIT, CLI Microsoft Software License Terms [39] | Windows, macOS, Linux [38] | GPU i NPU przez ONNX Runtime [38] | Tak [38] | Tak, z Responses API [38] | SDK, CLI | Nie, kurowany katalog ONNX [38] | GA 9.04.2026 [40] | Odrzucony: brak Bielika, licencja CLI |
| OpenVINO Model Server | Apache-2.0 [42] | Windows (binarka), Linux [42] | Tylko Intel: CPU, iGPU, dGPU, NPU [42] | Nie | Chat, streaming, structured output [42] | Binarka zip [42] | GGUF tylko dla wybranych architektur (Qwen2.5, Llama 3.x) [43] | v2026.4.1 z 06.10.2026 | Odrzucony: tylko Intel |
| Docker Model Runner | Apache-2.0 (API GitHub) | Windows przez Docker Desktop, Linux przez Docker Engine [44] | Windows: tylko NVIDIA. Vulkan tylko na Linuksie [44] | Tak | OpenAI i Ollama [44] | Wymaga Dockera [44] | GGUF trafia do llama.cpp [44] | v1.2.9 z 22.10.2026 (API GitHub) | **Odrzucony: Docker Desktop płatny dla administracji** [45] |
| Windows ML z llama.cpp | Microsoft | Windows | AMD, Intel, NVIDIA, Qualcomm [41] | Tak [41] | Tak, lokalny endpoint `/v1` [41] | NuGet, wersja eksperymentalna [41] | GGUF z Hugging Face [41] | Eksperymentalne od 7.10.2026 [41] | Obserwować, za wcześnie |

Uwaga [O]: Ollama, LM Studio, Jan, KoboldCpp, llamafile, LocalAI, Lemonade, Docker Model Runner i Windows ML używają pod spodem llama.cpp [17][30][41][44][46]. Żaden z nich nie daje szerszego wsparcia sprzętu niż sam llama.cpp. Dodają warstwę zarządzania modelami i własne ograniczenia.

## 2. llama.cpp w szczegółach

### 2.1. Dystrybucja

- Pierwsze stabilne wydanie v1.0.0 z 13.11.2026. Wersjonowanie semantyczne, zmiany łamiące API tylko przy zmianie numeru głównego. [P] [3][4]
- Wydania stabilne to znacznik na jednym z nocnych buildów. v1.0.0 odpowiada buildowi b12359. [P] [3][5]
- Nocne buildy `bNNNN` z gałęzi master. Najnowszy b12606 z 21.11.2026. [P] [2][5]
- Paczki dla Windows: `win-cpu-x64`, `win-vulkan-x64`, `win-cuda-12.4-x64`, `win-cuda-13.5-x64` z osobnym `cudart`, `win-rocm-10.0-x64`, `win-sycl-x64`, `win-openvino-2026.4.1-x64`, także arm64. Brak instalatora MSI lub EXE, tylko zip. [P] [2]
- Linux: `ubuntu-x64`, `ubuntu-vulkan-x64`, CUDA 12.8 i 13.5, ROCm 10.0, SYCL, OpenVINO. macOS: `macos-arm64` z Metal. [P] [2]
- `winget install llama.cpp` (identyfikator `ggml.llamacpp`) instaluje paczkę `win-vulkan`. [P] [8][9]
- Skrypt `irm https://llama.app/install.ps1 | iex` sprawdza kolejno CUDA, ROCm, Vulkan i CPU, pobiera jeden plik `llama.exe` dopasowany do sprzętu i instrukcji procesora. Instaluje do profilu użytkownika (`%LOCALAPPDATA%`). Przy karcie NVIDIA bez CUDA Toolkit pomija CUDA i przechodzi dalej, czyli do Vulkan. [P] [10]
- llama.app i winget publikują nocne buildy, nie wydania stabilne. Opiekunowie mają to na liście do zmiany. [P] [5]
- llama.app oferuje też aplikację desktopową dla macOS i Windows 11, autorstwa zespołu llama.cpp i Hugging Face. [P] [11]

### 2.2. Jeden program, backend wybierany w czasie działania

- Opcja `GGML_BACKEND_DL` buduje backendy jako osobne biblioteki ładowane w czasie działania. Ten sam program działa na maszynach z różnymi GPU. [P] [7]
- Oficjalne paczki są budowane z `GGML_BACKEND_DL=ON`, `GGML_NATIVE=OFF` i `GGML_CPU_ALL_VARIANTS=ON`. W paczce jest kilka wariantów biblioteki CPU (od SSE4.2 do AVX-512) i ładowany jest najlepszy dla procesora. [P] [6]
- Paczki Windows dla Vulkan, CUDA, ROCm i SYCL powstają jako sama biblioteka backendu (np. `ggml-vulkan.dll`, `ggml-cuda.dll`), do której dokładany jest `llama-server` i biblioteki CPU z paczki `win-cpu`. Paczka `win-vulkan` działa więc także bez GPU, na samym CPU. [P] [6]
- Wybór urządzenia: `--list-devices` wypisuje dostępne urządzenia, `--device` wskazuje, których użyć. [P] [12]
- Wniosek [O]: można zbudować jeden katalog z bibliotekami CPU, Vulkan i opcjonalnie CUDA. Na komputerze z kartą NVIDIA to samo GPU pojawi się wtedy prawdopodobnie dwa razy (przez CUDA i przez Vulkan), więc instalator powinien ustawić `--device`. Do sprawdzenia testem.

### 2.3. API serwera

- `/v1/chat/completions`, `/v1/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/models`, `/v1/audio/speech`, do tego `/v1/messages` zgodne z Anthropic. [P] [12]
- `response_format` przyjmuje `json_object` i `json_schema`, także w opakowaniu OpenAI `{"type":"json_schema","json_schema":{...}}`. [P] [12]
- Wywołania narzędzi w stylu OpenAI przez szablony Jinja, które są domyślnie włączone. [P] [12]
- Obrazy przez plik `mmproj`. Przy `-hf` pobierany jest automatycznie. [P] [12]
- Klucz API (`--api-key`), tryb routera z wieloma modelami (`--models-dir`, `--models-max`), metryki Prometheus. [P] [12]
- v1.0.0 wzmocniła bezpieczeństwo serwera: poprawki SSRF, CORS i DNS rebinding, narzędzia dostępne spoza localhost tylko po jawnej zgodzie. [P] [3]

### 2.4. Wydajność: Vulkan, CUDA, CPU

Liczby z `llama-bench`: pp512 to przetwarzanie promptu, tg128 to generowanie, w tokenach na sekundę.

| Sprzęt | Backend | Model | pp512 | tg128 | Źródło |
|---|---|---|---|---|---|
| RTX 3080 (starszy build) | CUDA | Llama 2 7B Q4_0 | 4499 | 131 | [P] [13] |
| RTX 3080 (starszy build) | Vulkan | Llama 2 7B Q4_0 | 1706 | 62 | [P] [13] |
| RTX 3080 (nowszy wpis) | Vulkan | Llama 2 7B Q4_0 | 4287 | 139 | [P] [13] |
| NVIDIA GB10, 15.03.2026 | CUDA | gpt-oss-20B MXFP4 | 4006 | 69,1 | [P] [14] |
| NVIDIA GB10, 15.03.2026 | Vulkan | gpt-oss-20B MXFP4 | 2070 | 56,8 | [P] [14] |
| Intel Iris Xe (iGPU) | Vulkan | Llama 2 7B Q4_0 | 51 do 106 | 5,9 do 8,3 | [P] [13] |
| Intel Arc B390 (iGPU) | Vulkan | Llama 2 7B Q4_0 | 1380 | 24,5 | [P] [13] |
| Intel i7-8550U, 8 wątków | CPU | Llama 2 7B Q4_0 | 16,3 | 6,4 | [S] [15] |
| AMD Ryzen AI 7 350, 8 wątków | CPU | Llama 2 7B Q4_0 | 35,8 | 10,3 | [S] [15] |
| GTX 1050 4 GB | CUDA | Llama 2 7B Q4_0 | 207 | 16,6 | [S] [15] |
| Intel UHD 620 | OpenCL | Llama 2 7B Q4_0 | 9,5 | 4,0 | [S] [15] |

- Na NVIDIA CUDA wygrywa w przetwarzaniu promptu we wszystkich testach z 2026 r. Generowanie przez Vulkan bywa zbliżone, ale nie zawsze. [P] [14]
- Na kartach AMD Vulkan w 2026 r. był szybszy od ROCm w testach Lemonade z llama.cpp. [S] [16]
- Ollama ostrzega, że przy iGPU obok karty dedykowanej Vulkan na iGPU bywa niestabilny. [P] [20]
- Wniosek [O]: na iGPU Intel generowanie jest zbliżone do CPU, bo oba korzystają z tej samej pamięci RAM. Zysk z Vulkan na iGPU to głównie kilkukrotnie szybsze wczytanie promptu, co ma znaczenie przy RAG z długim kontekstem. Starsze iGPU (UHD 6xx) mogą być wolniejsze od CPU, więc instalator powinien zmierzyć oba warianty.
- Szacunek [O]: generowanie skaluje się odwrotnie do rozmiaru wag. Bielik-11B Q4_K_M (6,72 GB) da na typowym biurowym CPU lub Iris Xe około 3 do 5 tokenów na sekundę. Model 4B w Q4_K_M (Bielik-One-4B, 2,78 GB [51]) około 8 do 14. Na karcie NVIDIA z 8 GB VRAM i więcej model 11B przekroczy 40 tokenów na sekundę.

## 3. Pozostałe silniki: najważniejsze fakty

- **Ollama:** instalator bez uprawnień administratora, katalog zmieniany przez `/DIR`. Do pracy jako usługa służy `ollama-windows-amd64.zip`, uruchamiany np. przez NSSM. Karty AMD wymagają osobnego `ollama-windows-amd64-rocm.zip`. [P] [19] Instalator Inno Setup przyjmuje `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`. [S] [22] NVIDIA od compute capability 5.0 i sterownika 550. [P] [20] Pliki Linux przekraczają 1 GB. [P] [18]
- **LM Studio:** od 07.2025 darmowe także w pracy. [P] [26] Regulamin z 23.08.2026 daje licencję niewyłączną i niezbywalną „solely for Your personal and / or internal business purposes”, zakazuje sublicencji, dystrybucji i „service bureau use” oraz integracji inaczej niż przez opublikowane interfejsy. [P] [25] Nie da się go dołączyć do produktu ani przenieść praw na zamawiającego.
- **KoboldCpp:** `koboldcpp.exe` (CUDA i Vulkan), `koboldcpp-nocuda.exe` (CPU i Vulkan), `koboldcpp-oldpc.exe`. [P] [27] AGPL-3.0 pozwala na redystrybucję, ale wymusza udostępnienie kodu zmian, także przy udostępnianiu przez sieć. [O]
- **llamafile:** rewitalizacja przez Mozilla.ai, wersja 0.10 z nowym systemem budowania. [P] [23] Wersja 0.10.6 bazuje na llama.cpp b10441, czyli około 2 tys. buildów za upstreamem (b12606). [P] [24][2]
- **LocalAI:** ponad 80 backendów, każdy jako osobny obraz. Skrypt instalacyjny tylko dla Linuksa i macOS. [P] [29]
- **Foundry Local:** katalog modeli jest celowo zamknięty, własne modele tylko w formacie ONNX. Projekt nie jest serwerem dla wielu użytkowników. [P] [38]
- **Docker Model Runner:** podmioty rządowe muszą kupić subskrypcję Docker Desktop. [P] [45] Na macOS dokumentacja nie wymienia Metal. [P] [44]
- **Lemonade:** tabela backendów wymienia Vulkan dla CPU x86 oraz iGPU i dGPU AMD, kart Intel nie wymienia. [P] [46] Badge platformy wskazuje Windows 11. [P] [46]

## 4. Zgodność z Bielikiem i PLLuM

- SpeakLeash publikuje oficjalne GGUF: Bielik-11B-v3.1, 11B-v3.0, Minitron-7B-v3.0, 4.5B-v3.0, 1.5B-v3.0 (aktualizacje 11.2026). [P] [49] Karta GGUF 11B-v3.1: „Use with llama.cpp or Ollama”, kwantyzacje bf16, Q4_K_M, Q5_K_M, Q6_K, Q8_0. [P] [48]
- Bielik-One-4B-r1 to model obraz i tekst na bazie Qwen3.5-4B, licencja apache-2.0. [P] [50] Społecznościowy GGUF (jglowa) ma pliki BF16, Q8_0 i Q4_K_M, ale bez `mmproj`, więc wizja przez llama.cpp wymaga własnej konwersji projektora. [P] [51] [O]
- PLLuM 2512 nie ma oficjalnych GGUF na koncie CYFRAGOVPL. [P] [54] Są społecznościowe kwantyzacje mradermacher dla 12B i 4B. [P] [52][53] Architektury bazowe (Mistral Nemo, Gemma 3) obsługuje llama.cpp, w tym szablony `mistral-v3-tekken` i `gemma`. [P] [12]
- Silniki oparte na llama.cpp uruchomią te pliki bez zmian. MLC-LLM, ONNX Runtime GenAI i Foundry Local wymagają konwersji, OpenVINO Model Server obsługuje GGUF tylko dla wybranych architektur. [P] [34][37][38][43]

## 5. Wniosek

**Wybór główny: llama.cpp (`llama-server`), przypięty do wydania stabilnego v1.0.0 (build b12359).** Nie ma lepszej opcji dla tych wymagań. Jest jedynym projektem, który jednocześnie ma licencję MIT, natywne paczki dla Windows, Linux i macOS, backendy dla wszystkich czterech producentów GPU, wybór backendu w czasie działania i najpełniejsze API OpenAI (JSON schema, narzędzia, obrazy). Wszystkie wygodniejsze nakładki są zbudowane na nim. [1][2][6][12]

Proponowane wdrożenie [O]:

1. Własny instalator (MSI lub Inno Setup, cichy tryb) z paczką `win-vulkan-x64`. Zawiera `llama-server`, warianty CPU i `ggml-vulkan.dll`, więc działa na CPU, Intel, AMD i NVIDIA. [2][6]
2. Opcjonalny dodatek NVIDIA: `ggml-cuda.dll` z paczki `win-cuda-12.4-x64` plus `cudart`, bo CUDA daje kilkukrotnie szybsze wczytanie promptu. [2][14]
3. Rejestracja jako usługa Windows (np. WinSW lub NSSM), nasłuch tylko na localhost lub z `--api-key`. [12][19]
4. Przy pierwszym uruchomieniu `--list-devices` i krótki `llama-bench`, który ustawia `--device` i liczbę warstw na GPU. [12][13]
5. Domyślny model zależny od sprzętu: bez GPU i na iGPU model 4B do 4,5B, przy GPU z co najmniej 8 GB VRAM Bielik-11B-v3.1 Q4_K_M. Na macOS paczka `macos-arm64` (Metal), na Linuksie `ubuntu-vulkan-x64`. [2][48]
6. Do szybkich testów u deweloperów wystarczy `winget install llama.cpp` lub skrypt llama.app (oba dają nocne buildy). [5][9][10]

**Zapasowy: Ollama.** Licencja MIT, instalator bez admina, Vulkan domyślnie, prosty import GGUF z Hugging Face. [17][19][20][48] Słabsze strony: niepełne API OpenAI (brak `tool_choice`, brak obrazów przez URL), osobna paczka dla AMD, duże pliki i funkcje chmurowe, które trzeba wyłączyć polityką. [17][18][19][21]

**Do obserwacji:** Lemonade (Apache-2.0, MSI, dobry na sprzęcie AMD z NPU) [46][47] oraz Windows ML z llama.cpp (eksperymentalne od 10.2026) [41].

**Odrzucone:** LM Studio (zakaz dystrybucji), Docker Model Runner (płatny Docker Desktop), vLLM i SGLang (tylko Linux), OpenVINO Model Server (tylko Intel), Foundry Local, ONNX Runtime GenAI i MLC-LLM (brak GGUF), mistral.rs (brak AMD i Intel GPU), LocalAI (brak natywnego Windows), llamafile (opóźnienie wobec llama.cpp i limit 4 GB), KoboldCpp (AGPL, brak trybu usługi), Jan (aplikacja GUI).

## Źródła

Daty wydań i aktywności z API GitHub (`https://api.github.com/repos/<właściciel>/<repozytorium>` oraz `/releases/latest`), odczyt 21.11.2026.

1. https://github.com/ggml-org/llama.cpp
2. https://github.com/ggml-org/llama.cpp/releases
3. https://github.com/ggml-org/llama.cpp/releases/tag/v1.0.0
4. https://huggingface.co/blog/ggml-org/llama-cpp-v1
5. https://github.com/ggml-org/ggml/discussions/1579
6. https://github.com/ggml-org/llama.cpp/blob/master/.github/workflows/release.yml
7. https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md
8. https://github.com/ggml-org/llama.cpp/blob/master/.github/workflows/winget.yml
9. https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md
10. https://llama.app/install.ps1
11. https://llama.app
12. https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
13. https://github.com/ggml-org/llama.cpp/discussions/10879
14. https://forums.developer.nvidia.com/t/vulkan-as-alternative-backend-for-llama-cpp/363516
15. https://www.mgroeber.de/benchmarking-llamacpp-on-legacy-hardware-2.html
16. https://www.phoronix.com/review/lemonade-vulkan-rocm
17. https://github.com/ollama/ollama
18. https://github.com/ollama/ollama/releases
19. https://docs.ollama.com/windows
20. https://docs.ollama.com/gpu
21. https://docs.ollama.com/api/openai-compatibility
22. https://community.chocolatey.org/packages/Ollama
23. https://github.com/mozilla-ai/llamafile
24. https://github.com/mozilla-ai/llamafile/releases
25. https://lmstudio.ai/app-terms
26. https://lmstudio.ai/blog/free-for-work
27. https://github.com/LostRuins/koboldcpp
28. https://github.com/LostRuins/koboldcpp/releases
29. https://github.com/mudler/LocalAI
30. https://github.com/janhq/jan
31. https://github.com/janhq/jan/blob/main/LICENSE
32. https://docs.vllm.ai/en/latest/getting_started/installation/gpu/
33. https://docs.sglang.io/get_started/install.html
34. https://github.com/mlc-ai/mlc-llm
35. https://github.com/mlc-ai/web-llm
36. https://github.com/EricLBuehler/mistral.rs
37. https://onnxruntime.ai/docs/genai/
38. https://learn.microsoft.com/en-us/azure/foundry-local/what-is-foundry-local
39. https://github.com/microsoft/foundry-local
40. https://devblogs.microsoft.com/foundry/foundry-local-ga/
41. https://devblogs.microsoft.com/foundry-on-windows/build-on-winml-oct-7-26/
42. https://github.com/openvinotoolkit/model_server
43. https://docs.openvino.ai/2026/model-server/ovms_demos_gguf.html
44. https://docs.docker.com/ai/model-runner/
45. https://docs.docker.com/subscription/desktop-license/
46. https://github.com/lemonade-sdk/lemonade
47. https://github.com/lemonade-sdk/lemonade/releases
48. https://huggingface.co/speakleash/Bielik-11B-v3.1-Instruct-GGUF
49. https://huggingface.co/api/models?author=speakleash&search=GGUF
50. https://huggingface.co/speakleash/Bielik-One-4B-r1
51. https://huggingface.co/jglowa/Bielik-One-4B-r1-GGUF
52. https://huggingface.co/mradermacher/PLLuM-12B-instruct-2512-GGUF
53. https://huggingface.co/mradermacher/PLLuM-4B-instruct-2512-GGUF
54. https://huggingface.co/api/models?author=CYFRAGOVPL


# Część 2. Modele Bielik


Stan na 21.11.2026. Uzupełnia `docs/sources/it-administracji/FINDINGS.md`, sekcja 4 (tam: PLLuM, licencje, pierwsze rozmiary GGUF). Tu: pełna rodzina Bielik, czym jest Bielik-One, wyniki po polsku, progi sprzętowe, rekomendacja.

Oznaczenia: [P] źródło pierwotne (karta modelu, API HF, raport techniczny, dane rankingu), [S] agregator lub tekst wtórny, [W] media, [O] własny wniosek lub szacunek bez pomiaru.

**Korekta do FINDINGS 4.2:** zdanie „Bielik-One (warianty z rozumowaniem i wizją)” jest nieścisłe. Bielik-One to modele decyzyjne bez generowania tekstu. Sufiks `-r1` oznacza wydanie 1 (`version = {r1}` w cytowaniu karty), nie rozumowanie. Żaden wariant nie obsługuje obrazu. Tryb rozumowania ma Bielik-11B-v3.1-Instruct. [P] https://huggingface.co/speakleash/Bielik-One-4B-r1 , https://github.com/speakleash/bielik-one

---

## 1. Rodzina Bielik (modele generujące tekst)

Parametry z API HF (`safetensors.total`), daty to utworzenie repozytorium na HF. Wszystkie wagi na licencji Apache-2.0. Repozytoria wag bazowych mają bramkę `gated: auto` (logowanie i akceptacja warunków), repozytoria kwantyzacji (GGUF, MLX, AWQ, FP8) bramki nie mają. [P] https://huggingface.co/api/models?author=speakleash

| Model | Parametry | Kontekst | Data repo HF | Uwagi |
|---|---|---|---|---|
| Bielik-11B-v3.1-Instruct | 11,17 mld | 32 768 | 26.10.2026, premiera 10.11.2026 | 56 języków, wywoływanie narzędzi, `reasoning_effort` |
| Bielik-11B-v3.0-Instruct | 11,17 mld | 32 768 | 07.11.2025 | 32 języki europejskie, ChatML |
| Bielik-PL-11B-v3.0-Instruct | 11,17 mld | 32 768 | 13.02.2026 | tokenizer APT4 dla polskiego |
| Bielik-Minitron-7B-v3.0-Instruct | 7,48 mld | 32 768 (trening) | 22.01.2026 | przycięty i destylowany z 11B (NVIDIA Minitron) |
| Bielik-PL-Minitron-7B-v3.0-Instruct | 7,48 mld | 32 768 | 13.02.2026 | jw. z tokenizerem APT4 |
| Bielik-4.5B-v3.0-Instruct | 4,76 mld | 32 768 | 18.04.2025 | |
| Bielik-1.5B-v3.0-Instruct | 1,60 mld | 8 192 | 18.04.2025 | |
| Bielik-11B-v3.1-DFlash / DFlash2 | ok. 1 mld | nd. | 24.10.2026 | model szkicowy do dekodowania spekulatywnego, nie działa samodzielnie |
| Bielik-11B-v2.x, Bielik-7B-v0.1 | 11 mld / 7 mld | | 2024 do 2025 | starsze generacje, pomijamy |

Źródła wierszy:
- v3.1: 500 mld tokenów pretreningu, SFT 26 mln próbek, RL zmodyfikowanym GRPO w 14 środowiskach, vLLM od 0.24 (test na 0.32), SGLang, Transformers, Docker Model Runner. [P] https://huggingface.co/speakleash/Bielik-11B-v3.1-Instruct
- v3.1: 56 języków (v3.0 miał 32), Belebele +8%, INCLUDE +5%, τ²-bench o 16 do 45% lepiej niż v3.0. [W] https://itwiz.pl/?p=75979 (10.11.2026)
- Kontekst 32 768 tokenów dla v3 7B i 11B, APT4 skraca polski tekst z 3,22 do 1,62 tokena na słowo (o ok. 50%), co prawie podwaja efektywny kontekst po polsku. [P] https://arxiv.org/html/2604.10799v1
- Minitron: 7,35 mld wg karty (33,4% mniej niż 11B), odzyskuje ok. 90% jakości, do 50% szybsza inferencja. [P] https://huggingface.co/speakleash/Bielik-Minitron-7B-v3.0-Instruct , https://arxiv.org/html/2603.11881
- 4.5B i 1.5B: kontekst 32 768 i 8 192. [P] https://arxiv.org/html/2505.02550
- DFlash: 1 mld parametrów, vLLM od 0.20 (DFlash2 od 0.28), SGLang. [P] https://huggingface.co/speakleash/Bielik-11B-v3.1-DFlash , https://huggingface.co/speakleash/Bielik-11B-v3.1-DFlash2

### 1.1. Narzędzia, JSON, rozumowanie (v3.1)

- Wywołania narzędzi w formacie `<tool_call>{...}</tool_call>`. Ustrukturyzowane `tool_calls` w vLLM wymagają parsera `bielik` z `speakleash/bielik-tools` i `--enable-auto-tool-choice`. Schemat argumentów nie jest wymuszany, karta każe traktować argumenty jak niezaufane dane. [P] https://huggingface.co/speakleash/Bielik-11B-v3.1-Instruct
- `response_format` nie trafia do szablonu czatu. JSON trzeba więc wymuszać po stronie silnika (np. gramatyka lub `json_schema` w llama-server, structured outputs w vLLM) i walidować (u nas Zod). [P] karta jw., [P] https://github.com/ggml-org/llama.cpp/tree/master/tools/server
- Rozumowanie: `reasoning_effort` = none (domyślnie), low, medium, high, max. Treść `<think>` trafia do osobnego pola. Za mały `max_tokens` daje pustą odpowiedź. [P] karta jw.
- Szablon dokleja wbudowany prompt systemowy (ok. 1000 tokenów) z datą z zegara serwera. Wyłączenie: `provider_system_prompt: false`. [P] karta jw.
- Model nie ma moderacji. [P] karta jw.
- Starsze 4.5B i 1.5B: BFCL (AST, Non-Live Simple) 94,00% i 77,00%. [P] https://arxiv.org/html/2505.02550

### 1.2. Oficjalne kwantyzacje i rozmiary plików

Rozmiary z API HF (`/tree/main`). [P] https://huggingface.co/api/models/speakleash/Bielik-11B-v3.1-Instruct-GGUF/tree/main i analogiczne adresy dla pozostałych repozytoriów.

| Model | Q4_K_M | Q5_K_M | Q6_K | Q8_0 | BF16 | MLX 4bit | Inne |
|---|---|---|---|---|---|---|---|
| Bielik-11B-v3.1-Instruct | 6,72 GB | 7,91 GB | 9,16 GB | 11,87 GB | 22,34 GB | 6,98 GB | AWQ 6,19 GB, FP8 11,44 GB, MLX 8bit 11,87 GB, NVFP4 |
| Bielik-PL-11B-v3.0-Instruct | brak | brak | brak | 11,87 GB | 22,34 GB | brak | |
| Bielik-Minitron-7B-v3.0-Instruct | 4,50 GB | 5,29 GB | 6,14 GB | 7,95 GB | brak | 4,67 GB | AWQ, FP8, NVFP4 |
| Bielik-PL-Minitron-7B-v3.0-Instruct | brak | brak | brak | 7,95 GB | 14,95 GB | brak | |
| Bielik-4.5B-v3.0-Instruct | brak | brak | brak | 5,06 GB | 9,52 GB | 3,16 GB | AWQ, FP8 |
| Bielik-1.5B-v3.0-Instruct | brak | brak | brak | 1,70 GB | 3,20 GB | tak | AWQ, FP8 |
| Bielik-11B-v3.1-DFlash (szkic) | 0,69 GB | | | 1,25 GB | 2,35 GB | | DFlash2: 0,73 / 1,31 / 2,47 GB |
| Bielik-Minitron-7B-v3.0-DFlash (szkic) | 0,58 GB | | | 1,05 GB | 1,97 GB | | |

- Oficjalny obraz Ollama: `SpeakLeash/bielik-11b-v3.1-instruct` (Q4_K_M ok. 6,7 GB). [P] https://ollama.com/SpeakLeash/bielik-11b-v3.1-instruct
- llama.cpp z szkicem DFlash: `llama-server -m Bielik-11B-v3.1-Instruct.Q4_K_M.gguf -md Bielik-11B-v3.1-DFlash.Q4_K_M.gguf --spec-type draft-dflash --spec-draft-n-max 15 --jinja`. Karta nie podaje przyspieszenia. [P] https://huggingface.co/speakleash/Bielik-11B-v3.1-DFlash-GGUF

---

## 2. Bielik-One i „jev-like”

### 2.1. Co to jest

Bielik-One to rodzina czterech modeli decyzyjnych. Nie piszą tekstu. Dostają opis stanu (`state`) i pytania typowane, zwracają rozkład prawdopodobieństwa odpowiedzi w jednym przebiegu modelu na pytanie. Na tym rozkładzie ustawia się progi automatyzacji, niepewne przypadki idą do człowieka. [P] https://github.com/speakleash/bielik-one , [W] https://itwiz.pl/?p=75979 (10.11.2026)

Typy pytań: `choice` (jedna opcja), `noul` (tak/nie, zwraca p(tak)), `score` (skala porządkowa, wartość oczekiwana i rozkład), `labels` (wiele etykiet, niezależne p dla każdej). Endpoint `/v1/systemone`, interfejs zwraca też `confidence`. Kalibracja temperaturą dopasowaną na zbiorze walidacyjnym (dla bf16). [P] https://huggingface.co/speakleash/Bielik-One-11B-v3.1-r1

| Model | Baza | Parametry | Pamięć GPU bf16 (wagi + KV) | Adapter (LoRA + głowice) | Data repo HF |
|---|---|---|---|---|---|
| Bielik-One-11B-v3.1-r1 | Bielik-11B-v3.1-Instruct | 11,17 mld | ok. 30 GB | +1,0 GB | 10.11.2026 |
| Bielik-One-11B-v3.0-r1 | Bielik-11B-v3.0-Instruct | 11,17 mld | ok. 30 GB | +1,0 GB | 02.11.2026 |
| Bielik-One-7B-v3.0-r1 | Bielik-Minitron-7B-v3.0-Instruct | 7,48 mld | ok. 22 GB | +1,4 GB | 02.11.2026 |
| Bielik-One-4B-r1 | Qwen/Qwen3.5-4B | 4,66 mld | ok. 12 GB | +0,7 GB | 02.11.2026 |

[P] karty: https://huggingface.co/speakleash/Bielik-One-11B-v3.1-r1 , https://huggingface.co/speakleash/Bielik-One-11B-v3.0-r1 , https://huggingface.co/speakleash/Bielik-One-7B-v3.0-r1 , https://huggingface.co/speakleash/Bielik-One-4B-r1 . Parametry i daty: [P] https://huggingface.co/api/models/speakleash/Bielik-One-4B-r1 (i analogicznie). Ogłoszenie rodziny 12.11.2026: [S] https://casrai.org/news/bielik-3-1-dflash-one-model-release-2026

- Licencja Apache-2.0, repozytoria bez bramki. [P] API HF jw.
- Dwie formy: scalone wagi (osobna kopia modelu) albo `-Adapter`, który dokłada ok. 1 GB do już działającego Bielik-11B-v3.1-Instruct. W trybie adaptera jeden silnik vLLM obsługuje zwykły czat (`bielik-base`, niezmienione wagi) i decyzje (`decision`). [P] https://huggingface.co/speakleash/Bielik-One-11B-v3.1-r1-Adapter
- Wersja scalona też ma czat (`bielik-general`), ale na wagach po dostrojeniu decyzyjnym. [P] https://huggingface.co/speakleash/Bielik-One-11B-v3.1-r1
- Silnik: vLLM 0.32.0, Python 3.12, GPU NVIDIA. MLX na Apple Silicon tylko dla pakietów `-Adapter` (przykład 4B: 8,2 GiB wag na czat i decyzje razem). llama.cpp i GGUF nie są obsługiwane, CPU nie jest wspomniane. [P] https://github.com/speakleash/bielik-one
- Kontekst 32 768 tokenów, stan do 400 000 znaków, dłuższe żądania odrzucane (HTTP 422), nie obcinane. [P] jw.
- `--fp8` mniej więcej połowi pamięć wag, ale zmienia 2 do 18% decyzji blisko progu i nie jest skalibrowany. [P] jw.
- Wyniki autorów (benchmark Tacit, pozycje regułowe, z wyliczonymi faktami dat i liczb): 4B 79,4%, 11B-v3.1 77,1%. Zgodność MLX z vLLM 99,3 do 99,5% decyzji. Niezależnej ewaluacji nie znaleziono. [P] jw.
- Zastosowania podawane przez twórców: klasyfikacja zgłoszeń, zgodność dokumentów z procedurą, moderacja, ocena odpowiedzi innych systemów AI. [W] https://itwiz.pl/?p=75979

### 2.2. Co znaczy „jev-like”

**Najbardziej prawdopodobne (mocne dowody): Jev, komercyjny model decyzyjny TypeSafe AI.** Jev to „System One model”, który zwraca skalibrowane prawdopodobieństwa typowanych odpowiedzi (noul, choice, score, box) zamiast tekstu. [S] https://docs.aimlapi.com/api-references/decision-models/typesafe/jev.md , [P] https://arxiv.org/abs/2610.17205 . Bielik-One wprost deklaruje, że `choice`, `noul` i `score` „follow the TypeSafe System One schema”, więc klient napisany pod `/v1/systemone` działa bez zmian. [P] https://github.com/speakleash/bielik-one . Wniosek [O]: „Bielik One (jev-like)” w specyfikacji oznacza lokalny, otwarty odpowiednik Jev. Jev znaleźliśmy tylko jako API w chmurze, co wyklucza go u nas.

Hipotezy odrzucone [O]:
- JEPA (architektura LeCuna): brak jakiegokolwiek związku w kartach i repozytorium Bielik-One.
- Wariant „z wizją”: Jev ma typ `box` dla obrazów, Bielik-One go nie ma. Model wizyjny Bielika jest dopiero w przygotowaniu (zbiórka zdjęć „Obywatel Bielik”). [W] https://www.purepc.pl/obywatel-bielik-aplikacja-mobilna-model-wizyjny (15.07.2026). Na Bielik Summit 26.11.2026 zapowiedziano podgląd modelu multimodalnego powyżej 100 mld parametrów. [W] https://itwiz.pl/?p=75979

Alternatywa bez dodatkowego modelu: zwykły model instrukcyjny daje decyzje w stylu Jev z logitów liter odpowiedzi, bez treningu. [P] https://arxiv.org/abs/2610.17205 . To ścieżka zapasowa dla CPU, gdzie Bielik-One nie działa.

---

## 3. Wyniki po polsku

Wyniki 11B v3.1 w rankingach są dopiero częściowe. Większość liczb dotyczy v3.0, który jest bazą v3.1.

| Model | Open PL LLM (5-shot) | Polish EQ-Bench | CPTUB (0 do 5) | PLCC (%) | Polish MT-Bench |
|---|---|---|---|---|---|
| Bielik-11B-v3.1-Instruct | brak | brak | brak | 72,00 (low reasoning), 67,33 (bez) | brak |
| Bielik-11B-v3.0-Instruct | 65,93 | 71,20 | 3,73 | 70,67 | brak |
| Bielik-PL-11B-v3.0-Instruct | 64,11 | 71,15 | 3,80 | brak | brak |
| Bielik-Minitron-7B-v3.0-Instruct | 62,46 | 64,09 | 3,38 | 53,00 | brak |
| Bielik-PL-Minitron-7B-v3.0-Instruct | 61,66 | 66,89 | 3,55 | brak | brak |
| Bielik-4.5B-v3.0-Instruct | 56,13 | 56,21 | 3,38 | 42,33 | brak |
| Bielik-1.5B-v3.0-Instruct | 41,36 | 13,88 | 2,36 | 27,50 | brak |
| PLLuM-12B-chat-2512 | nie ujęty | brak | brak | 41,17 | brak |
| PLLuM-4B-chat-2512 | nie ujęty | brak | brak | 26,83 | brak |
| Llama-PLLuM-8B-chat-2512 | nie ujęty | brak | brak | 36,00 | brak |
| Llama-PLLuM-70B-chat-2512 | nie ujęty | brak | brak | 62,83 | brak |
| PLLuM-12B-chat (2412) | nie ujęty | 57,29 | 3,14 | 47,00 | 5,81 |
| pllum-12b-nc-chat-250715 | nie ujęty | 58,23 | brak | 69,67 | brak |
| Qwen3.5-4B (baza Bielik-One-4B) | | | | 29,67 | |

Źródła:
- Open PL LLM, CPTUB (11B, 7B), EQ-Bench (7B): [P] https://arxiv.org/html/2603.11881 . Warianty PL: [P] https://arxiv.org/html/2604.10799v1 . 4.5B i 1.5B: [P] https://arxiv.org/html/2505.02550
- Polish EQ-Bench (11B v3.0, 4.5B, PLLuM): [P] https://huggingface.co/spaces/speakleash/polish_eq-bench/blob/main/benchmark_results.csv . Raporty Bielika podają dla 4.5B 53,58, a dla PLLuM-12B-chat 52,26, czyli inne przebiegi niż w CSV.
- PLCC: średnia z 6 kategorii po 100 pytań, wyliczona z danych rankingu (256 modeli, wyniki v3.1 z 13.11.2026, PLLuM 2512 z 21.05.2026). Dla skali: najlepsze modele komercyjne ok. 97 do 98. [P] https://huggingface.co/spaces/sdadas/plcc/blob/main/data.json
- Polish MT-Bench: brak modeli v3 i PLLuM 2512 (ostatnia zmiana 18.01.2026). Dla porównania Bielik-11B-v2.3 8,56, gemma-3-12b-it 8,97. [P] https://huggingface.co/spaces/speakleash/mt-bench-pl/blob/main/data/mt_bench/mt-bench.csv
- PLLuM nie jest w Open PL LLM Leaderboard (trening na częściach treningowych zadań), patrz FINDINGS 4.3.
- EuroEval: v3.1 na szczycie krzywej Pareto, bez liczb w artykule. [W] https://itwiz.pl/?p=76092 (17.11.2026)
- Polish Medical: 11B v3.0 50,21%, Minitron 44,36%, PLLuM-12B-chat 36,51%. [P] https://arxiv.org/html/2603.11881

Wniosek [O]: w jedynym rankingu z PLLuM 2512 (PLCC) Bielik-11B-v3.1 prowadzi wyraźnie (72,0 wobec 41,2 dla PLLuM-12B-chat-2512). Atutem PLLuM pozostają gatunki tekstów urzędowych deklarowane przez MC (FINDINGS 4.1), ale bez porównywalnych liczb. PLLuM warto trzymać jako wymienny model drugiego wyboru, nie domyślny.

### 3.1. Bielik-Guard (filtr treści)

| Model | Parametry | Baza | F1 micro (Sójka) | Precyzja na 3000 promptów | FPR |
|---|---|---|---|---|---|
| Bielik-Guard-0.1B-v1.1 | 124 mln | sdadas/mmlw-roberta-base | 0,775 | 77,65% | 0,63% |
| Bielik-Guard-0.5B-v1.1 | 443 mln | PKOBP/polish-roberta-8k | 0,791 | 75,28% | 0,73% |
| Llama-Guard-3-8B (porównanie) | 8 mld | | | 13,62% | 9,30% |

Kategorie: nienawiść i agresja, wulgaryzmy, treści seksualne, przestępstwa, samookaleczenia. Nie wykrywa jailbreaków ani dezinformacji. Apache-2.0, `gated: auto`, Transformers z `trust_remote_code=True`. [P] https://huggingface.co/speakleash/Bielik-Guard-0.5B-v1.1 , https://huggingface.co/speakleash/Bielik-Guard-0.1B-v1.1

---

## 4. Ograniczenia prawne dla analizy trendów

- Rozpoznawanie emocji w miejscu pracy jest zakazane. [P] https://artificialintelligenceact.eu/article/5/ (art. 5 ust. 1 lit. f)
- Systemy AI do monitorowania i oceny wyników i zachowania pracowników są wysokiego ryzyka. [P] https://artificialintelligenceact.eu/annex/3/ (pkt 4 lit. b)
- Wniosek [O]: Bielik-One karmić tylko faktami (nadgodziny, absencje, liczba spraw, zmiany ocen między okresami), nigdy wolnym tekstem do oceny nastroju. Twórcy wymieniają analizę sentymentu jako zastosowanie, tego u nas nie używać. Wynik to sygnał z prawdopodobieństwem dla przełożonego, bez automatycznej decyzji.

---

## 5. Wniosek: progi sprzętowe

Jedyny opublikowany pomiar prędkości: Bielik-11B-v3 bf16 54,42 tok/s, Minitron-7B bf16 81,41 tok/s (NVIDIA RTX PRO 6000 Max-Q, jedno żądanie). [P] https://arxiv.org/html/2603.11881 . Szacunek z przepustowości pamięci dla Q4_K_M 11B: ok. 89 tok/s na RTX 4090. [S] https://llmrun.dev/model/speakleash-bielik-11b-v3-0-instruct . Pozostałe prędkości poniżej to szacunek [O] wg reguły: tok/s ≈ przepustowość pamięci ÷ rozmiar wag, razy 0,5 do 0,7. Wymagają pomiaru na docelowym sprzęcie.

| Próg | Tekst (asystent) | Decyzje i trendy | Guard | Szacunek prędkości tekstu [O] |
|---|---|---|---|---|
| a) CPU, 8 GB RAM | Bielik-Minitron-7B-v3.0-Instruct Q4_K_M (4,50 GB), llama.cpp | Bielik-One nie działa na CPU. Ten sam model, decyzje z logitów opcji lub JSON z gramatyką | 0.1B na CPU | 5 do 10 tok/s |
| a) CPU, 16 GB RAM | Bielik-11B-v3.1-Instruct Q4_K_M (6,72 GB) dla jakości albo Minitron-7B Q5_K_M (5,29 GB) dla szybkości | jw. | 0.1B | 11B: 3 do 7 tok/s, 7B: 5 do 9 tok/s |
| b) Apple M2 16 GB | Bielik-11B-v3.1-Instruct MLX 4bit (6,98 GB) lub GGUF Q4_K_M (Metal) | Bielik-One-4B-r1-Adapter przez MLX (ok. 8,8 GB z bazą), uruchamiany na żądanie, nie równolegle z 11B | 0.1B | 11B 4bit przy 100 GB/s: 7 do 10 tok/s |
| c) NVIDIA 12 GB | Bielik-11B-v3.1-Instruct Q4_K_M lub Q5_K_M, llama.cpp CUDA, opcjonalnie szkic DFlash Q4_K_M (0,69 GB) | Bielik-One-4B-r1 z `--fp8` w vLLM, osobny proces lub osobna maszyna | 0.5B | 25 do 50 tok/s |
| c) NVIDIA 16 GB | jw. albo vLLM z Bielik-11B-v3.1-Instruct-AWQ (6,19 GB) | Bielik-One-4B-r1 bf16 (ok. 12 GB) na żądanie albo `--fp8` obok modelu tekstowego | 0.5B | 30 do 60 tok/s |
| d) Serwer 24 GB | vLLM, Bielik-11B-v3.1-Instruct z `--fp8` (wagi ok. 11,4 GB) | Bielik-One-11B-v3.1-r1-Adapter na tym samym silniku (+1 GB). Uwaga: decyzje przy fp8 bez kalibracji | 0.5B | 40 do 80 tok/s |
| d) Serwer 32 do 48 GB | vLLM bf16 + DFlash2 | Bielik-One-11B-v3.1-r1-Adapter bf16 (ok. 30 GB razem z bazą), decyzje skalibrowane | 0.5B | 54 tok/s zmierzone bez szkicu (RTX PRO 6000) |

Źródła rozmiarów i pamięci: sekcje 1.2 i 2.1. Przepustowość M2 100 GB/s: [P] https://www.apple.com/newsroom/2022/06/apple-unveils-m2-with-breakthrough-performance-and-capabilities/

Uwagi do progów [O]:
- Na CPU wariant Bielik-PL-Minitron-7B Q8_0 (7,95 GB) może dać podobną szybkość w słowach na sekundę co Minitron Q4_K_M, bo potrzebuje o połowę mniej tokenów na polskie słowo (sekcja 1). Ma wyższy EQ-Bench (66,89) i CPTUB (3,55). Brak opisu wywoływania narzędzi, wymaga testu.
- Bielik-1.5B i 4.5B tylko jako awaryjne minimum. PLCC 27,5 i 42,3 to za mało do redagowania uzasadnień ocen.
- Bielik-One-4B ma bazę Qwen3.5-4B, która w PLCC ma 29,67. Do decyzji na faktach to może nie przeszkadzać, ale wymaga własnego testu na polskich danych kadrowych.
- Pobieranie w instalatorze: repozytoria GGUF, MLX, AWQ i Bielik-One nie mają bramki, więc nie trzeba tokenu HF.

## 6. Rekomendacja

1. **Asystent tekstowy (redakcja uzasadnień, informacja zwrotna, plan rozwoju, pytania do rozmowy, RAG po ustawach, JSON):** Bielik-11B-v3.1-Instruct. Najlepszy polski wynik w PLCC wśród modeli lokalnych do 12 mld, wywoływanie narzędzi, `reasoning_effort` dla trudniejszych odpowiedzi, kontekst 32 768. Na słabszym sprzęcie Bielik-Minitron-7B-v3.0-Instruct (ok. 90% jakości, o 50% szybszy).
2. **Analiza trendów i sygnały przeciążenia:** Bielik-One-11B-v3.1-r1-Adapter na serwerze (jeden silnik vLLM obsługuje czat i decyzje, +1 GB). Na GPU 12 do 16 GB i na Macu Bielik-One-4B-r1. Pytania typu `score` (poziom ryzyka przeciążenia), `noul` (czy trend ocen spada) i `labels` (które czynniki faktyczne występują). Progi i przegląd przez człowieka zgodnie z modelem „niepewne do człowieka”.
3. **Na CPU** Bielik-One nie działa. Decyzje robi ten sam Bielik z wymuszonym JSON albo odczytem logitów opcji, z tym samym kontraktem API co `/v1/systemone`, żeby można było później podmienić silnik.
4. **Guard:** Bielik-Guard-0.1B-v1.1 na CPU do kontroli wygenerowanych tekstów (wulgaryzmy, agresja) przed pokazaniem przełożonemu. Koszt pomijalny, wartość umiarkowana, bo dane wejściowe pochodzą od urzędników, nie z internetu.
5. **PLLuM 2512** zostawić jako wymienny model drugiego wyboru (np. do upraszczania języka urzędowego), po własnym teście.
