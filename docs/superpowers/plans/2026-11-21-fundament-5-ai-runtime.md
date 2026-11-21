# Fundament 5: runtime AI. Plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** pakiet `@sarmata/ai-runtime` w `infra/ai-runtime/`, który wykrywa sprzęt, dobiera tier modelu Bielik, instaluje przypięty llama.cpp i model z kontrolą SHA-256, uruchamia natywny llama-server (oraz Bielik-One przez `uv` tam, gdzie jest vLLM albo MLX), a w dev na Macu daje `pnpm ai:setup`, `pnpm ai:start` i `pnpm ai:stop`.

**Architektura:** biblioteka TS bez zależności produkcyjnych (tylko wbudowane moduły Node), używana przez kreator instalacyjny z planu 6 (kompilowany Bunem) i przez skrypty dev. Jedyny szew to `Machine`: fakty o platformie (OS, architektura, RAM) i krótkie polecenia z zebranym wyjściem. Ma dwa adaptery, `localMachine()` i `fakeMachine()`, więc wykrywanie sprzętu, wybór urządzenia i instalację Bielik-One testujemy dla Windows, Linuxa i macOS na jednym komputerze. Decyzje (tier modelu, wybór archiwów llama.cpp, kwantyzacja, miejsce na Bielik-One) to czysta funkcja `recommendRuntime` na danych. Parsery wyjścia `nvidia-smi`, `llama-server --list-devices` i `llama-bench` są wewnętrzne i testowane przez interfejs. Pobieranie testujemy na lokalnym serwerze HTTP, a start i zatrzymanie procesu na skrypcie udającym llama-server.

**Stack:** Node 24 (natywne uruchamianie `.ts`), TypeScript 6.0.3, Vitest 5.1.1, llama.cpp v1.0.0 (build b12359), modele `speakleash/Bielik-11B-v3.1-Instruct-GGUF` i `speakleash/Bielik-4.5B-v3.0-Instruct-GGUF`, bielik-one 1.2.0 (commit `b92c111`) z vLLM 0.32.0 albo MLX 0.32.4, uv.

**Kontekst dla wykonawcy:**
- Decyzje: `docs/adr/0005-runtime-llm.md`, `docs/adr/0003-wdrozenie-u-klienta.md` (LLM natywnie, Bielik-One przez uv), research `docs/sources/ai-lokalne/FINDINGS.md`. Tylko modele Bielik. Bez Bielik-Minitron i bez Bielik-Guard (decyzja właściciela produktu w ADR 0005). LLM zawsze natywnie, nigdy w Dockerze.
- Kod po angielsku, proza i komunikaty dla użytkownika kreatora (pole `reason`, komunikaty postępu) po polsku. Polecenia powłoki z prefiksem `rtk` (`AGENTS.md`).
- Pliki pakietu importują się nawzajem z rozszerzeniem `.ts` (`allowImportingTsExtensions`, `erasableSyntaxOnly`). Dzięki temu skrypty dev działają przez `node scripts/x.ts` bez tsx, a Bun w planie 6 kompiluje je bez zmian. Nie używaj enumów, przestrzeni nazw ani właściwości w parametrach konstruktora.
- Kod z planu przeszedł 21.11.2026 `tsc` z flagami z `tsconfig.base.json` (w tym `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`), ESLint `strictTypeChecked` i `stylisticTypeChecked` z `projectService` oraz Vitest (61 testów). Każdy plik TS pakietu (`src`, testy, `scripts`) należy do `infra/ai-runtime/tsconfig.json`. Bloki kodu nie są sformatowane Prettierem, dlatego każdy commit poprzedza `prettier --write`.
- Dane przypięte 21.11.2026: wydanie `v1.0.0` llama.cpp ma jako asset tylko `nightly-tag.txt` z treścią `b12359`, więc paczki i ich sumy (`digest` z API GitHub) pochodzą z wydania `b12359`. Sumy modeli to `lfs.oid` z `https://huggingface.co/api/models/<repo>/tree/main`. Nie zmieniaj tych liczb bez ponownego odczytu źródła.
- Próbka `list-devices-macos-m2.txt` jest nagrana na M2 16 GB z paczki b12359. Pozostałe próbki są złożone według formatu z `common/arg.cpp` (b12359: `"  %s: %s (%zu MiB, %zu MiB free)\n"`) i formatu CSV `nvidia-smi --query-gpu`. Przy pierwszym dostępie do maszyny z NVIDIA albo AMD podmień je na nagrania i zachowaj oczekiwania testów.

## Niezależność i praca równoległa

Plan nie zależy od planów 2 do 4 i może iść równolegle z nimi. Cały kod leży w nowym katalogu `infra/ai-runtime/`, którego nie dotyka żaden inny plan. Wspólne pliki zmienia tylko dopisując:

| Plik | Zmiana | Przy konflikcie |
|---|---|---|
| `package.json` (korzeń) | trzy skrypty `ai:*` na końcu `scripts` | zachowaj skrypty obu stron |
| `pnpm-lock.yaml` | nowy importer `infra/ai-runtime` | `rtk pnpm install` po scaleniu |
| `README.md` | krok 6 w „Jak uruchomić (dev)”, wiersze w „Skrypty” i „Pliki konfiguracyjne” | zachowaj kroki obu stron i popraw numerację |
| `.envrc` | linia `dotenv_if_exists .env.ai.local` po linii `.env.local` | zachowaj linie obu stron |

`scripts/secrets-decrypt.sh` i `.env.local` zostają nietknięte. `.env.local` należy wyłącznie do SOPS (direnv odszyfrowuje go ponownie, gdy `secrets/dev.enc.env` jest nowszy), więc adres runtime AI trafia do osobnego, wygenerowanego `.env.ai.local`.

Kontrakty dla innych planów:
- **Plan 3 (`backend/ai`):** klient OpenAI czyta `AI_BASE_URL` (adres z `/v1`, np. `http://127.0.0.1:55490/v1`) i `AI_MODEL` (alias modelu, np. `bielik-11b-v3.1-instruct`) ze zmiennych środowiska. Adres frontendu Bielik-One (`/v1/systemone`) to `AI_DECISION_URL`, obecny tylko wtedy, gdy Bielik-One działa. W dev te zmienne pochodzą z `.env.ai.local` w korzeniu, który ładuje direnv. `backend/*` i `frontend/*` nie importują `@sarmata/ai-runtime`, bo aplikacja zna tylko adresy (ADR 0005).
- **Plan 6 (kreator):** kolejność wywołań opisuje sekcja „Interfejs pakietu”. Kreator rejestruje usługi systemowe z `llamaServerCommand(config)`, a `startLlamaServer` służy do pierwszego uruchomienia i do dev.

## Interfejs pakietu

Pakiet eksportuje tylko `src/index.ts`:

| Eksport | Rola |
|---|---|
| `Machine`, `localMachine()`, `fakeMachine(spec)` | szew: platforma i polecenia, adapter prawdziwy i testowy |
| `detectHardware(machine, llama?)` | OS, natywna architektura, RAM, karty NVIDIA, a po instalacji llama.cpp także urządzenia z `--list-devices` |
| `recommendRuntime(hardware, profile, options?)` | czysta funkcja: archiwa llama.cpp, model, Bielik-One, ustawienia serwera, uzasadnienie po polsku |
| `MODEL_FILES`, `BIELIK_ONE_PACKAGES`, `LLAMA_CPP_RELEASE` | przypięte dane |
| `installLlamaCpp(bundle, ctx)` | pobranie, kontrola sum, rozpakowanie do katalogu danych |
| `prepareLlamaServer(options, ctx)`, `readLlamaServerConfig(dataDir)` | pobranie modelu, benchmark CPU i GPU, zapis `llama-server.json` |
| `llamaServerCommand(config)`, `startLlamaServer(config, options?)`, `isLlamaServerReady(url)` | polecenie, start z oczekiwaniem na `/v1/health`, stop, logi |
| `installBielikOne(engine, ctx)`, `startBielikOne(install, pkg, ctx, options?)`, `isBielikOneReady(url)` | Bielik-One przez uv, backend i frontend, `/health` i próbne `/v1/systemone` |
| `defaultDataDir(os, env, home)` | katalog danych aplikacji per użytkownik |

Kolejność w kreatorze i w `pnpm ai:setup`: `detectHardware(machine)`, potem `recommendRuntime` (archiwa llama.cpp zależą tylko od OS, architektury i NVIDIA), `installLlamaCpp`, ponownie `detectHardware(machine, llama)` (dopiero llama.cpp widzi karty AMD i Intel), ponownie `recommendRuntime` (ostateczny model), zgoda użytkownika, `prepareLlamaServer`, `startLlamaServer`.

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `infra/ai-runtime/package.json`, `tsconfig.json` | pakiet `@sarmata/ai-runtime`, skrypty |
| `infra/ai-runtime/src/index.ts` | jedyny interfejs pakietu |
| `infra/ai-runtime/src/machine.ts` | szew `Machine`, `localMachine`, `fakeMachine` |
| `infra/ai-runtime/src/hardware.ts` | `detectHardware`, parsery `nvidia-smi` i `--list-devices` |
| `infra/ai-runtime/src/context.ts` | `RuntimeContext`, `ProgressEvent`, `DownloadAsset` |
| `infra/ai-runtime/src/models.ts` | pliki GGUF Bielika, pakiety Bielik-One, źródło bielik-one |
| `infra/ai-runtime/src/llama-cpp-release.ts` | przypięte archiwa llama.cpp i ich wybór |
| `infra/ai-runtime/src/recommend.ts` | `recommendRuntime` |
| `infra/ai-runtime/src/download.ts` | pobieranie z kontrolą rozmiaru i SHA-256 (wewnętrzne) |
| `infra/ai-runtime/src/llama-cpp-install.ts` | `installLlamaCpp` |
| `infra/ai-runtime/src/data-dir.ts` | `defaultDataDir` |
| `infra/ai-runtime/src/process.ts` | start procesu z logiem, oczekiwanie na gotowość, stop (wewnętrzne) |
| `infra/ai-runtime/src/llama-server.ts` | przygotowanie, benchmark, polecenie, start, health |
| `infra/ai-runtime/src/bielik-one.ts` | instalacja i start Bielik-One |
| `infra/ai-runtime/src/test-helpers.ts` | serwer HTTP i wolny port dla testów (poza interfejsem) |
| `infra/ai-runtime/src/fixtures/*.txt` | próbki wyjścia `nvidia-smi` i `--list-devices` |
| `infra/ai-runtime/src/*.test.ts` | testy przez `index.ts` |
| `infra/ai-runtime/scripts/*.ts` | `ai:setup`, `ai:start`, `ai:stop` i wspólne helpery dev |
| `package.json`, `README.md`, `.envrc` | skrypty w korzeniu, instrukcja uruchomienia, ładowanie `.env.ai.local` |

---

### Task 1: Pakiet `@sarmata/ai-runtime` i szew `Machine`

**Files:**
- Create: `infra/ai-runtime/package.json`, `infra/ai-runtime/tsconfig.json`, `infra/ai-runtime/src/machine.ts`, `infra/ai-runtime/src/index.ts`
- Test: `infra/ai-runtime/src/machine.test.ts`

Pakiet nie ma `dependencies`, bo korzysta tylko z modułów wbudowanych Node (Bun je obsługuje). Narzędzia idą do `devDependencies` przez katalog pnpm, który już ma `typescript`, `vitest` i `@types/node`.

- [ ] **Step 1: Utwórz `infra/ai-runtime/package.json`**

```json
{
  "name": "@sarmata/ai-runtime",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Utwórz `infra/ai-runtime/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src", "scripts"]
}
```

`allowImportingTsExtensions` działa, bo baza ma `noEmit: true`. `erasableSyntaxOnly` pilnuje, żeby Node 24 mógł uruchomić pliki bez kompilacji.

- [ ] **Step 3: Utwórz `infra/ai-runtime/src/machine.ts`**

```ts
import { execFile } from 'node:child_process';
import { arch, platform, totalmem } from 'node:os';

export type OperatingSystem = 'macos' | 'linux' | 'windows';
export type Architecture = 'arm64' | 'x64';

/** Output of a finished command. `exitCode` is null when the command could not start or was killed. */
export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  /** Kill the command after this time. Default: 10 minutes. */
  timeoutMs?: number;
}

/**
 * Seam between the runtime logic and the computer: platform facts and short commands whose
 * output is collected. Long-running servers do not go through it (see process.ts).
 */
export interface Machine {
  readonly os: OperatingSystem;
  readonly arch: Architecture;
  readonly totalMemoryBytes: number;
  run(command: string, args: readonly string[], options?: RunOptions): Promise<CommandResult>;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function currentOs(): OperatingSystem {
  const value = platform();
  if (value === 'darwin') return 'macos';
  if (value === 'win32') return 'windows';
  if (value === 'linux') return 'linux';
  throw new Error(`Unsupported platform: ${value}`);
}

function currentArch(): Architecture {
  const value = arch();
  if (value === 'arm64' || value === 'x64') return value;
  throw new Error(`Unsupported architecture: ${value}`);
}

/** Real adapter: the computer this process runs on. */
export function localMachine(): Machine {
  return {
    os: currentOs(),
    arch: currentArch(),
    totalMemoryBytes: totalmem(),
    run(command, args, options = {}) {
      return new Promise((resolve) => {
        execFile(
          command,
          [...args],
          {
            encoding: 'utf8',
            timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            maxBuffer: MAX_OUTPUT_BYTES,
            windowsHide: true,
          },
          (error, stdout, stderr) => {
            if (!error) {
              resolve({ exitCode: 0, stdout, stderr });
              return;
            }
            const code: unknown = (error as { code?: unknown }).code;
            resolve({
              exitCode: typeof code === 'number' ? code : null,
              stdout,
              stderr: stderr || error.message,
            });
          },
        );
      });
    },
  };
}

/** A canned answer, or a function of the arguments for commands whose output depends on them. */
export type FakeCommand = CommandResult | ((args: readonly string[]) => CommandResult);

export interface FakeMachineSpec {
  os: OperatingSystem;
  arch: Architecture;
  totalMemoryGiB: number;
  /** Answers keyed by the command exactly as the code runs it. Other commands do not start. */
  commands?: Readonly<Record<string, FakeCommand>>;
}

export interface FakeMachine extends Machine {
  /** Commands run so far, in order. */
  readonly calls: readonly { command: string; args: readonly string[] }[];
}

/** Test adapter: a scripted computer that records every command. */
export function fakeMachine(spec: FakeMachineSpec): FakeMachine {
  const calls: { command: string; args: readonly string[] }[] = [];
  return {
    os: spec.os,
    arch: spec.arch,
    totalMemoryBytes: spec.totalMemoryGiB * 1024 ** 3,
    calls,
    run(command, args) {
      calls.push({ command, args: [...args] });
      const answer = spec.commands?.[command];
      if (answer === undefined) {
        return Promise.resolve({
          exitCode: null,
          stdout: '',
          stderr: `${command}: command not found`,
        });
      }
      return Promise.resolve(typeof answer === 'function' ? answer(args) : answer);
    },
  };
}
```

- [ ] **Step 4: Utwórz `infra/ai-runtime/src/index.ts`**

```ts
export { fakeMachine, localMachine } from './machine.ts';
export type {
  Architecture,
  CommandResult,
  FakeCommand,
  FakeMachine,
  FakeMachineSpec,
  Machine,
  OperatingSystem,
  RunOptions,
} from './machine.ts';
```

- [ ] **Step 5: Utwórz `infra/ai-runtime/src/machine.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { fakeMachine, localMachine } from './index.ts';

describe('localMachine', () => {
  it('runs a command and reports its exit code and output', async () => {
    const result = await localMachine().run(process.execPath, [
      '-e',
      'process.stdout.write("ok"); process.exit(3)',
    ]);
    expect(result).toMatchObject({ exitCode: 3, stdout: 'ok' });
  });

  it('reports a command that does not exist as not started', async () => {
    const result = await localMachine().run('sarmata-command-that-does-not-exist', []);
    expect(result.exitCode).toBeNull();
  });

  it('describes this computer', () => {
    const machine = localMachine();
    expect(['macos', 'linux', 'windows']).toContain(machine.os);
    expect(['arm64', 'x64']).toContain(machine.arch);
    expect(machine.totalMemoryBytes).toBeGreaterThan(0);
  });
});

describe('fakeMachine', () => {
  it('answers scripted commands, records calls and refuses unknown ones', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: { echo: (args) => ({ exitCode: 0, stdout: args.join(' '), stderr: '' }) },
    });
    expect(await machine.run('echo', ['a', 'b'])).toEqual({ exitCode: 0, stdout: 'a b', stderr: '' });
    expect((await machine.run('missing', [])).exitCode).toBeNull();
    expect(machine.calls).toEqual([
      { command: 'echo', args: ['a', 'b'] },
      { command: 'missing', args: [] },
    ]);
    expect(machine.totalMemoryBytes).toBe(16 * 1024 ** 3);
  });
});
```

- [ ] **Step 6: Zainstaluj zależności**

Run: `rtk pnpm install`
Expected: `pnpm-lock.yaml` dostaje importer `infra/ai-runtime`, bez nowych pakietów z rejestru.

- [ ] **Step 7: Commit**

```bash
rtk pnpm exec prettier --write infra/ai-runtime
rtk git add infra/ai-runtime pnpm-lock.yaml
rtk git commit -m "feat(ai-runtime): package skeleton with machine seam and fake adapter" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 2: Wykrywanie sprzętu

`detectHardware` łączy trzy źródła. RAM, OS i architektura pochodzą z `Machine`. Pod Rosettą 2 (Node x64 na Macu z Apple Silicon) `sysctl -n hw.optional.arm64` zwraca `1`, więc pakiet pobierze paczkę arm64. Karty NVIDIA daje `nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits`, a brak programu albo błąd sterownika oznacza brak NVIDIA. Pozostałe GPU (AMD, Intel, Apple) widzi dopiero zainstalowany llama.cpp przez `llama-server --list-devices`.

`--list-devices` nie mówi, czy karta jest zintegrowana, a ADR 0005 i FINDINGS (część 1, sekcja 2.4) każą traktować iGPU jak brak GPU. Rozpoznajemy je po nazwie (Apple, Intel UHD, HD i Iris Graphics, Intel Arc bez numeru modelu i serii V, Radeon Graphics i Radeon nnnM, Vega Graphics). Benchmark w Task 5 i tak porównuje CPU z GPU, więc pomyłka heurystyki kosztuje najwyżej gorszy tier, nie wolniejsze działanie.

**Files:**
- Create: `infra/ai-runtime/src/hardware.ts`, `infra/ai-runtime/src/fixtures/list-devices-macos-m2.txt`, `infra/ai-runtime/src/fixtures/list-devices-linux-cuda.txt`, `infra/ai-runtime/src/fixtures/list-devices-windows-vulkan.txt`, `infra/ai-runtime/src/fixtures/list-devices-linux-igpu.txt`, `infra/ai-runtime/src/fixtures/nvidia-smi-linux.txt`
- Modify: `infra/ai-runtime/src/index.ts`
- Test: `infra/ai-runtime/src/hardware.test.ts`

- [ ] **Step 1: Utwórz `infra/ai-runtime/src/hardware.ts`**

```ts
import type { Architecture, Machine, OperatingSystem } from './machine.ts';

/** An NVIDIA card as nvidia-smi reports it. */
export interface NvidiaGpu {
  name: string;
  memoryMiB: number;
  driverMajor: number;
  /** CUDA compute capability, e.g. 8.9 for Ada Lovelace. */
  computeCapability: number;
}

/** A GPU as llama.cpp sees it (`llama-server --list-devices`), e.g. `CUDA0`, `Vulkan0`, `MTL0`. */
export interface ComputeDevice {
  id: string;
  name: string;
  memoryMiB: number;
  /** Shares system memory with the CPU (Apple, Intel and AMD integrated graphics). */
  integrated: boolean;
}

export interface Hardware {
  os: OperatingSystem;
  /** Native architecture, also when Node runs under Rosetta 2. */
  arch: Architecture;
  memoryMiB: number;
  nvidia: NvidiaGpu[];
  /** Empty until llama.cpp is installed and passed to `detectHardware`. */
  devices: ComputeDevice[];
}

const MiB = 1024 * 1024;
const NVIDIA_QUERY = [
  '--query-gpu=name,memory.total,driver_version,compute_cap',
  '--format=csv,noheader,nounits',
];
// Format from common/arg.cpp (b12359): "  %s: %s (%zu MiB, %zu MiB free)". CPU and BLAS have no index.
const DEVICE_LINE = /^\s+([A-Za-z]+\d+):\s+(.+?)\s+\((\d+) MiB, \d+ MiB free\)\s*$/;
const INTEGRATED_GPU =
  /^Apple\b|\b(UHD|HD) Graphics\b|\bIris\b|Intel\(R\) Graphics|Arc\(TM\) Graphics|Arc\(TM\) \d{3}V\b|Radeon\(TM\)( \d{3,4}M)? Graphics|Radeon \d{3,4}M\b|Vega \d* ?Graphics/i;

/**
 * Detects what the AI runtime can use. Without `llama` it knows the OS, memory and NVIDIA cards.
 * With an installed llama.cpp it also lists every GPU llama.cpp can drive (AMD, Intel, Apple).
 * Throws when the given llama-server cannot list its devices.
 */
export async function detectHardware(
  machine: Machine,
  llama?: { serverPath: string },
): Promise<Hardware> {
  const arch = await nativeArch(machine);
  const nvidia = await nvidiaGpus(machine);
  const devices = llama ? await llamaDevices(machine, llama.serverPath) : [];
  return {
    os: machine.os,
    arch,
    memoryMiB: Math.floor(machine.totalMemoryBytes / MiB),
    nvidia,
    devices,
  };
}

/** The NVIDIA card with the most memory, if any. */
export function largestNvidia(gpus: readonly NvidiaGpu[]): NvidiaGpu | undefined {
  return [...gpus].sort((a, b) => b.memoryMiB - a.memoryMiB)[0];
}

async function nativeArch(machine: Machine): Promise<Architecture> {
  if (machine.os !== 'macos' || machine.arch === 'arm64') return machine.arch;
  // An x64 Node under Rosetta 2 still runs on Apple silicon, so arm64 binaries are the right ones.
  const result = await machine.run('sysctl', ['-n', 'hw.optional.arm64'], { timeoutMs: 5000 });
  return result.exitCode === 0 && result.stdout.trim() === '1' ? 'arm64' : 'x64';
}

async function nvidiaGpus(machine: Machine): Promise<NvidiaGpu[]> {
  if (machine.os === 'macos') return [];
  const result = await machine.run('nvidia-smi', NVIDIA_QUERY, { timeoutMs: 15_000 });
  return result.exitCode === 0 ? parseNvidiaSmi(result.stdout) : [];
}

function parseNvidiaSmi(stdout: string): NvidiaGpu[] {
  return stdout.split(/\r?\n/).flatMap((line) => {
    const [name, memory, driver, capability, ...rest] = line.split(',').map((part) => part.trim());
    if (!name || memory === undefined || driver === undefined || capability === undefined) return [];
    if (rest.length > 0) return [];
    const gpu: NvidiaGpu = {
      name,
      memoryMiB: Number(memory),
      driverMajor: Number.parseInt(driver, 10),
      computeCapability: Number(capability),
    };
    const valid = [gpu.memoryMiB, gpu.driverMajor, gpu.computeCapability].every(Number.isFinite);
    return valid ? [gpu] : [];
  });
}

async function llamaDevices(machine: Machine, serverPath: string): Promise<ComputeDevice[]> {
  const result = await machine.run(serverPath, ['--list-devices'], { timeoutMs: 60_000 });
  if (result.exitCode !== 0) {
    throw new Error(`${serverPath} --list-devices failed: ${result.stderr.trim()}`);
  }
  return result.stdout.split(/\r?\n/).flatMap((line) => {
    const match = DEVICE_LINE.exec(line);
    const [, id, name, memory] = match ?? [];
    if (!id || !name || !memory) return [];
    return [{ id, name, memoryMiB: Number(memory), integrated: INTEGRATED_GPU.test(name) }];
  });
}
```

- [ ] **Step 2: Utwórz próbki w `infra/ai-runtime/src/fixtures/`**

`list-devices-macos-m2.txt` (nagranie: `llama-server --list-devices` z paczki `llama-b12359-bin-macos-arm64.tar.gz` na M2 16 GB, 21.11.2026):

```text
Available devices:
  MTL0: Apple M2 (12124 MiB, 12123 MiB free)
  BLAS: Accelerate (0 MiB, 0 MiB free)
```

`list-devices-linux-cuda.txt`:

```text
Available devices:
  CUDA0: NVIDIA GeForce RTX 4070 (11873 MiB, 11520 MiB free)
```

`list-devices-windows-vulkan.txt`:

```text
Available devices:
  Vulkan0: AMD Radeon RX 7800 XT (16368 MiB, 15910 MiB free)
  Vulkan1: Intel(R) UHD Graphics 770 (16271 MiB, 16271 MiB free)
```

`list-devices-linux-igpu.txt`:

```text
Available devices:
  Vulkan0: Intel(R) Iris(R) Xe Graphics (RPL-P) (7854 MiB, 7854 MiB free)
```

`nvidia-smi-linux.txt`:

```text
NVIDIA GeForce RTX 4070, 12282, 580.95.05, 8.9
NVIDIA GeForce GTX 1080, 8192, 580.95.05, 6.1
```

Każdy plik kończy się znakiem nowej linii.

- [ ] **Step 3: Dopisz na końcu `infra/ai-runtime/src/index.ts`**

```ts
export { detectHardware } from './hardware.ts';
export type { ComputeDevice, Hardware, NvidiaGpu } from './hardware.ts';
```

- [ ] **Step 4: Utwórz `infra/ai-runtime/src/hardware.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectHardware, fakeMachine, type CommandResult } from './index.ts';

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const ok = (stdout: string): CommandResult => ({ exitCode: 0, stdout, stderr: '' });
const LLAMA = { serverPath: '/opt/sarmata/llama-server' };

describe('detectHardware', () => {
  it('reads Apple silicon with Metal from a recorded M2 sample', async () => {
    const machine = fakeMachine({
      os: 'macos',
      arch: 'arm64',
      totalMemoryGiB: 16,
      commands: { [LLAMA.serverPath]: ok(fixture('list-devices-macos-m2.txt')) },
    });
    expect(await detectHardware(machine, LLAMA)).toEqual({
      os: 'macos',
      arch: 'arm64',
      memoryMiB: 16384,
      nvidia: [],
      devices: [{ id: 'MTL0', name: 'Apple M2', memoryMiB: 12124, integrated: true }],
    });
  });

  it('reads NVIDIA cards from nvidia-smi and CUDA devices from llama.cpp', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 32,
      commands: {
        'nvidia-smi': ok(fixture('nvidia-smi-linux.txt')),
        [LLAMA.serverPath]: ok(fixture('list-devices-linux-cuda.txt')),
      },
    });
    const hardware = await detectHardware(machine, LLAMA);
    expect(hardware.nvidia).toEqual([
      { name: 'NVIDIA GeForce RTX 4070', memoryMiB: 12282, driverMajor: 580, computeCapability: 8.9 },
      { name: 'NVIDIA GeForce GTX 1080', memoryMiB: 8192, driverMajor: 580, computeCapability: 6.1 },
    ]);
    expect(hardware.devices).toEqual([
      { id: 'CUDA0', name: 'NVIDIA GeForce RTX 4070', memoryMiB: 11873, integrated: false },
    ]);
    expect(machine.calls[0]).toEqual({
      command: 'nvidia-smi',
      args: ['--query-gpu=name,memory.total,driver_version,compute_cap', '--format=csv,noheader,nounits'],
    });
  });

  it('tells a dedicated AMD card from Intel integrated graphics on Windows', async () => {
    const machine = fakeMachine({
      os: 'windows',
      arch: 'x64',
      totalMemoryGiB: 32,
      commands: { [LLAMA.serverPath]: ok(fixture('list-devices-windows-vulkan.txt')) },
    });
    expect((await detectHardware(machine, LLAMA)).devices).toEqual([
      { id: 'Vulkan0', name: 'AMD Radeon RX 7800 XT', memoryMiB: 16368, integrated: false },
      { id: 'Vulkan1', name: 'Intel(R) UHD Graphics 770', memoryMiB: 16271, integrated: true },
    ]);
  });

  it('marks Intel Iris Xe as integrated', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: { [LLAMA.serverPath]: ok(fixture('list-devices-linux-igpu.txt')) },
    });
    expect((await detectHardware(machine, LLAMA)).devices).toEqual([
      { id: 'Vulkan0', name: 'Intel(R) Iris(R) Xe Graphics (RPL-P)', memoryMiB: 7854, integrated: true },
    ]);
  });

  it('treats a failing nvidia-smi as no NVIDIA card', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: {
        'nvidia-smi': {
          exitCode: 9,
          stdout:
            "NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver.",
          stderr: '',
        },
      },
    });
    expect((await detectHardware(machine)).nvidia).toEqual([]);
  });

  it('reports the native architecture under Rosetta 2', async () => {
    const machine = fakeMachine({
      os: 'macos',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: { sysctl: ok('1\n') },
    });
    expect((await detectHardware(machine)).arch).toBe('arm64');
  });

  it('does not ask llama.cpp before it is installed', async () => {
    const machine = fakeMachine({ os: 'linux', arch: 'x64', totalMemoryGiB: 16 });
    expect((await detectHardware(machine)).devices).toEqual([]);
    expect(machine.calls.map((call) => call.command)).toEqual(['nvidia-smi']);
  });

  it('fails when llama-server cannot list devices', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: {
        [LLAMA.serverPath]: {
          exitCode: 127,
          stdout: '',
          stderr: 'error while loading shared libraries: libgomp.so.1',
        },
      },
    });
    await expect(detectHardware(machine, LLAMA)).rejects.toThrow(/--list-devices failed/);
  });
});
```

- [ ] **Step 5: Commit**

```bash
rtk pnpm exec prettier --write infra/ai-runtime
rtk git add infra/ai-runtime
rtk git commit -m "feat(ai-runtime): hardware detection from nvidia-smi and llama-server device list" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 3: Tiery modeli i przypięte archiwa llama.cpp

Tier jako czysta funkcja według ADR 0005. Progi leżą lekko poniżej nominalnych rozmiarów, bo karta „8 GB” raportuje 8188 MiB, a laptop „8 GB” około 7,6 GiB.

| Sprzęt | standard | server |
|---|---|---|
| RAM poniżej 7 GiB | brak modelu, AI wyłączone | jw. |
| bez GPU z co najmniej 7,5 GiB (iGPU się nie liczy) | Bielik-4.5B-v3.0 Q8_0 | jw. |
| GPU od 7,5 GiB albo Mac z Apple Silicon od 15 GiB RAM | Bielik-11B-v3.1 Q4_K_M | najwyższa z Q8_0, Q6_K, Q5_K_M, Q4_K_M, która mieści się z zapasem 4 GiB w VRAM albo w 75% pamięci Maca |

Bielik-One proponujemy tylko przy vLLM (Linux x64, NVIDIA z compute capability od 8.0, bo kalibracja jest w bfloat16) albo MLX (Apple Silicon, tylko pakiety `-Adapter`), poza profilem light, i tylko gdy mieści się obok modelu tekstowego z zapasem 2 GiB. Wymagania pamięci z README bielik-one: vLLM bf16 11B około 30 GB, 4B około 12 GB. MLX 4B 8,2 GiB wag, 11B to baza bf16 (22,3 GB) z adapterem i cache.

Archiwa llama.cpp: Metal na Apple Silicon, CPU na Macu z Intelem, CUDA przy NVIDIA, gdy sterownik na to pozwala, inaczej Vulkan (paczka Vulkan zawiera biblioteki CPU, więc działa też bez GPU). CUDA 13.5 wymaga sterownika od 580 i compute capability od 7.5. CUDA 12.4 na Windows wymaga sterownika od 551.61, a CUDA 12.8 na Linuksie od 570, obie obsługują jeszcze Maxwell i Pascal. Do paczki CUDA dochodzi archiwum `cudart`, bo biblioteki CUDA nie są częścią sterownika.

**Files:**
- Create: `infra/ai-runtime/src/context.ts`, `infra/ai-runtime/src/models.ts`, `infra/ai-runtime/src/llama-cpp-release.ts`, `infra/ai-runtime/src/recommend.ts`
- Modify: `infra/ai-runtime/src/index.ts`
- Test: `infra/ai-runtime/src/recommend.test.ts`

- [ ] **Step 1: Utwórz `infra/ai-runtime/src/context.ts`**

```ts
import type { Machine } from './machine.ts';

/** A file to download, pinned by size and SHA-256. */
export interface DownloadAsset {
  name: string;
  url: string;
  sizeBytes: number;
  sha256: string;
}

/** Progress for the installer screen. `message` is user-facing, so it is in Polish. */
export type ProgressEvent =
  | { kind: 'step'; message: string }
  | { kind: 'download'; file: string; receivedBytes: number; totalBytes: number };

/** What installing and starting functions need: the machine and the app data directory. */
export interface RuntimeContext {
  machine: Machine;
  dataDir: string;
  onProgress?: (event: ProgressEvent) => void;
}
```

- [ ] **Step 2: Utwórz `infra/ai-runtime/src/models.ts`**

```ts
export type ModelId =
  | 'bielik-4.5b-v3.0-q8_0'
  | 'bielik-11b-v3.1-q4_k_m'
  | 'bielik-11b-v3.1-q5_k_m'
  | 'bielik-11b-v3.1-q6_k'
  | 'bielik-11b-v3.1-q8_0';

/** One official SpeakLeash GGUF file, pinned to a repository commit and a SHA-256. */
export interface ModelFile {
  id: ModelId;
  label: string;
  quantization: string;
  /** Model name in the OpenAI-compatible API (`--alias`), used as AI_MODEL. */
  alias: string;
  repo: string;
  revision: string;
  file: string;
  url: string;
  sizeBytes: number;
  sha256: string;
}

interface ModelRepo {
  label: string;
  alias: string;
  repo: string;
  revision: string;
}

const BIELIK_11B: ModelRepo = {
  label: 'Bielik-11B-v3.1-Instruct',
  alias: 'bielik-11b-v3.1-instruct',
  repo: 'speakleash/Bielik-11B-v3.1-Instruct-GGUF',
  revision: '84799dfb90cb5f827ecc35f32166d0a139ceb59f',
};

const BIELIK_4_5B: ModelRepo = {
  label: 'Bielik-4.5B-v3.0-Instruct',
  alias: 'bielik-4.5b-v3.0-instruct',
  repo: 'speakleash/Bielik-4.5B-v3.0-Instruct-GGUF',
  revision: 'f9b3ef0abcc8c37136800c6c66b46d8d9ea60830',
};

function gguf(
  model: ModelRepo,
  id: ModelId,
  quantization: string,
  file: string,
  sizeBytes: number,
  sha256: string,
): ModelFile {
  const url = `https://huggingface.co/${model.repo}/resolve/${model.revision}/${file}`;
  return { ...model, id, quantization, file, url, sizeBytes, sha256 };
}

/** Sizes and SHA-256 (`lfs.oid`) from https://huggingface.co/api/models/<repo>/tree/main, 21.11.2026. */
export const MODEL_FILES: Readonly<Record<ModelId, ModelFile>> = {
  'bielik-4.5b-v3.0-q8_0': gguf(
    BIELIK_4_5B,
    'bielik-4.5b-v3.0-q8_0',
    'Q8_0',
    'Bielik-4.5B-v3.0-Instruct.Q8_0.gguf',
    5_061_215_424,
    '77eafc61197b394566939c7963c66861bb284eec6b183c56f5e531116b724aa6',
  ),
  'bielik-11b-v3.1-q4_k_m': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q4_k_m',
    'Q4_K_M',
    'Bielik-11B-v3.1-Instruct.Q4_K_M.gguf',
    6_724_115_232,
    '2b417a21c0e3dacf7e6e64c0aed4d18f43482f00a7f08e85915a9852b4d21d2a',
  ),
  'bielik-11b-v3.1-q5_k_m': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q5_k_m',
    'Q5_K_M',
    'Bielik-11B-v3.1-Instruct.Q5_K_M.gguf',
    7_907_105_568,
    '7f210531763baf136628c02df6a64e57b5ac31962c418e920def0533e83fd1d8',
  ),
  'bielik-11b-v3.1-q6_k': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q6_k',
    'Q6_K',
    'Bielik-11B-v3.1-Instruct.Q6_K.gguf',
    9_164_032_800,
    '292bab01830655ea8ac2416eb6bd84485df0e917e40d01d985574ba53f2d84a1',
  ),
  'bielik-11b-v3.1-q8_0': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q8_0',
    'Q8_0',
    'Bielik-11B-v3.1-Instruct.Q8_0.gguf',
    11_868_875_552,
    '05872343e783322fa2b0fa92461ebef1031251c7372931059f478c761cc92dfc',
  ),
};

export type BielikOneEngine = 'vllm' | 'mlx';
export type BielikOnePackageId = 'bielik-one-11b-v3.1-r1-adapter' | 'bielik-one-4b-r1-adapter';

/** A Bielik-One adapter package (LoRA and decision heads over its unchanged base model). */
export interface BielikOnePackage {
  id: BielikOnePackageId;
  repo: string;
  revision: string;
  /** Port of `bielik-one frontend`, fixed by the launcher per package (backend runs one below). */
  port: number;
  /** GPU memory (vLLM, bfloat16) or unified memory (MLX) for base weights, adapter and cache. */
  requiredMiB: Readonly<Record<BielikOneEngine, number>>;
}

/** Revisions from https://huggingface.co/api/models/<repo>, 21.11.2026. Both repos are ungated. */
export const BIELIK_ONE_PACKAGES: Readonly<Record<BielikOnePackageId, BielikOnePackage>> = {
  'bielik-one-11b-v3.1-r1-adapter': {
    id: 'bielik-one-11b-v3.1-r1-adapter',
    repo: 'speakleash/Bielik-One-11B-v3.1-r1-Adapter',
    revision: 'e8ded5d3b6076ec82ca23d173e6e9460a7650580',
    port: 8026,
    requiredMiB: { vllm: 31 * 1024, mlx: 26 * 1024 },
  },
  'bielik-one-4b-r1-adapter': {
    id: 'bielik-one-4b-r1-adapter',
    repo: 'speakleash/Bielik-One-4B-r1-Adapter',
    revision: '9b543720409e112985bf977fb17a3dc91d845656',
    port: 8012,
    requiredMiB: { vllm: 13 * 1024, mlx: 9 * 1024 },
  },
};

/** bielik-one 1.2.0 has no PyPI release and no tags, so it is pinned to a commit of 17.11.2026. */
export const BIELIK_ONE_SOURCE = {
  repo: 'https://github.com/speakleash/bielik-one',
  commit: 'b92c1118d273a5fcdd3f556afbf077a7f5735892',
  python: '3.12',
} as const;
```

- [ ] **Step 3: Utwórz `infra/ai-runtime/src/llama-cpp-release.ts`**

```ts
import type { DownloadAsset } from './context.ts';
import { largestNvidia, type NvidiaGpu } from './hardware.ts';
import type { Architecture, OperatingSystem } from './machine.ts';

export type LlamaBackend = 'metal' | 'cuda' | 'vulkan' | 'cpu';

/** Stable llama.cpp v1.0.0 is a tag on nightly build b12359, whose release holds the archives. */
export const LLAMA_CPP_RELEASE = { version: 'v1.0.0', build: 'b12359' } as const;

/** Archives for one platform and backend. The first holds llama-server, the rest add libraries. */
export interface LlamaCppBundle {
  key: string;
  backend: LlamaBackend;
  assets: readonly DownloadAsset[];
}

const RELEASE_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_RELEASE.build}/`;

const asset = (name: string, sizeBytes: number, sha256: string): DownloadAsset => ({
  name,
  url: `${RELEASE_URL}${name}`,
  sizeBytes,
  sha256,
});

// Sizes and digests from `gh api repos/ggml-org/llama.cpp/releases/tags/b12359`, 21.11.2026.
const BUNDLES = {
  'macos-metal-arm64': {
    backend: 'metal',
    assets: [
      asset(
        'llama-b12359-bin-macos-arm64.tar.gz',
        16_907_811,
        '82b00abc740160e1b9980e6cc79c117345fa34af058c80e6c0a69aa8ddccde75',
      ),
    ],
  },
  'macos-cpu-x64': {
    backend: 'cpu',
    assets: [
      asset(
        'llama-b12359-bin-macos-x64.tar.gz',
        12_661_621,
        '25320d529077ef5a3d16e7b5da26438f221d88c8c0930a32b0c79457f5eede56',
      ),
    ],
  },
  'linux-vulkan-x64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-vulkan-x64.tar.gz',
        36_153_377,
        '19b60f00395a3f4954e46a5037695bc1d843404fc9d3124f82a612ecd8fbe9f0',
      ),
    ],
  },
  'linux-vulkan-arm64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-vulkan-arm64.tar.gz',
        29_435_221,
        '3f8ae812a58ac92e5a596ca9fbc988f52854d147c5a7fe1264dddc90c1d085b4',
      ),
    ],
  },
  'linux-cuda-12.8-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz',
        199_223_370,
        '50c937bec5bbd9f74c99138034f7403283ee21f1943f2429d7b1e4c079eafc11',
      ),
      asset(
        'cudart-llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz',
        594_371_571,
        '75a12d227f44a391608992329241765343bd143ee9445b90dc62e154ee726e5d',
      ),
    ],
  },
  'linux-cuda-13.5-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz',
        178_419_847,
        '9440f417615bed0e191acef03bff0249117d2be74335358265a6d28475a9baf0',
      ),
      asset(
        'cudart-llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz',
        444_078_822,
        '976a9146bb8a487a6ea701224d7fb14b05e494ab3c8f5c1799ffc4e5805d640c',
      ),
    ],
  },
  'linux-cuda-13.5-arm64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-cuda-13.5-arm64.tar.gz',
        173_529_798,
        'e12fd3ca9a599349cac5ec767825e17f8cab9dc2dab8d8e5b85d50ce21ef6d7d',
      ),
      asset(
        'cudart-llama-b12359-bin-ubuntu-cuda-13.5-arm64.tar.gz',
        559_874_231,
        '998f62318999710d398dad40821d1d037731f360791e41628d9dfcde207909d1',
      ),
    ],
  },
  'windows-vulkan-x64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-win-vulkan-x64.zip',
        38_090_643,
        'e8d18c6e4210cca87e7307c2ea78363ac8d158e4e1397358ec96ab70b53a0d5e',
      ),
    ],
  },
  'windows-vulkan-arm64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-win-vulkan-arm64.zip',
        26_027_698,
        '62cd50089cffdd825524a91c5a8819041eb75d8e2beacd6eca68194dba50574f',
      ),
    ],
  },
  'windows-cuda-12.4-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-win-cuda-12.4-x64.zip',
        318_976_332,
        'e9c0abf442e8339c06728366c1ad2c711332f9939c0c00603fb75d85fd44c914',
      ),
      asset(
        'cudart-llama-bin-win-cuda-12.4-x64.zip',
        391_443_627,
        '8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6',
      ),
    ],
  },
  'windows-cuda-13.5-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-win-cuda-13.5-x64.zip',
        179_546_112,
        '1de9ca1ff408d6e348ea0007c6880ad2393311a02e7799bcde26dc16daef03dd',
      ),
      asset(
        'cudart-llama-bin-win-cuda-13.5-x64.zip',
        426_314_199,
        'c2bf4cc202bfbaaa7a0b75f5082457c3811326947bb216059b72839d844e9cba',
      ),
    ],
  },
  'windows-cuda-13.5-arm64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-win-cuda-13.5-arm64.zip',
        167_147_417,
        'f40398808e74b88c3ccee904824667ef9825692843533e7fc22881ab2e4de9da',
      ),
      asset(
        'cudart-llama-bin-win-cuda-13.5-arm64.zip',
        278_821_062,
        'f89e7b2457f627d052dd99f42205ddfd01964454809754cdc649cffc74320dca',
      ),
    ],
  },
} satisfies Record<string, { backend: LlamaBackend; assets: readonly DownloadAsset[] }>;

type BundleKey = keyof typeof BUNDLES;

/**
 * Picks the llama.cpp archives for a platform: Metal on Apple silicon, CUDA when the NVIDIA
 * driver and card allow it, otherwise Vulkan, which also runs on the CPU alone.
 */
export function llamaCppBundle(
  os: OperatingSystem,
  arch: Architecture,
  nvidia: readonly NvidiaGpu[],
): LlamaCppBundle {
  const key = bundleKey(os, arch, nvidia);
  return { key, ...BUNDLES[key] };
}

function bundleKey(os: OperatingSystem, arch: Architecture, nvidia: readonly NvidiaGpu[]): BundleKey {
  if (os === 'macos') return arch === 'arm64' ? 'macos-metal-arm64' : 'macos-cpu-x64';
  const gpu = largestNvidia(nvidia);
  const cuda = gpu ? cudaBundleKey(os, arch, gpu) : null;
  return cuda ?? (`${os}-vulkan-${arch}` as const);
}

// CUDA 13 needs driver 580+ and compute capability 7.5+ (Turing). CUDA 12.4 needs driver 551.61+
// on Windows and CUDA 12.8 needs 570+ on Linux, and both still run Maxwell and Pascal (5.0+).
function cudaBundleKey(
  os: 'linux' | 'windows',
  arch: Architecture,
  gpu: NvidiaGpu,
): BundleKey | null {
  if (gpu.driverMajor >= 580 && gpu.computeCapability >= 7.5) {
    return `${os}-cuda-13.5-${arch}` as const;
  }
  if (arch !== 'x64' || gpu.computeCapability < 5) return null;
  if (os === 'linux') return gpu.driverMajor >= 570 ? 'linux-cuda-12.8-x64' : null;
  return gpu.driverMajor >= 552 ? 'windows-cuda-12.4-x64' : null;
}
```

- [ ] **Step 4: Utwórz `infra/ai-runtime/src/recommend.ts`**

```ts
import { largestNvidia, type Hardware } from './hardware.ts';
import { llamaCppBundle, type LlamaCppBundle } from './llama-cpp-release.ts';
import {
  BIELIK_ONE_PACKAGES,
  MODEL_FILES,
  type BielikOneEngine,
  type BielikOnePackage,
  type ModelFile,
  type ModelId,
} from './models.ts';

export type InstallProfile = 'light' | 'standard' | 'server';

export interface RuntimeRecommendation {
  /** AI is on by default in every profile except light (ADR 0003, ADR 0005). */
  enabledByDefault: boolean;
  llamaCpp: LlamaCppBundle;
  /** Null when the machine is too weak even for Bielik-4.5B. */
  model: ModelFile | null;
  /** Only on vLLM (Linux, NVIDIA) or MLX (Apple silicon), and only when it fits next to the text model. */
  bielikOne: { engine: BielikOneEngine; package: BielikOnePackage } | null;
  /** llama-server settings for the profile. */
  server: { contextSize: number; parallel: number };
  /** One sentence for the installer screen, in Polish. */
  reason: string;
}

export interface RecommendOptions {
  /** A model chosen by hand instead of the tier. */
  model?: ModelId;
}

const MiB = 1024 * 1024;
const GiB_IN_MiB = 1024;
// Thresholds sit below the nominal sizes: an "8 GB" card reports 8188 MiB, an "8 GB" laptop ~7.6 GiB.
const MIN_RAM_MiB = 7 * GiB_IN_MiB;
const MIN_GPU_MiB = 7.5 * GiB_IN_MiB;
const MIN_MAC_RAM_MiB = 15 * GiB_IN_MiB;
// Metal may use about three quarters of unified memory.
const METAL_SHARE = 0.75;
// KV cache for a 16k context and compute buffers next to the weights on a server.
const SERVER_HEADROOM_MiB = 4 * GiB_IN_MiB;
// Memory left free when Bielik-One runs next to the text model.
const BIELIK_ONE_HEADROOM_MiB = 2 * GiB_IN_MiB;
const SERVER_QUANTS: readonly ModelId[] = [
  'bielik-11b-v3.1-q8_0',
  'bielik-11b-v3.1-q6_k',
  'bielik-11b-v3.1-q5_k_m',
  'bielik-11b-v3.1-q4_k_m',
];
const BIELIK_ONE_BY_SIZE: readonly BielikOnePackage[] = [
  BIELIK_ONE_PACKAGES['bielik-one-11b-v3.1-r1-adapter'],
  BIELIK_ONE_PACKAGES['bielik-one-4b-r1-adapter'],
];

/**
 * Tier of the local model for a machine and an install profile (ADR 0005). No GPU gives
 * Bielik-4.5B Q8_0, a GPU with 8 GB or a Mac with 16 GB gives Bielik-11B Q4_K_M, and the server
 * profile takes the highest 11B quantization that fits. Pure: no I/O.
 */
export function recommendRuntime(
  hardware: Hardware,
  profile: InstallProfile,
  options: RecommendOptions = {},
): RuntimeRecommendation {
  const { model, reason } = chooseModel(hardware, profile, options);
  const bielikOne = model ? chooseBielikOne(hardware, profile, model) : null;
  const engineName = bielikOne?.engine === 'vllm' ? 'vLLM' : 'MLX';
  return {
    enabledByDefault: profile !== 'light' && model !== null,
    llamaCpp: llamaCppBundle(hardware.os, hardware.arch, hardware.nvidia),
    model,
    bielikOne,
    server:
      profile === 'server' ? { contextSize: 16_384, parallel: 4 } : { contextSize: 8192, parallel: 2 },
    reason: bielikOne ? `${reason} Obok zmieści się Bielik-One (${engineName}).` : reason,
  };
}

const isAppleSilicon = (hardware: Hardware): boolean =>
  hardware.os === 'macos' && hardware.arch === 'arm64';
const sizeMiB = (model: ModelFile): number => model.sizeBytes / MiB;
const gb = (mib: number): number => Math.round(mib / GiB_IN_MiB);

function dedicatedGpuMiB(hardware: Hardware): number {
  return Math.max(
    0,
    ...hardware.nvidia.map((gpu) => gpu.memoryMiB),
    ...hardware.devices.filter((device) => !device.integrated).map((device) => device.memoryMiB),
  );
}

function chooseModel(
  hardware: Hardware,
  profile: InstallProfile,
  options: RecommendOptions,
): { model: ModelFile | null; reason: string } {
  if (options.model) {
    const model = MODEL_FILES[options.model];
    return { model, reason: `Model wybrany ręcznie: ${model.label} ${model.quantization}.` };
  }
  const apple = isAppleSilicon(hardware);
  const gpuMiB = dedicatedGpuMiB(hardware);
  if (apple ? hardware.memoryMiB >= MIN_MAC_RAM_MiB : gpuMiB >= MIN_GPU_MiB) {
    const budget = apple ? hardware.memoryMiB * METAL_SHARE : gpuMiB;
    const model =
      profile === 'server' ? largestFitting(budget) : MODEL_FILES['bielik-11b-v3.1-q4_k_m'];
    const where = apple
      ? `Mac z procesorem Apple i ${gb(hardware.memoryMiB)} GB pamięci`
      : `Karta graficzna z ${gb(gpuMiB)} GB pamięci`;
    return { model, reason: `${where}: ${model.label} w kwantyzacji ${model.quantization}.` };
  }
  if (hardware.memoryMiB >= MIN_RAM_MiB) {
    const model = MODEL_FILES['bielik-4.5b-v3.0-q8_0'];
    return {
      model,
      reason: `Brak karty graficznej z co najmniej 8 GB pamięci: ${model.label} w kwantyzacji ${model.quantization}.`,
    };
  }
  return {
    model: null,
    reason: `Za mało pamięci RAM na lokalny model (${gb(hardware.memoryMiB)} GB, potrzeba 8 GB). Moduł AI pozostaje wyłączony.`,
  };
}

function largestFitting(budgetMiB: number): ModelFile {
  const fitting = SERVER_QUANTS.map((id) => MODEL_FILES[id]).find(
    (model) => sizeMiB(model) + SERVER_HEADROOM_MiB <= budgetMiB,
  );
  return fitting ?? MODEL_FILES['bielik-11b-v3.1-q4_k_m'];
}

function chooseBielikOne(
  hardware: Hardware,
  profile: InstallProfile,
  model: ModelFile,
): RuntimeRecommendation['bielikOne'] {
  if (profile === 'light') return null;
  const nvidia = largestNvidia(hardware.nvidia);
  // vLLM runs on Linux, and bfloat16 (the calibrated precision) needs compute capability 8.0.
  const vllm =
    hardware.os === 'linux' &&
    hardware.arch === 'x64' &&
    nvidia !== undefined &&
    nvidia.computeCapability >= 8;
  const engine: BielikOneEngine | null = isAppleSilicon(hardware) ? 'mlx' : vllm ? 'vllm' : null;
  if (!engine) return null;
  const memory = engine === 'mlx' ? hardware.memoryMiB * METAL_SHARE : (nvidia?.memoryMiB ?? 0);
  const budget = memory - sizeMiB(model) - BIELIK_ONE_HEADROOM_MiB;
  const pkg = BIELIK_ONE_BY_SIZE.find((candidate) => candidate.requiredMiB[engine] <= budget);
  return pkg ? { engine, package: pkg } : null;
}
```

- [ ] **Step 5: Dopisz na końcu `infra/ai-runtime/src/index.ts`**

```ts
export type { DownloadAsset, ProgressEvent, RuntimeContext } from './context.ts';
export { BIELIK_ONE_PACKAGES, MODEL_FILES } from './models.ts';
export type {
  BielikOneEngine,
  BielikOnePackage,
  BielikOnePackageId,
  ModelFile,
  ModelId,
} from './models.ts';
export { LLAMA_CPP_RELEASE } from './llama-cpp-release.ts';
export type { LlamaBackend, LlamaCppBundle } from './llama-cpp-release.ts';
export { recommendRuntime } from './recommend.ts';
export type { InstallProfile, RecommendOptions, RuntimeRecommendation } from './recommend.ts';
```

- [ ] **Step 6: Utwórz `infra/ai-runtime/src/recommend.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  MODEL_FILES,
  recommendRuntime,
  type ComputeDevice,
  type Hardware,
  type InstallProfile,
  type LlamaBackend,
  type ModelId,
  type NvidiaGpu,
} from './index.ts';

const GiB = 1024;
const linuxLaptop: Hardware = { os: 'linux', arch: 'x64', memoryMiB: 16 * GiB, nvidia: [], devices: [] };
const mac = (memoryGiB: number): Hardware => ({
  os: 'macos',
  arch: 'arm64',
  memoryMiB: memoryGiB * GiB,
  nvidia: [],
  devices: [{ id: 'MTL0', name: 'Apple M2', memoryMiB: Math.round(memoryGiB * GiB * 0.74), integrated: true }],
});
const nvidia = (name: string, memoryMiB: number, driverMajor: number, computeCapability: number): NvidiaGpu => ({
  name,
  memoryMiB,
  driverMajor,
  computeCapability,
});
const withNvidia = (os: 'linux' | 'windows', gpu: NvidiaGpu): Hardware => ({
  os,
  arch: 'x64',
  memoryMiB: 32 * GiB,
  nvidia: [gpu],
  devices: [],
});
const device = (id: string, name: string, memoryMiB: number, integrated: boolean): ComputeDevice => ({
  id,
  name,
  memoryMiB,
  integrated,
});

const RTX_4070 = nvidia('NVIDIA GeForce RTX 4070', 12282, 580, 8.9);
const RTX_4090 = nvidia('NVIDIA GeForce RTX 4090', 24564, 580, 8.9);
const RTX_6000_ADA = nvidia('NVIDIA RTX 6000 Ada Generation', 49140, 580, 8.9);
const RADEON_WITH_IGPU: Hardware = {
  ...linuxLaptop,
  os: 'windows',
  devices: [
    device('Vulkan0', 'AMD Radeon RX 7800 XT', 16368, false),
    device('Vulkan1', 'Intel(R) UHD Graphics 770', 16271, true),
  ],
};

describe('recommendRuntime: model tier', () => {
  it('gives Bielik-4.5B Q8_0 on a machine without a GPU', () => {
    const recommendation = recommendRuntime(linuxLaptop, 'standard');
    expect(recommendation.model?.id).toBe('bielik-4.5b-v3.0-q8_0');
    expect(recommendation.enabledByDefault).toBe(true);
    expect(recommendation.bielikOne).toBeNull();
    expect(recommendation.server).toEqual({ contextSize: 8192, parallel: 2 });
  });

  it('keeps AI off by default in the light profile', () => {
    const recommendation = recommendRuntime(linuxLaptop, 'light');
    expect(recommendation.enabledByDefault).toBe(false);
    expect(recommendation.model?.id).toBe('bielik-4.5b-v3.0-q8_0');
  });

  it('recommends no model below 8 GB of RAM', () => {
    const recommendation = recommendRuntime({ ...linuxLaptop, memoryMiB: 6 * GiB }, 'standard');
    expect(recommendation.model).toBeNull();
    expect(recommendation.enabledByDefault).toBe(false);
  });

  it.each<[string, Hardware]>([
    ['a Mac with 16 GB', mac(16)],
    ['an 8 GB RTX 4060', withNvidia('linux', nvidia('NVIDIA GeForce RTX 4060', 8188, 580, 8.9))],
    ['a 12 GB RTX 4070', withNvidia('linux', RTX_4070)],
    ['a 16 GB Radeon seen through Vulkan', RADEON_WITH_IGPU],
  ])('gives Bielik-11B Q4_K_M on %s', (_name, hardware) => {
    expect(recommendRuntime(hardware, 'standard').model?.id).toBe('bielik-11b-v3.1-q4_k_m');
  });

  it('does not count integrated graphics as a GPU', () => {
    const hardware: Hardware = {
      ...linuxLaptop,
      devices: [device('Vulkan0', 'Intel(R) Iris(R) Xe Graphics (RPL-P)', 7854, true)],
    };
    expect(recommendRuntime(hardware, 'standard').model?.id).toBe('bielik-4.5b-v3.0-q8_0');
  });

  it.each<[string, Hardware, ModelId]>([
    ['a 12 GB card', withNvidia('linux', RTX_4070), 'bielik-11b-v3.1-q5_k_m'],
    ['a 24 GB card', withNvidia('linux', RTX_4090), 'bielik-11b-v3.1-q8_0'],
    ['a Mac with 16 GB', mac(16), 'bielik-11b-v3.1-q5_k_m'],
    ['a Mac with 32 GB', mac(32), 'bielik-11b-v3.1-q8_0'],
  ])('takes a higher quantization on a server with %s', (_name, hardware, expected) => {
    const recommendation = recommendRuntime(hardware, 'server');
    expect(recommendation.model?.id).toBe(expected);
    expect(recommendation.server).toEqual({ contextSize: 16_384, parallel: 4 });
  });

  it('uses a model chosen by hand', () => {
    const recommendation = recommendRuntime(linuxLaptop, 'standard', { model: 'bielik-11b-v3.1-q4_k_m' });
    expect(recommendation.model?.id).toBe('bielik-11b-v3.1-q4_k_m');
    expect(recommendation.reason).toContain('ręcznie');
  });
});

const PLATFORMS: [string, Hardware, LlamaBackend, string[]][] = [
  ['Mac on Apple silicon', mac(16), 'metal', ['llama-b12359-bin-macos-arm64.tar.gz']],
  ['Intel Mac', { ...mac(16), arch: 'x64', devices: [] }, 'cpu', ['llama-b12359-bin-macos-x64.tar.gz']],
  ['Linux without NVIDIA', linuxLaptop, 'vulkan', ['llama-b12359-bin-ubuntu-vulkan-x64.tar.gz']],
  ['Linux on arm64', { ...linuxLaptop, arch: 'arm64' }, 'vulkan', ['llama-b12359-bin-ubuntu-vulkan-arm64.tar.gz']],
  [
    'Linux with driver 580 and an Ada card',
    withNvidia('linux', RTX_4070),
    'cuda',
    ['llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz', 'cudart-llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz'],
  ],
  [
    'Linux with a Pascal card',
    withNvidia('linux', nvidia('NVIDIA GeForce GTX 1080', 8192, 580, 6.1)),
    'cuda',
    ['llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz', 'cudart-llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz'],
  ],
  [
    'Windows with driver 560',
    withNvidia('windows', nvidia('NVIDIA GeForce RTX 3060', 12288, 560, 8.6)),
    'cuda',
    ['llama-b12359-bin-win-cuda-12.4-x64.zip', 'cudart-llama-bin-win-cuda-12.4-x64.zip'],
  ],
  [
    'Windows with an old driver',
    withNvidia('windows', nvidia('NVIDIA GeForce GTX 750 Ti', 2048, 470, 5.0)),
    'vulkan',
    ['llama-b12359-bin-win-vulkan-x64.zip'],
  ],
  ['Windows without NVIDIA', RADEON_WITH_IGPU, 'vulkan', ['llama-b12359-bin-win-vulkan-x64.zip']],
];

describe('recommendRuntime: llama.cpp files', () => {
  it.each(PLATFORMS)('%s', (_name, hardware, backend, names) => {
    const bundle = recommendRuntime(hardware, 'standard').llamaCpp;
    expect(bundle.backend).toBe(backend);
    expect(bundle.assets.map((asset) => asset.name)).toEqual(names);
  });

  it('pins every archive to the b12359 release by URL, size and SHA-256', () => {
    for (const [, hardware] of PLATFORMS) {
      for (const asset of recommendRuntime(hardware, 'standard').llamaCpp.assets) {
        expect(asset.url).toBe(
          `https://github.com/ggml-org/llama.cpp/releases/download/b12359/${asset.name}`,
        );
        expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(asset.sizeBytes).toBeGreaterThan(1_000_000);
      }
    }
  });
});

describe('recommendRuntime: Bielik-One', () => {
  it('fits Bielik-One-4B on MLX next to the text model on a Mac with 32 GB', () => {
    const recommendation = recommendRuntime(mac(32), 'standard');
    expect(recommendation.bielikOne?.engine).toBe('mlx');
    expect(recommendation.bielikOne?.package.id).toBe('bielik-one-4b-r1-adapter');
    expect(recommendation.reason).toContain('Bielik-One (MLX)');
  });

  it('has no room for Bielik-One on a Mac with 16 GB', () => {
    expect(recommendRuntime(mac(16), 'standard').bielikOne).toBeNull();
  });

  it('fits Bielik-One-4B on vLLM next to Q4_K_M on a 24 GB card', () => {
    const recommendation = recommendRuntime(withNvidia('linux', RTX_4090), 'standard');
    expect(recommendation.bielikOne).toMatchObject({ engine: 'vllm', package: { id: 'bielik-one-4b-r1-adapter' } });
  });

  it('fits Bielik-One-11B on vLLM next to Q8_0 on a 48 GB server card', () => {
    const recommendation = recommendRuntime(withNvidia('linux', RTX_6000_ADA), 'server');
    expect(recommendation.model?.id).toBe('bielik-11b-v3.1-q8_0');
    expect(recommendation.bielikOne).toMatchObject({
      engine: 'vllm',
      package: { id: 'bielik-one-11b-v3.1-r1-adapter' },
    });
  });

  it.each<[string, Hardware, InstallProfile]>([
    ['on Windows', withNvidia('windows', RTX_4090), 'standard'],
    ['in the light profile', withNvidia('linux', RTX_4090), 'light'],
  ])('leaves Bielik-One out %s', (_name, hardware, profile) => {
    expect(recommendRuntime(hardware, profile).bielikOne).toBeNull();
  });
});

describe('MODEL_FILES', () => {
  it('pins every model to a commit and a SHA-256', () => {
    for (const model of Object.values(MODEL_FILES)) {
      expect(model.url).toBe(`https://huggingface.co/${model.repo}/resolve/${model.revision}/${model.file}`);
      expect(model.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(model.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
```

- [ ] **Step 7: Commit**

```bash
rtk pnpm exec prettier --write infra/ai-runtime
rtk git add infra/ai-runtime
rtk git commit -m "feat(ai-runtime): bielik model tiers and pinned llama.cpp v1.0.0 archives" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 4: Pobieranie z kontrolą sum i instalacja llama.cpp

Pobieranie jest wewnętrzne (`download.ts`) i wspólne dla archiwów llama.cpp i modeli. Plik trafia najpierw do `.part`, a dopiero po zgodności rozmiaru i SHA-256 dostaje docelową nazwę i znacznik `.sha256`, więc przerwane pobieranie nigdy nie udaje gotowego pliku. Testy pobierania są w Task 5, przez `prepareLlamaServer` na lokalnym serwerze HTTP.

Rozpakowanie idzie przez systemowy `tar` wywołany przez `Machine`. Paczka macOS zawiera dowiązania symboliczne bibliotek (`libllama.dylib -> libllama.1.dylib`), które biblioteki zip w JS gubią. Na Windows 10 od 1803 `tar.exe` (bsdtar) rozpakowuje zip, na Linuksie wszystkie paczki to `tar.gz`. Paczka macOS ma katalog `llama-b12359/`, więc katalog z llama-server wyszukujemy, zamiast zakładać układ. Archiwa `cudart` rozpakowujemy płasko obok llama-server, żeby loader znalazł biblioteki CUDA.

**Files:**
- Create: `infra/ai-runtime/src/download.ts`, `infra/ai-runtime/src/llama-cpp-install.ts`, `infra/ai-runtime/src/data-dir.ts`
- Modify: `infra/ai-runtime/src/index.ts`
- Test: `infra/ai-runtime/src/data-dir.test.ts`

- [ ] **Step 1: Utwórz `infra/ai-runtime/src/download.ts`**

```ts
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DownloadAsset, RuntimeContext } from './context.ts';

const REPORT_EVERY_BYTES = 16 * 1024 * 1024;

/**
 * Downloads `asset` to `destination` and checks its size and SHA-256. A file verified earlier is
 * kept without a new download. A wrong download is deleted and reported as an error.
 */
export async function downloadVerified(
  asset: DownloadAsset,
  destination: string,
  ctx: Pick<RuntimeContext, 'onProgress'>,
): Promise<string> {
  const marker = `${destination}.sha256`;
  const verified = (await readTextOrNull(marker)) === asset.sha256;
  if (verified && (await sizeOrNull(destination)) === asset.sizeBytes) return destination;

  await mkdir(dirname(destination), { recursive: true });
  await rm(marker, { force: true });
  const partial = `${destination}.part`;
  const response = await fetch(asset.url);
  if (!response.ok || !response.body) {
    throw new Error(`Download of ${asset.name} failed with HTTP ${response.status}: ${asset.url}`);
  }
  const hash = createHash('sha256');
  const file = await open(partial, 'w');
  let received = 0;
  let reported = 0;
  try {
    // The web stream yields Uint8Array chunks, but its Node typings iterate as any.
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      await file.write(chunk);
      received += chunk.byteLength;
      if (received - reported >= REPORT_EVERY_BYTES || received === asset.sizeBytes) {
        reported = received;
        ctx.onProgress?.({
          kind: 'download',
          file: asset.name,
          receivedBytes: received,
          totalBytes: asset.sizeBytes,
        });
      }
    }
  } finally {
    await file.close();
  }
  const sha256 = hash.digest('hex');
  if (received !== asset.sizeBytes || sha256 !== asset.sha256) {
    await rm(partial, { force: true });
    throw new Error(
      `Checksum mismatch for ${asset.name}: expected ${asset.sha256} (${asset.sizeBytes} B), got ${sha256} (${received} B)`,
    );
  }
  await rename(partial, destination);
  await writeFile(marker, asset.sha256);
  return destination;
}

export async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function sizeOrNull(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Utwórz `infra/ai-runtime/src/llama-cpp-install.ts`**

```ts
import { lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { RuntimeContext } from './context.ts';
import { downloadVerified, readTextOrNull } from './download.ts';
import { LLAMA_CPP_RELEASE, type LlamaBackend, type LlamaCppBundle } from './llama-cpp-release.ts';

/** An installed llama.cpp: the directory with llama-server, llama-bench and their libraries. */
export interface LlamaCpp {
  dir: string;
  serverPath: string;
  benchPath: string;
  backend: LlamaBackend;
  build: string;
}

const INSTALL_MARKER = '.sarmata-install.json';

/**
 * Downloads, verifies and unpacks a llama.cpp bundle into `<dataDir>/llama.cpp/<build>-<key>`.
 * Extra archives (the CUDA runtime) land next to llama-server so it finds their libraries.
 * A finished install of the same archives is reused without downloading.
 */
export async function installLlamaCpp(bundle: LlamaCppBundle, ctx: RuntimeContext): Promise<LlamaCpp> {
  const dir = join(ctx.dataDir, 'llama.cpp', `${LLAMA_CPP_RELEASE.build}-${bundle.key}`);
  const exe = ctx.machine.os === 'windows' ? '.exe' : '';
  const llama: LlamaCpp = {
    dir,
    serverPath: join(dir, `llama-server${exe}`),
    benchPath: join(dir, `llama-bench${exe}`),
    backend: bundle.backend,
    build: LLAMA_CPP_RELEASE.build,
  };
  const fingerprint = JSON.stringify(bundle.assets.map((asset) => asset.sha256));
  if ((await readTextOrNull(join(dir, INSTALL_MARKER))) === fingerprint) return llama;

  const staging = `${dir}.staging`;
  await rm(dir, { recursive: true, force: true });
  await rm(staging, { recursive: true, force: true });
  await mkdir(dirname(dir), { recursive: true });
  for (const [index, asset] of bundle.assets.entries()) {
    ctx.onProgress?.({ kind: 'step', message: `Pobieranie ${asset.name}` });
    const archive = await downloadVerified(asset, join(ctx.dataDir, 'downloads', asset.name), ctx);
    const target = join(staging, String(index));
    await mkdir(target, { recursive: true });
    ctx.onProgress?.({ kind: 'step', message: `Rozpakowywanie ${asset.name}` });
    const unpacked = await ctx.machine.run('tar', ['-xf', archive, '-C', target]);
    if (unpacked.exitCode !== 0) {
      throw new Error(`Unpacking ${asset.name} failed: ${unpacked.stderr.trim()}`);
    }
    if (index === 0) {
      const server = await findFile(target, basename(llama.serverPath));
      if (!server) throw new Error(`${asset.name} does not contain ${basename(llama.serverPath)}`);
      await rename(dirname(server), dir);
    } else {
      await moveFilesFlat(target, dir);
    }
    await rm(archive, { force: true });
    await rm(`${archive}.sha256`, { force: true });
  }
  await rm(staging, { recursive: true, force: true });
  await writeFile(join(dir, INSTALL_MARKER), fingerprint);
  return llama;
}

async function findFile(root: string, name: string): Promise<string | null> {
  const entries = await readdir(root, { recursive: true });
  const match = entries.find((entry) => basename(entry) === name);
  return match === undefined ? null : join(root, match);
}

async function moveFilesFlat(from: string, to: string): Promise<void> {
  for (const entry of await readdir(from, { recursive: true })) {
    const source = join(from, entry);
    if ((await lstat(source)).isDirectory()) continue;
    const target = join(to, basename(entry));
    await rm(target, { force: true });
    await rename(source, target);
  }
}
```

- [ ] **Step 3: Utwórz `infra/ai-runtime/src/data-dir.ts`**

```ts
import { posix, win32 } from 'node:path';
import type { OperatingSystem } from './machine.ts';

// An empty variable counts as unset, like in the XDG spec.
const nonEmpty = (value: string | undefined): string | undefined => (value === '' ? undefined : value);

/** Per-user application data directory for the AI runtime: binaries, models, logs, config. */
export function defaultDataDir(
  os: OperatingSystem,
  env: Readonly<Record<string, string | undefined>>,
  home: string,
): string {
  if (os === 'windows') {
    return win32.join(nonEmpty(env.LOCALAPPDATA) ?? win32.join(home, 'AppData', 'Local'), 'sarmata', 'ai');
  }
  if (os === 'macos') return posix.join(home, 'Library', 'Application Support', 'sarmata', 'ai');
  return posix.join(nonEmpty(env.XDG_DATA_HOME) ?? posix.join(home, '.local', 'share'), 'sarmata', 'ai');
}
```

- [ ] **Step 4: Dopisz na końcu `infra/ai-runtime/src/index.ts`**

```ts
export { installLlamaCpp } from './llama-cpp-install.ts';
export type { LlamaCpp } from './llama-cpp-install.ts';
export { defaultDataDir } from './data-dir.ts';
```

- [ ] **Step 5: Utwórz `infra/ai-runtime/src/data-dir.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { defaultDataDir } from './index.ts';

describe('defaultDataDir', () => {
  it.each([
    ['macos', {}, '/Users/ala', '/Users/ala/Library/Application Support/sarmata/ai'],
    ['linux', {}, '/home/ala', '/home/ala/.local/share/sarmata/ai'],
    ['linux', { XDG_DATA_HOME: '/srv/data' }, '/home/ala', '/srv/data/sarmata/ai'],
    [
      'windows',
      { LOCALAPPDATA: 'C:\\Users\\Ala\\AppData\\Local' },
      'C:\\Users\\Ala',
      'C:\\Users\\Ala\\AppData\\Local\\sarmata\\ai',
    ],
  ] as const)('%s with %o', (os, env, home, expected) => {
    expect(defaultDataDir(os, env, home)).toBe(expected);
  });
});
```

- [ ] **Step 6: Commit**

```bash
rtk pnpm exec prettier --write infra/ai-runtime
rtk git add infra/ai-runtime
rtk git commit -m "feat(ai-runtime): verified downloads and llama.cpp install into the app data dir" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 5: llama-server: przygotowanie, benchmark, start, health, stop

`prepareLlamaServer` pobiera model, wybiera urządzenie i zapisuje `llama-server.json` w katalogu danych. Wybór urządzenia: brak GPU to `--device none`. Apple Silicon to zawsze `MTL0` bez benchmarku (pamięć zunifikowana, Metal zawsze wygrywa). W pozostałych przypadkach krótki `llama-bench` (prompt 128, generowanie 32, jedno powtórzenie) najpierw na CPU (`-ngl 0`), potem na najlepszym GPU (CUDA przed Vulkan, karta dedykowana przed zintegrowaną, większa pamięć). GPU wygrywa, gdy generuje co najmniej tak szybko jak CPU. Nieudany przebieg na GPU (np. błąd sterownika Vulkan) oznacza CPU.

Polecenie serwera: `--jinja` (szablony czatu Bielika z narzędziami), `--alias` (nazwa modelu w API, czyli `AI_MODEL`), `--ctx-size` z `--parallel` i `--kv-unified` (sloty dzielą jedną pulę KV), `--no-webui`, `--device`. Przy GPU nie ustawiamy `--gpu-layers`, bo domyślne `--fit on` dopasowuje liczbę warstw do pamięci. Health: `GET /v1/health` zwraca 200 i `{"status":"ok"}` po wczytaniu modelu, a 503 w trakcie (README serwera, b12359).

Proces startuje z dopisywaniem stdout i stderr do `logFile`. `detached: true` zostawia serwer po wyjściu skryptu (dev). Przed startem sprawdzamy, czy pod adresem nie odpowiada już inny serwer, bo inaczej health check zgłosiłby cudzą gotowość.

**Files:**
- Create: `infra/ai-runtime/src/process.ts`, `infra/ai-runtime/src/llama-server.ts`, `infra/ai-runtime/src/test-helpers.ts`
- Modify: `infra/ai-runtime/src/index.ts`
- Test: `infra/ai-runtime/src/llama-server.test.ts`

- [ ] **Step 1: Utwórz `infra/ai-runtime/src/process.ts`**

```ts
import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export interface StartOptions {
  /** Keep the server running after this process exits (dev scripts). Default false. */
  detached?: boolean;
  /** How long to wait for the health check before giving up. */
  readyTimeoutMs?: number;
}

export interface ManagedProcess {
  pid: number;
  logFile: string;
  exited(): boolean;
  exitCode(): number | null;
  stop(): Promise<void>;
}

const STOP_GRACE_MS = 10_000;
const POLL_MS = 500;

/** Starts a long-running command with stdout and stderr appended to `logFile`. */
export async function spawnLogged(
  command: string,
  args: readonly string[],
  options: { logFile: string; detached: boolean; env?: Readonly<Record<string, string>> },
): Promise<ManagedProcess> {
  await mkdir(dirname(options.logFile), { recursive: true });
  const log = await open(options.logFile, 'a');
  const child = spawn(command, [...args], {
    stdio: ['ignore', log.fd, log.fd],
    detached: options.detached,
    env: { ...process.env, ...options.env },
    windowsHide: true,
  });
  let exited = false;
  let exitCode: number | null = null;
  const exit = new Promise<void>((resolve) => {
    child.once('exit', (code) => {
      exited = true;
      exitCode = code;
      resolve();
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  } finally {
    await log.close();
  }
  if (options.detached) child.unref();
  const pid = child.pid;
  if (pid === undefined) throw new Error(`${command} started without a process id`);
  return {
    pid,
    logFile: options.logFile,
    exited: () => exited,
    exitCode: () => exitCode,
    async stop() {
      if (exited) return;
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), STOP_GRACE_MS);
      await exit;
      clearTimeout(force);
    },
  };
}

/** Polls `probe` until it says ready. Fails early when one of the processes exits. */
export async function waitUntilReady(
  name: string,
  probe: () => Promise<boolean>,
  processes: readonly ManagedProcess[],
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const dead = processes.find((managed) => managed.exited());
    if (dead) {
      throw new Error(
        `${name} exited with code ${dead.exitCode()} before it became ready, see ${dead.logFile}`,
      );
    }
    if (await probe()) return;
    await sleep(POLL_MS);
  }
  const logs = processes.map((managed) => managed.logFile).join(', ');
  throw new Error(`${name} did not become ready within ${Math.round(timeoutMs / 1000)} s, see ${logs}`);
}
```

- [ ] **Step 2: Utwórz `infra/ai-runtime/src/llama-server.ts`**

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuntimeContext } from './context.ts';
import { downloadVerified } from './download.ts';
import type { ComputeDevice, Hardware } from './hardware.ts';
import type { LlamaCpp } from './llama-cpp-install.ts';
import type { Machine } from './machine.ts';
import type { ModelFile } from './models.ts';
import { spawnLogged, waitUntilReady, type StartOptions } from './process.ts';

/** Everything needed to start llama-server, saved as `<dataDir>/llama-server.json`. */
export interface LlamaServerConfig {
  serverPath: string;
  modelPath: string;
  /** Model name in the OpenAI-compatible API, used as AI_MODEL. */
  alias: string;
  host: string;
  port: number;
  contextSize: number;
  parallel: number;
  /** llama.cpp device such as `MTL0`, `CUDA0` or `Vulkan0`, or `none` for the CPU. */
  device: string;
  logFile: string;
}

export interface Speed {
  promptTokensPerSecond: number;
  generationTokensPerSecond: number;
}

export interface Benchmark {
  gpuDevice: string;
  cpu: Speed;
  /** Null when the GPU run failed. */
  gpu: Speed | null;
}

export interface PrepareOptions {
  llama: LlamaCpp;
  hardware: Hardware;
  model: ModelFile;
  port: number;
  /** Default 127.0.0.1. */
  host?: string;
  contextSize: number;
  parallel: number;
}

export interface PreparedLlamaServer {
  config: LlamaServerConfig;
  /** Null when there was nothing to compare: no GPU, or Apple silicon where Metal always wins. */
  benchmark: Benchmark | null;
}

export interface RunningServer {
  /** OpenAI-compatible base URL ending with /v1, used as AI_BASE_URL. */
  url: string;
  pid: number;
  logFile: string;
  stop(): Promise<void>;
}

const CONFIG_FILE = 'llama-server.json';
const BENCH_ARGS = ['-p', '128', '-n', '32', '-r', '1', '-o', 'json'];
const BENCH_TIMEOUT_MS = 10 * 60 * 1000;
const READY_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Gets llama-server ready to start: downloads and verifies the model, picks the device (a short
 * CPU against GPU benchmark) and saves the configuration in the data directory.
 */
export async function prepareLlamaServer(
  options: PrepareOptions,
  ctx: RuntimeContext,
): Promise<PreparedLlamaServer> {
  const { model, llama } = options;
  ctx.onProgress?.({ kind: 'step', message: `Pobieranie modelu ${model.label} ${model.quantization}` });
  const modelPath = await downloadVerified(
    { name: model.file, url: model.url, sizeBytes: model.sizeBytes, sha256: model.sha256 },
    join(ctx.dataDir, 'models', model.file),
    ctx,
  );
  ctx.onProgress?.({ kind: 'step', message: 'Wybór urządzenia: procesor czy karta graficzna' });
  const { device, benchmark } = await chooseDevice(ctx.machine, llama, modelPath, options.hardware.devices);
  const config: LlamaServerConfig = {
    serverPath: llama.serverPath,
    modelPath,
    alias: model.alias,
    host: options.host ?? '127.0.0.1',
    port: options.port,
    contextSize: options.contextSize,
    parallel: options.parallel,
    device,
    logFile: join(ctx.dataDir, 'logs', 'llama-server.log'),
  };
  await writeFile(join(ctx.dataDir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
  return { config, benchmark };
}

/** The configuration saved by `prepareLlamaServer`, or null before the first setup. */
export async function readLlamaServerConfig(dataDir: string): Promise<LlamaServerConfig | null> {
  try {
    return JSON.parse(await readFile(join(dataDir, CONFIG_FILE), 'utf8')) as LlamaServerConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** The llama-server command line, also used by the installer to register a system service. */
export function llamaServerCommand(config: LlamaServerConfig): { command: string; args: string[] } {
  return {
    command: config.serverPath,
    args: [
      '--model',
      config.modelPath,
      '--alias',
      config.alias,
      '--host',
      config.host,
      '--port',
      String(config.port),
      '--ctx-size',
      String(config.contextSize),
      '--parallel',
      String(config.parallel),
      '--kv-unified',
      '--jinja',
      '--no-webui',
      '--device',
      config.device,
      ...(config.device === 'none' ? ['--gpu-layers', '0'] : []),
    ],
  };
}

/** Starts llama-server with its output in `config.logFile` and waits until the model is loaded. */
export async function startLlamaServer(
  config: LlamaServerConfig,
  options: StartOptions = {},
): Promise<RunningServer> {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  const url = `http://${host}:${config.port}/v1`;
  if (await isLlamaServerReady(url)) throw new Error(`Another server already answers at ${url}`);
  const { command, args } = llamaServerCommand(config);
  const server = await spawnLogged(command, args, {
    logFile: config.logFile,
    detached: options.detached ?? false,
  });
  try {
    await waitUntilReady(
      'llama-server',
      () => isLlamaServerReady(url),
      [server],
      options.readyTimeoutMs ?? READY_TIMEOUT_MS,
    );
  } catch (error) {
    await server.stop();
    throw error;
  }
  return { url, pid: server.pid, logFile: config.logFile, stop: () => server.stop() };
}

/** True when llama-server at the /v1 base `url` has loaded its model. */
export async function isLlamaServerReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: unknown };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

async function chooseDevice(
  machine: Machine,
  llama: LlamaCpp,
  modelPath: string,
  devices: readonly ComputeDevice[],
): Promise<{ device: string; benchmark: Benchmark | null }> {
  const gpu = bestGpu(devices);
  if (!gpu) return { device: 'none', benchmark: null };
  if (gpu.id.startsWith('MTL')) return { device: gpu.id, benchmark: null };
  const cpu = await measure(machine, llama, modelPath, ['-ngl', '0']);
  if (!cpu) throw new Error(`llama-bench could not run ${modelPath} on the CPU`);
  const onGpu = await measure(machine, llama, modelPath, ['-dev', gpu.id, '-ngl', '99']);
  const useGpu = onGpu !== null && onGpu.generationTokensPerSecond >= cpu.generationTokensPerSecond;
  return { device: useGpu ? gpu.id : 'none', benchmark: { gpuDevice: gpu.id, cpu, gpu: onGpu } };
}

function bestGpu(devices: readonly ComputeDevice[]): ComputeDevice | undefined {
  const score = (device: ComputeDevice): number =>
    (device.id.startsWith('CUDA') ? 2e6 : 0) + (device.integrated ? 0 : 1e6) + device.memoryMiB;
  return [...devices].sort((a, b) => score(b) - score(a))[0];
}

async function measure(
  machine: Machine,
  llama: LlamaCpp,
  modelPath: string,
  deviceArgs: readonly string[],
): Promise<Speed | null> {
  const result = await machine.run(llama.benchPath, ['-m', modelPath, ...BENCH_ARGS, ...deviceArgs], {
    timeoutMs: BENCH_TIMEOUT_MS,
  });
  return result.exitCode === 0 ? parseBench(result.stdout) : null;
}

// llama-bench -o json prints an array with one row per test: n_prompt > 0 for prompt processing,
// n_gen > 0 for generation, avg_ts in tokens per second (tools/llama-bench, b12359).
function parseBench(stdout: string): Speed | null {
  let rows: unknown;
  try {
    rows = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const speed: Speed = { promptTokensPerSecond: 0, generationTokensPerSecond: 0 };
  for (const row of rows as { n_prompt?: unknown; n_gen?: unknown; avg_ts?: unknown }[]) {
    if (typeof row.avg_ts !== 'number') continue;
    if (typeof row.n_gen === 'number' && row.n_gen > 0) speed.generationTokensPerSecond = row.avg_ts;
    else if (typeof row.n_prompt === 'number' && row.n_prompt > 0) speed.promptTokensPerSecond = row.avg_ts;
  }
  return speed.generationTokensPerSecond > 0 ? speed : null;
}
```

- [ ] **Step 3: Utwórz `infra/ai-runtime/src/test-helpers.ts`**

```ts
import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Test-only HTTP server on a random local port. Not exported from index.ts. */
export async function listen(
  handler: RequestListener,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** A local port that nothing listens on right now. */
export async function freePort(): Promise<number> {
  const { url, close } = await listen(() => undefined);
  await close();
  return Number(new URL(url).port);
}
```

- [ ] **Step 4: Dopisz na końcu `infra/ai-runtime/src/index.ts`**

```ts
export {
  isLlamaServerReady,
  llamaServerCommand,
  prepareLlamaServer,
  readLlamaServerConfig,
  startLlamaServer,
} from './llama-server.ts';
export type {
  Benchmark,
  LlamaServerConfig,
  PreparedLlamaServer,
  PrepareOptions,
  RunningServer,
  Speed,
} from './llama-server.ts';
export type { StartOptions } from './process.ts';
```

- [ ] **Step 5: Utwórz `infra/ai-runtime/src/llama-server.test.ts`**

```ts
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  fakeMachine,
  isLlamaServerReady,
  llamaServerCommand,
  MODEL_FILES,
  prepareLlamaServer,
  readLlamaServerConfig,
  startLlamaServer,
  type CommandResult,
  type ComputeDevice,
  type LlamaCpp,
  type LlamaServerConfig,
  type Machine,
  type ModelFile,
} from './index.ts';
import { freePort, listen } from './test-helpers.ts';

const LLAMA: LlamaCpp = {
  dir: '/opt/llama',
  serverPath: '/opt/llama/llama-server',
  benchPath: '/opt/llama/llama-bench',
  backend: 'vulkan',
  build: 'b12359',
};

const CONFIG: LlamaServerConfig = {
  serverPath: LLAMA.serverPath,
  modelPath: '/data/models/m.gguf',
  alias: 'bielik-11b-v3.1-instruct',
  host: '127.0.0.1',
  port: 55490,
  contextSize: 8192,
  parallel: 2,
  device: 'MTL0',
  logFile: '/data/logs/llama-server.log',
};

describe('llamaServerCommand', () => {
  it('starts llama-server with the model, the alias, Jinja templates and the chosen device', () => {
    expect(llamaServerCommand(CONFIG)).toEqual({
      command: '/opt/llama/llama-server',
      args: [
        '--model', '/data/models/m.gguf',
        '--alias', 'bielik-11b-v3.1-instruct',
        '--host', '127.0.0.1',
        '--port', '55490',
        '--ctx-size', '8192',
        '--parallel', '2',
        '--kv-unified',
        '--jinja',
        '--no-webui',
        '--device', 'MTL0',
      ],
    });
  });

  it('keeps every layer on the CPU when the device is none', () => {
    expect(llamaServerCommand({ ...CONFIG, device: 'none' }).args.slice(-4)).toEqual([
      '--device',
      'none',
      '--gpu-layers',
      '0',
    ]);
  });
});

describe('prepareLlamaServer', () => {
  const content = Buffer.from('GGUF test weights');
  const IGPU: ComputeDevice = {
    id: 'Vulkan0',
    name: 'Intel(R) Iris(R) Xe Graphics (RPL-P)',
    memoryMiB: 7854,
    integrated: true,
  };
  let dataDir: string;
  let requests: number;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'sarmata-ai-'));
    requests = 0;
    server = await listen((_request, response) => {
      requests += 1;
      response.end(content);
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const testModel = (overrides: Partial<ModelFile> = {}): ModelFile => ({
    ...MODEL_FILES['bielik-4.5b-v3.0-q8_0'],
    file: 'test.gguf',
    url: `${server.url}/test.gguf`,
    sizeBytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
    ...overrides,
  });

  const prepare = (machine: Machine, devices: ComputeDevice[], model: ModelFile = testModel()) =>
    prepareLlamaServer(
      {
        llama: LLAMA,
        hardware: { os: 'linux', arch: 'x64', memoryMiB: 16384, nvidia: [], devices },
        model,
        port: 55490,
        contextSize: 8192,
        parallel: 2,
      },
      { machine, dataDir },
    );

  const bench = (prompt: number, generation: number): CommandResult => ({
    exitCode: 0,
    stdout: JSON.stringify([
      { n_prompt: 128, n_gen: 0, avg_ts: prompt },
      { n_prompt: 0, n_gen: 32, avg_ts: generation },
    ]),
    stderr: '',
  });

  it('downloads and verifies the model once and uses Metal without a benchmark', async () => {
    const machine = fakeMachine({ os: 'macos', arch: 'arm64', totalMemoryGiB: 16 });
    const metal: ComputeDevice = { id: 'MTL0', name: 'Apple M2', memoryMiB: 12124, integrated: true };
    const first = await prepare(machine, [metal]);
    const second = await prepare(machine, [metal]);
    expect(requests).toBe(1);
    expect(machine.calls).toEqual([]);
    expect(first.benchmark).toBeNull();
    expect(second.config).toEqual(first.config);
    expect(first.config).toEqual({
      serverPath: LLAMA.serverPath,
      modelPath: join(dataDir, 'models', 'test.gguf'),
      alias: 'bielik-4.5b-v3.0-instruct',
      host: '127.0.0.1',
      port: 55490,
      contextSize: 8192,
      parallel: 2,
      device: 'MTL0',
      logFile: join(dataDir, 'logs', 'llama-server.log'),
    });
    expect(await readFile(first.config.modelPath)).toEqual(content);
    expect(await readLlamaServerConfig(dataDir)).toEqual(first.config);
  });

  it('rejects a download with a wrong checksum and keeps no file', async () => {
    const machine = fakeMachine({ os: 'linux', arch: 'x64', totalMemoryGiB: 16 });
    await expect(prepare(machine, [], testModel({ sha256: '0'.repeat(64) }))).rejects.toThrow(
      /Checksum mismatch/,
    );
    expect(existsSync(join(dataDir, 'models', 'test.gguf'))).toBe(false);
    expect(existsSync(join(dataDir, 'models', 'test.gguf.part'))).toBe(false);
  });

  it('benchmarks the CPU against the GPU and keeps the GPU when it is faster', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: { [LLAMA.benchPath]: (args) => (args.includes('-dev') ? bench(420, 9.5) : bench(35, 6.2)) },
    });
    const { config, benchmark } = await prepare(machine, [IGPU]);
    expect(config.device).toBe('Vulkan0');
    expect(benchmark).toEqual({
      gpuDevice: 'Vulkan0',
      cpu: { promptTokensPerSecond: 35, generationTokensPerSecond: 6.2 },
      gpu: { promptTokensPerSecond: 420, generationTokensPerSecond: 9.5 },
    });
    expect(machine.calls.map((call) => call.args.slice(-4))).toEqual([
      ['-o', 'json', '-ngl', '0'],
      ['-dev', 'Vulkan0', '-ngl', '99'],
    ]);
  });

  it('falls back to the CPU when the GPU run fails', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: {
        [LLAMA.benchPath]: (args) =>
          args.includes('-dev') ? { exitCode: 1, stdout: '', stderr: 'vk::DeviceLostError' } : bench(35, 6.2),
      },
    });
    const { config, benchmark } = await prepare(machine, [IGPU]);
    expect(config.device).toBe('none');
    expect(benchmark?.gpu).toBeNull();
  });
});

const FAKE_SERVER = `
const http = require('node:http');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]);
const startedAt = Date.now();
console.log('fake llama-server ' + args.join(' '));
http
  .createServer((request, response) => {
    if (request.url !== '/v1/health') {
      response.statusCode = 404;
      response.end();
      return;
    }
    const ready = Date.now() - startedAt > 300;
    response.statusCode = ready ? 200 : 503;
    response.setHeader('content-type', 'application/json');
    response.end(ready ? '{"status":"ok"}' : '{"error":{"code":503,"message":"Loading model"}}');
  })
  .listen(port, '127.0.0.1');
process.on('SIGTERM', () => process.exit(0));
`;

describe.skipIf(process.platform === 'win32')('startLlamaServer', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sarmata-llama-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const script = async (name: string, body: string): Promise<string> => {
    const path = join(dir, name);
    await writeFile(path, `#!/usr/bin/env node\n${body}\n`);
    await chmod(path, 0o755);
    return path;
  };

  it('waits for /v1/health, logs the output and stops the server', async () => {
    const port = await freePort();
    const config = {
      ...CONFIG,
      serverPath: await script('fake-llama-server.cjs', FAKE_SERVER),
      port,
      logFile: join(dir, 'logs', 'llama-server.log'),
    };
    const server = await startLlamaServer(config, { readyTimeoutMs: 10_000 });
    try {
      expect(server.url).toBe(`http://127.0.0.1:${port}/v1`);
      expect(await isLlamaServerReady(server.url)).toBe(true);
      expect(await readFile(config.logFile, 'utf8')).toContain('--jinja');
    } finally {
      await server.stop();
    }
    expect(await isLlamaServerReady(server.url)).toBe(false);
  }, 20_000);

  it('reports a server that exits before it is ready', async () => {
    const config = {
      ...CONFIG,
      serverPath: await script(
        'broken-llama-server.cjs',
        'console.error("failed to load model"); process.exit(3);',
      ),
      port: await freePort(),
      logFile: join(dir, 'broken.log'),
    };
    await expect(startLlamaServer(config, { readyTimeoutMs: 10_000 })).rejects.toThrow(
      /exited with code 3/,
    );
    expect(await readFile(config.logFile, 'utf8')).toContain('failed to load model');
  }, 20_000);
});
```

- [ ] **Step 6: Commit**

```bash
rtk pnpm exec prettier --write infra/ai-runtime
rtk git add infra/ai-runtime
rtk git commit -m "feat(ai-runtime): llama-server preparation, device benchmark and process control" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 6: Bielik-One przez uv

Bielik-One instalujemy w osobnym środowisku Python 3.12 przez `uv` (ADR 0003): `uv venv`, potem `uv pip install "bielik-one[vllm|mlx] @ <archiwum commita>"`, a dla vLLM także wtyczka głowic decyzyjnych `systemone-vllm-heads` (`--no-deps`, podkatalog `vllm-heads-plugin`), tak jak każe README bielik-one dla pakietów `-Adapter`. Źródłem jest archiwum `tar.gz` commita z GitHub, nie `git+`, więc maszyna nie potrzebuje gita. MLX działa tylko z pakietami `-Adapter`, dlatego `BIELIK_ONE_PACKAGES` zawiera wyłącznie adaptery.

Start to dwa procesy z README: `bielik-one backend <repo> --revision <rev>` (z `--engine mlx` na Macu) i `bielik-one frontend <repo> --revision <rev>`. Porty ustala launcher per pakiet (11B: backend 8025, frontend 8026, 4B: 8013 i 8012), więc ich nie nadpisujemy. Oba słuchają na `127.0.0.1`, a frontend nie ma uwierzytelniania (w profilu server wystawia go dopiero Caddy z planu 6). Pierwszy start pobiera pakiet i model bazowy do `<dataDir>/huggingface` (`HF_HOME`), co dla 11B oznacza ponad 20 GB, stąd domyślny limit gotowości 60 minut. Gotowość: `GET /health` zwraca `"status": "ok"` i `"calibrated": true`, a potem próbne `POST /v1/systemone` z pytaniem typu `noul` odpowiada 200.

**Files:**
- Create: `infra/ai-runtime/src/bielik-one.ts`
- Modify: `infra/ai-runtime/src/index.ts`
- Test: `infra/ai-runtime/src/bielik-one.test.ts`

- [ ] **Step 1: Utwórz `infra/ai-runtime/src/bielik-one.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuntimeContext } from './context.ts';
import { readTextOrNull } from './download.ts';
import { BIELIK_ONE_SOURCE, type BielikOneEngine, type BielikOnePackage } from './models.ts';
import { spawnLogged, waitUntilReady, type StartOptions } from './process.ts';

export interface BielikOneInstall {
  engine: BielikOneEngine;
  executable: string;
}

export interface BielikOneServer {
  /** Frontend base URL: `/v1/systemone` for decisions, `/health` for readiness. */
  url: string;
  stop(): Promise<void>;
}

const INSTALL_TIMEOUT_MS = 60 * 60 * 1000;
const READY_TIMEOUT_MS = 60 * 60 * 1000;

const SMOKE_DECISION = {
  model: 'decision',
  state: 'Wniosek o ocenę okresową złożono 3 marca 2026 r.',
  questions: {
    filed: {
      type: 'noul',
      instructions: 'Czy wniosek został złożony?',
      criteria: { true: 'Tak', false: 'Nie' },
    },
  },
};

/**
 * Installs bielik-one into its own Python 3.12 environment with uv (ADR 0003): vLLM on Linux with
 * NVIDIA, MLX on Apple silicon. A finished install of the pinned commit is reused.
 */
export async function installBielikOne(
  engine: BielikOneEngine,
  ctx: RuntimeContext,
): Promise<BielikOneInstall> {
  const { machine } = ctx;
  const supported =
    engine === 'vllm' ? machine.os === 'linux' : machine.os === 'macos' && machine.arch === 'arm64';
  if (!supported) throw new Error(`Bielik-One with ${engine} does not run on ${machine.os} ${machine.arch}`);

  const venv = join(ctx.dataDir, 'bielik-one', engine);
  const install: BielikOneInstall = { engine, executable: join(venv, 'bin', 'bielik-one') };
  const marker = join(venv, '.sarmata-install');
  if ((await readTextOrNull(marker)) === BIELIK_ONE_SOURCE.commit) return install;

  const uv = await machine.run('uv', ['--version'], { timeoutMs: 15_000 });
  if (uv.exitCode !== 0) {
    throw new Error('Installing Bielik-One needs uv on PATH (https://docs.astral.sh/uv/)');
  }
  const python = join(venv, 'bin', 'python');
  const archive = `${BIELIK_ONE_SOURCE.repo}/archive/${BIELIK_ONE_SOURCE.commit}.tar.gz`;
  const steps: string[][] = [
    ['venv', '--python', BIELIK_ONE_SOURCE.python, '--clear', venv],
    ['pip', 'install', '--python', python, `bielik-one[${engine}] @ ${archive}`],
  ];
  if (engine === 'vllm') {
    steps.push([
      'pip',
      'install',
      '--python',
      python,
      '--no-deps',
      `systemone-vllm-heads @ ${archive}#subdirectory=vllm-heads-plugin`,
    ]);
  }
  for (const args of steps) {
    ctx.onProgress?.({ kind: 'step', message: `Instalacja Bielik-One: uv ${args[0]}` });
    const result = await machine.run('uv', args, { timeoutMs: INSTALL_TIMEOUT_MS });
    if (result.exitCode !== 0) throw new Error(`uv ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  await mkdir(venv, { recursive: true });
  await writeFile(marker, BIELIK_ONE_SOURCE.commit);
  return install;
}

/**
 * Starts `bielik-one backend` and `bielik-one frontend` for an adapter package and waits until
 * the frontend answers calibrated decisions. The first start downloads the package and its base
 * model into `<dataDir>/huggingface`.
 */
export async function startBielikOne(
  install: BielikOneInstall,
  pkg: BielikOnePackage,
  ctx: RuntimeContext,
  options: StartOptions = {},
): Promise<BielikOneServer> {
  const logs = join(ctx.dataDir, 'logs');
  const env = { HF_HOME: join(ctx.dataDir, 'huggingface') };
  const detached = options.detached ?? false;
  const packageArgs = [pkg.repo, '--revision', pkg.revision];
  const engineArgs = install.engine === 'mlx' ? ['--engine', 'mlx'] : [];
  const backend = await spawnLogged(install.executable, ['backend', ...packageArgs, ...engineArgs], {
    logFile: join(logs, 'bielik-one-backend.log'),
    env,
    detached,
  });
  const frontend = await spawnLogged(install.executable, ['frontend', ...packageArgs], {
    logFile: join(logs, 'bielik-one-frontend.log'),
    env,
    detached,
  });
  const url = `http://127.0.0.1:${pkg.port}`;
  const stop = async (): Promise<void> => {
    await frontend.stop();
    await backend.stop();
  };
  try {
    await waitUntilReady(
      'Bielik-One',
      () => isBielikOneReady(url),
      [backend, frontend],
      options.readyTimeoutMs ?? READY_TIMEOUT_MS,
    );
  } catch (error) {
    await stop();
    throw error;
  }
  return { url, stop };
}

/** True when the frontend is calibrated and answers a one-question decision. */
export async function isBielikOneReady(url: string): Promise<boolean> {
  try {
    const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    if (!health.ok) return false;
    const body = (await health.json()) as { status?: unknown; calibrated?: unknown };
    if (body.status !== 'ok' || body.calibrated !== true) return false;
    const decision = await fetch(`${url}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(SMOKE_DECISION),
      signal: AbortSignal.timeout(30_000),
    });
    return decision.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Dopisz na końcu `infra/ai-runtime/src/index.ts`**

```ts
export { installBielikOne, isBielikOneReady, startBielikOne } from './bielik-one.ts';
export type { BielikOneInstall, BielikOneServer } from './bielik-one.ts';
```

- [ ] **Step 3: Utwórz `infra/ai-runtime/src/bielik-one.test.ts`**

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeMachine, installBielikOne, isBielikOneReady } from './index.ts';
import { freePort, listen } from './test-helpers.ts';

const ARCHIVE =
  'https://github.com/speakleash/bielik-one/archive/b92c1118d273a5fcdd3f556afbf077a7f5735892.tar.gz';
const UV_OK = { exitCode: 0, stdout: 'uv 0.13.9', stderr: '' };

describe('installBielikOne', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'sarmata-ai-'));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('installs the vLLM variant with uv from the pinned commit, once', async () => {
    const machine = fakeMachine({ os: 'linux', arch: 'x64', totalMemoryGiB: 64, commands: { uv: UV_OK } });
    const venv = join(dataDir, 'bielik-one', 'vllm');
    const python = join(venv, 'bin', 'python');
    expect(await installBielikOne('vllm', { machine, dataDir })).toEqual({
      engine: 'vllm',
      executable: join(venv, 'bin', 'bielik-one'),
    });
    expect(machine.calls.map((call) => [call.command, ...call.args])).toEqual([
      ['uv', '--version'],
      ['uv', 'venv', '--python', '3.12', '--clear', venv],
      ['uv', 'pip', 'install', '--python', python, `bielik-one[vllm] @ ${ARCHIVE}`],
      [
        'uv', 'pip', 'install', '--python', python, '--no-deps',
        `systemone-vllm-heads @ ${ARCHIVE}#subdirectory=vllm-heads-plugin`,
      ],
    ]);
    await installBielikOne('vllm', { machine, dataDir });
    expect(machine.calls).toHaveLength(4);
  });

  it('installs the MLX variant without the vLLM plugin', async () => {
    const machine = fakeMachine({ os: 'macos', arch: 'arm64', totalMemoryGiB: 32, commands: { uv: UV_OK } });
    const venv = join(dataDir, 'bielik-one', 'mlx');
    await installBielikOne('mlx', { machine, dataDir });
    expect(machine.calls.map((call) => call.args)).toEqual([
      ['--version'],
      ['venv', '--python', '3.12', '--clear', venv],
      ['pip', 'install', '--python', join(venv, 'bin', 'python'), `bielik-one[mlx] @ ${ARCHIVE}`],
    ]);
  });

  it('asks for uv when it is missing', async () => {
    const machine = fakeMachine({ os: 'linux', arch: 'x64', totalMemoryGiB: 64 });
    await expect(installBielikOne('vllm', { machine, dataDir })).rejects.toThrow(/needs uv/);
  });

  it('refuses an engine the platform cannot run', async () => {
    const on = (os: 'linux' | 'macos' | 'windows') =>
      ({ machine: fakeMachine({ os, arch: 'arm64', totalMemoryGiB: 64, commands: { uv: UV_OK } }), dataDir });
    await expect(installBielikOne('vllm', on('windows'))).rejects.toThrow(/does not run/);
    await expect(installBielikOne('vllm', on('macos'))).rejects.toThrow(/does not run/);
    await expect(installBielikOne('mlx', on('linux'))).rejects.toThrow(/does not run/);
  });
});

describe('isBielikOneReady', () => {
  const json = (response: ServerResponse, body: unknown): void => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  };

  const frontend = (calibrated: boolean) =>
    listen((request, response) => {
      if (request.url === '/health') {
        json(response, { status: 'ok', calibrated });
        return;
      }
      if (request.url === '/v1/systemone' && request.method === 'POST') {
        json(response, { filed: { probability: 0.97 } });
        return;
      }
      response.statusCode = 404;
      response.end();
    });

  it('is ready when /health reports calibration and a decision answers', async () => {
    const server = await frontend(true);
    try {
      expect(await isBielikOneReady(server.url)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('is not ready while the model is not calibrated', async () => {
    const server = await frontend(false);
    try {
      expect(await isBielikOneReady(server.url)).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('is not ready when nothing listens', async () => {
    expect(await isBielikOneReady(`http://127.0.0.1:${await freePort()}`)).toBe(false);
  });
});
```

- [ ] **Step 4: Commit**

```bash
rtk pnpm exec prettier --write infra/ai-runtime
rtk git add infra/ai-runtime
rtk git commit -m "feat(ai-runtime): bielik-one install with uv, start and readiness check" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

### Task 7: Dev na Macu: `pnpm ai:setup`, `ai:start`, `ai:stop`

Dev działa natywnie (llama-server z Metal i Bielik-11B-v3.1 Q4_K_M), nigdy w Dockerze. Pliki leżą w `~/Library/Application Support/sarmata/ai` i są wspólne dla wszystkich worktree, tak jak wspólna instancja Supabase. Serwer słucha na `127.0.0.1:55490`, obok portów 554xx Supabase z planu 2. `ai:start` najpierw sprawdza, czy serwer już działa (np. uruchomiony z innego worktree), i wtedy tylko odświeża `.env.ai.local`.

Konfiguracja dev trafia do wygenerowanego pliku `.env.ai.local` w korzeniu repo: `AI_BASE_URL`, `AI_MODEL` i `AI_DECISION_URL`, gdy działa Bielik-One (skrypty dev z tego planu go nie uruchamiają, ale `writeAiEnv` go obsługuje). Plik jest ignorowany przez git (wzorzec `.env*.local`) i za każdym razem zapisywany od nowa. `.env.local` należy wyłącznie do SOPS, więc ani skrypty AI, ani `scripts/secrets-decrypt.sh` go nie łączą. `.envrc` ładuje `.env.ai.local` zaraz po `.env.local`. Runtime AI nie potrzebuje sekretów zespołu ani tokenu Hugging Face (repozytoria GGUF i Bielik-One nie mają bramki), więc plan nie dodaje nic do `secrets/dev.enc.env`. `SARMATA_AI_MODEL` pozwala wybrać inny plik na słabszym laptopie (np. `bielik-4.5b-v3.0-q8_0`). Komunikaty skryptów są po angielsku (komunikaty dla deweloperów, `AGENTS.md`), a kroki postępu z biblioteki po polsku, bo pokazuje je kreator.

**Files:**
- Create: `infra/ai-runtime/scripts/dev-env.ts`, `infra/ai-runtime/scripts/ai-setup.ts`, `infra/ai-runtime/scripts/ai-start.ts`, `infra/ai-runtime/scripts/ai-stop.ts`
- Modify: `infra/ai-runtime/package.json`, `package.json`, `.envrc`, `README.md`

- [ ] **Step 1: Utwórz `infra/ai-runtime/scripts/dev-env.ts`**

```ts
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultDataDir, type Machine, type ProgressEvent } from '../src/index.ts';

/** One llama-server for every worktree, next to the Supabase ports 554xx (plan 2). */
export const DEV_PORT = 55490;

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export function devDataDir(machine: Machine): string {
  return defaultDataDir(machine.os, process.env, homedir());
}

export const devStateFile = (dataDir: string): string => join(dataDir, 'dev-llama-server.json');

/** Values the app reads to reach the local AI runtime. */
export interface AiEnv {
  baseUrl: string;
  model: string;
  /** Bielik-One frontend, only when it runs. */
  decisionUrl?: string;
}

/**
 * Writes the generated .env.ai.local in the repo root (ignored by git through `.env*.local`).
 * .env.local belongs to SOPS and is never touched here. direnv loads both files (.envrc).
 */
export async function writeAiEnv(env: AiEnv): Promise<string> {
  const path = join(REPO_ROOT, '.env.ai.local');
  const lines = [
    '# Generated by pnpm ai:setup and ai:start (infra/ai-runtime). Do not edit, do not commit.',
    `AI_BASE_URL=${env.baseUrl}`,
    `AI_MODEL=${env.model}`,
    ...(env.decisionUrl ? [`AI_DECISION_URL=${env.decisionUrl}`] : []),
  ];
  await writeFile(path, `${lines.join('\n')}\n`);
  return path;
}

export function printProgress(event: ProgressEvent): void {
  if (event.kind === 'step') {
    console.log(event.message);
    return;
  }
  const percent = Math.floor((event.receivedBytes / event.totalBytes) * 100);
  process.stdout.write(`\r  ${event.file}: ${percent}%`);
  if (event.receivedBytes === event.totalBytes) process.stdout.write('\n');
}
```

- [ ] **Step 2: Utwórz `infra/ai-runtime/scripts/ai-setup.ts`**

```ts
import {
  detectHardware,
  installLlamaCpp,
  LLAMA_CPP_RELEASE,
  localMachine,
  MODEL_FILES,
  prepareLlamaServer,
  recommendRuntime,
  type ModelId,
  type RuntimeContext,
} from '../src/index.ts';
import { DEV_PORT, devDataDir, printProgress, writeAiEnv } from './dev-env.ts';

// Dev default: Bielik-11B Q4_K_M on Metal (a Mac with 16 GB). SARMATA_AI_MODEL picks another file.
const DEFAULT_DEV_MODEL: ModelId = 'bielik-11b-v3.1-q4_k_m';

function devModelId(): ModelId {
  const requested = process.env.SARMATA_AI_MODEL ?? DEFAULT_DEV_MODEL;
  if (!(requested in MODEL_FILES)) {
    throw new Error(
      `Unknown SARMATA_AI_MODEL ${requested}, expected one of: ${Object.keys(MODEL_FILES).join(', ')}`,
    );
  }
  return requested as ModelId;
}

async function main(): Promise<void> {
  const model = MODEL_FILES[devModelId()];
  const machine = localMachine();
  const ctx: RuntimeContext = { machine, dataDir: devDataDir(machine), onProgress: printProgress };
  console.log(`AI data directory: ${ctx.dataDir}`);

  const bundle = recommendRuntime(await detectHardware(machine), 'standard').llamaCpp;
  console.log(`llama.cpp ${LLAMA_CPP_RELEASE.version} (${LLAMA_CPP_RELEASE.build}), backend ${bundle.backend}`);
  const llama = await installLlamaCpp(bundle, ctx);

  const hardware = await detectHardware(machine, llama);
  const devices = hardware.devices.map((device) => `${device.id} ${device.name} (${device.memoryMiB} MiB)`);
  console.log(`Devices: ${devices.join(', ') || 'CPU only'}`);
  const recommendation = recommendRuntime(hardware, 'standard');
  console.log(`Tier for this machine: ${recommendation.reason}`);
  console.log(`Dev model: ${model.label} ${model.quantization}`);

  const { config, benchmark } = await prepareLlamaServer(
    { llama, hardware, model, port: DEV_PORT, ...recommendation.server },
    ctx,
  );
  if (benchmark) {
    const gpu = benchmark.gpu ? `${benchmark.gpu.generationTokensPerSecond.toFixed(1)} tok/s` : 'failed';
    console.log(
      `Benchmark: CPU ${benchmark.cpu.generationTokensPerSecond.toFixed(1)} tok/s, ${benchmark.gpuDevice} ${gpu}`,
    );
  }
  const envFile = await writeAiEnv({
    baseUrl: `http://127.0.0.1:${config.port}/v1`,
    model: config.alias,
  });
  console.log(`Device: ${config.device}. Wrote AI_BASE_URL and AI_MODEL to ${envFile}. Next: pnpm ai:start`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Utwórz `infra/ai-runtime/scripts/ai-start.ts`**

```ts
import { writeFile } from 'node:fs/promises';
import {
  isLlamaServerReady,
  localMachine,
  readLlamaServerConfig,
  startLlamaServer,
} from '../src/index.ts';
import { devDataDir, devStateFile, writeAiEnv } from './dev-env.ts';

async function main(): Promise<void> {
  const dataDir = devDataDir(localMachine());
  const config = await readLlamaServerConfig(dataDir);
  if (!config) throw new Error('No llama-server configuration yet. Run pnpm ai:setup first.');
  const url = `http://127.0.0.1:${config.port}/v1`;
  if (await isLlamaServerReady(url)) {
    console.log(`llama-server is already running at ${url}`);
  } else {
    console.log(`Starting llama-server with ${config.alias} on ${config.device}, logs in ${config.logFile}`);
    const server = await startLlamaServer(config, { detached: true });
    await writeFile(devStateFile(dataDir), `${JSON.stringify({ pid: server.pid, url: server.url })}\n`);
    console.log(`llama-server is ready at ${server.url} (pid ${server.pid}). Stop it with pnpm ai:stop`);
  }
  await writeAiEnv({ baseUrl: url, model: config.alias });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Utwórz `infra/ai-runtime/scripts/ai-stop.ts`**

```ts
import { readFile, rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { localMachine } from '../src/index.ts';
import { devDataDir, devStateFile } from './dev-env.ts';

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function main(): Promise<void> {
  const stateFile = devStateFile(devDataDir(localMachine()));
  let state: { pid: number; url: string };
  try {
    state = JSON.parse(await readFile(stateFile, 'utf8')) as { pid: number; url: string };
  } catch {
    console.log('No llama-server started by pnpm ai:start.');
    return;
  }
  if (isAlive(state.pid)) {
    process.kill(state.pid, 'SIGTERM');
    for (let attempt = 0; attempt < 50 && isAlive(state.pid); attempt += 1) await sleep(200);
    if (isAlive(state.pid)) process.kill(state.pid, 'SIGKILL');
  }
  await rm(stateFile, { force: true });
  console.log(`Stopped llama-server (${state.url}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Zastąp `infra/ai-runtime/package.json`**

```json
{
  "name": "@sarmata/ai-runtime",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "ai:setup": "node scripts/ai-setup.ts",
    "ai:start": "node scripts/ai-start.ts",
    "ai:stop": "node scripts/ai-stop.ts"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 6: Dodaj skrypty do korzenia `package.json`**

Na końcu obiektu `scripts` (po ostatnim istniejącym skrypcie, z przecinkiem po nim) dopisz:

```json
    "ai:setup": "pnpm --filter @sarmata/ai-runtime ai:setup",
    "ai:start": "pnpm --filter @sarmata/ai-runtime ai:start",
    "ai:stop": "pnpm --filter @sarmata/ai-runtime ai:stop"
```

- [ ] **Step 7: Ładuj `.env.ai.local` w `.envrc`**

Zastąp dokładnie ostatnią linię `.envrc`:

```bash
dotenv_if_exists .env.local
```

tym:

```bash
dotenv_if_exists .env.local
# Local AI runtime address, generated by pnpm ai:setup and ai:start (infra/ai-runtime), never committed.
dotenv_if_exists .env.ai.local
```

`dotenv_if_exists` sam obserwuje plik, więc po `pnpm ai:setup` direnv przeładuje środowisko przy następnym poleceniu w powłoce.

- [ ] **Step 8: Zaktualizuj `README.md`**

Trzy zmiany w README (stan z commitu `84db65d`). Jeśli inny plan zmienił w międzyczasie numerację kroków, wstaw krok AI przed „Sprawdzenie całości” i ponumeruj kolejne.

W „## Jak uruchomić (dev)” zastąp dokładnie linię:

```markdown
6. **Sprawdzenie całości** (to samo co CI):
```

tym:

```markdown
6. **AI lokalnie (opcjonalne, Mac z Apple Silicon).** Runtime LLM działa natywnie, bez Dockera (ADR 0005). Pierwsze `ai:setup` pobiera przypięty llama.cpp v1.0.0 z Metal (17 MB) i Bielik-11B-v3.1 Q4_K_M (6,7 GB) z kontrolą SHA-256 do `~/Library/Application Support/sarmata/ai` (wspólne dla wszystkich worktree, logi w `logs/`):

       pnpm ai:setup
       pnpm ai:start

   Serwer działa w tle pod `http://127.0.0.1:55490/v1`, zatrzymuje go `pnpm ai:stop`. Oba skrypty zapisują `AI_BASE_URL` i `AI_MODEL` do wygenerowanego `.env.ai.local` w korzeniu, który direnv ładuje zaraz po `.env.local` (bez direnv: `set -a; . ./.env.ai.local; set +a`). Na słabszym sprzęcie: `SARMATA_AI_MODEL=bielik-4.5b-v3.0-q8_0 pnpm ai:setup`. Sekretów ani tokenu Hugging Face nie trzeba, repozytoria modeli są publiczne.

7. **Sprawdzenie całości** (to samo co CI):
```

W tabeli „## Skrypty” po wierszu `pnpm db:types` dopisz:

```markdown
| `pnpm ai:setup` | llama.cpp i model Bielik do katalogu danych AI, wybór urządzenia, zapis `.env.ai.local` |
| `pnpm ai:start` / `ai:stop` | wspólny llama-server w tle na porcie 55490 |
```

W „## Pliki konfiguracyjne” zastąp dokładnie linię:

```markdown
- Poza repo: `.env`, `.env.local` i inne `.env*` (powstają z SOPS albo ze skryptów), klucze age, `.termic/customization-manifest.json` (generuje go Termic).
```

tym:

```markdown
- Poza repo: `.env`, `.env.local` i inne `.env*` (powstają z SOPS albo ze skryptów, np. `.env.ai.local` z `pnpm ai:setup`), klucze age, katalog danych AI `~/Library/Application Support/sarmata/ai` (llama.cpp, modele, logi), `.termic/customization-manifest.json` (generuje go Termic).
```

- [ ] **Step 9: Commit**

```bash
rtk pnpm exec prettier --write infra/ai-runtime
rtk git add infra/ai-runtime package.json .envrc README.md
rtk git commit -m "feat(ai-runtime): pnpm ai:setup, ai:start and ai:stop for native dev on macOS" -m "Claude-Session: https://claude.ai/code/session_01CbBDmh1wTCkUawRYrUwNRT"
```

---

## Walidacja końcowa (raz, po wszystkich zadaniach)

1. `rtk pnpm --filter @sarmata/ai-runtime test`: 61 testów PASS (machine 4, hardware 8, recommend 30, data-dir 4, llama-server 8, bielik-one 7).
2. `rtk pnpm --filter @sarmata/ai-runtime typecheck`: `tsc` bez błędów.
3. `rtk pnpm check`: PASS (lint, format, typecheck i testy wszystkich pakietów).
4. Na Macu z Apple Silicon: `rtk pnpm ai:setup`. Pierwsze uruchomienie pobiera około 17 MB (llama.cpp) i 6,7 GB (model). Expected w wyjściu: `backend metal`, linia `Devices: MTL0 Apple ...`, `Dev model: Bielik-11B-v3.1-Instruct Q4_K_M`, `Device: MTL0`. Przy 16 GB RAM linia `Tier for this machine:` brzmi „Mac z procesorem Apple i 16 GB pamięci: Bielik-11B-v3.1-Instruct w kwantyzacji Q4_K_M.”
5. `rtk proxy cat .env.ai.local`: Expected komentarz `# Generated by ...`, `AI_BASE_URL=http://127.0.0.1:55490/v1` i `AI_MODEL=bielik-11b-v3.1-instruct`. `rtk git status --short .env.ai.local` nic nie wypisuje (plik ignorowany). `rtk proxy grep -c '^AI_' .env.local` zwraca `0` albo brak pliku.
6. Drugie `rtk pnpm ai:setup` kończy się w kilka sekund bez pobierania (znaczniki `.sarmata-install.json` i `.sha256`).
7. `rtk pnpm ai:start`: Expected `llama-server is ready at http://127.0.0.1:55490/v1`. Potem:

```bash
rtk proxy curl -s http://127.0.0.1:55490/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"bielik-11b-v3.1-instruct","messages":[{"role":"user","content":"Podaj stolicę Polski jednym słowem."}],"max_tokens":20}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["choices"][0]["message"]["content"])'
```

Expected: odpowiedź zawiera „Warszawa”. `rtk proxy grep -c "Metal" "$HOME/Library/Application Support/sarmata/ai/logs/llama-server.log"` większe od zera.

8. Drugie `rtk pnpm ai:start`: Expected `llama-server is already running at http://127.0.0.1:55490/v1`.
9. `rtk proxy direnv exec . printenv AI_BASE_URL AI_MODEL` (po `direnv allow`): Expected `http://127.0.0.1:55490/v1` i `bielik-11b-v3.1-instruct`. Po `rtk pnpm secrets:decrypt` wynik jest ten sam, bo `.env.ai.local` nie zależy od SOPS.
10. `rtk pnpm ai:stop`: Expected `Stopped llama-server (http://127.0.0.1:55490/v1).`, a `rtk proxy curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:55490/v1/health` zwraca `000`.

Bielik-One sprawdza się ręcznie dopiero na Linuksie z NVIDIA od 16 GB albo na Macu od 32 GB. Na Macu 16 GB `recommendRuntime` go nie proponuje, a dev go nie uruchamia. Pełny przebieg (`installBielikOne`, `startBielikOne`) wchodzi do walidacji planu 6.

## Przegląd codebase-design

Plan przejrzany skillem `codebase-design` (głębokie moduły, szwy, interfejs jako powierzchnia testów). Zastosowane zmiany:

- **Parsery za interfejsem.** Pierwszy szkic eksportował `parseNvidiaSmi`, `parseDeviceList` i `parseBench` do testów. Teraz są wewnętrzne, a testy idą przez `detectHardware` i `prepareLlamaServer` z `fakeMachine` i nagranymi próbkami. Interfejs jest mniejszy, a testy przeżyją zmianę formatu wyjścia.
- **Jeden szew z dwoma adapterami.** `Machine` łączy fakty o platformie z poleceniami, więc ten sam test sprawdza Windows, Linux i Rosettę na Macu. Prawdziwy adapter ma własne testy (kod wyjścia, brak polecenia).
- **Wybór archiwów llama.cpp w czystej funkcji.** Lista plików do pobrania jest częścią wyniku `recommendRuntime`, a `installLlamaCpp` tylko ją wykonuje. Decyzja (sterownik, compute capability, architektura) żyje w jednym miejscu i ma dziewięć przypadków testowych bez sieci.
- **Pobieranie jako wewnętrzny moduł.** `downloadVerified` obsługuje i archiwa, i modele, a testy wchodzą przez `prepareLlamaServer` na lokalnym serwerze HTTP (zależność lokalnie zastępowalna, bez portu dla `fetch`).
- **`llamaServerCommand` jako osobny eksport.** Ma dwóch realnych odbiorców: `startLlamaServer` i rejestrację usług w kreatorze (plan 6), więc flagi serwera są w jednym miejscu.
- **Ustawienia serwera w rekomendacji.** Kontekst i liczba slotów zależą od profilu, więc wychodzą z `recommendRuntime` razem z modelem, zamiast powtarzać tę logikę w kreatorze i w skrypcie dev.

Odrzucone pomysły:

- **Jedna funkcja `setupRuntime()` robiąca wszystko.** Byłaby głębsza, ale kreator musi pokazać tier i zapytać przed pobraniem kilku GB, a karty AMD i Intel widać dopiero po instalacji llama.cpp. Funkcje kroków z opisaną kolejnością są tu uczciwszym interfejsem.
- **Port dla `fetch` i dla uruchamiania procesów.** Byłby tylko jeden prawdziwy adapter. Lokalny serwer HTTP i skrypt udający llama-server testują prawdziwy kod taniej niż atrapy.
- **Osobne wejście `@sarmata/ai-runtime/testing` dla `fakeMachine`.** Brief wymaga eksportu tylko z `src/index.ts`, a kreator z planu 6 też będzie testował się na `fakeMachine`.
- **Reguła ESLint zabraniająca `@sarmata/ai-runtime` w `backend/` i `frontend/`.** W flat config późniejszy blok z `no-restricted-imports` zastępuje opcje wcześniejszego dla tych samych plików, więc trzeba by edytować trzy istniejące bloki, które równolegle zmieniają plany 2 do 4. Warto dodać po scaleniu tych planów.
- **Wykrywanie iGPU przez `vulkaninfo` albo WMI.** Dodatkowe narzędzia, których często nie ma, a benchmark i tak chroni przed wolnym GPU. Zostaje heurystyka nazw z testami.
- **Wznawianie przerwanych pobrań (`Range`).** Przydatne przy wolnych łączach urzędów, ale to praca dla planu 6 razem z UX kreatora. Teraz przerwane pobieranie zaczyna się od nowa.

## Po wykonaniu

- Podmień syntetyczne próbki `nvidia-smi-linux.txt`, `list-devices-linux-cuda.txt` i `list-devices-windows-vulkan.txt` na nagrania z prawdziwych maszyn przy pierwszej okazji.
- Następny plan korzystający z pakietu: `2026-11-21-fundament-6-*.md` (kreator TUI kompilowany Bunem, usługi systemowe dla llama-server i Bielik-One, Caddy).
