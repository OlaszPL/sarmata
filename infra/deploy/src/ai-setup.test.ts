import { describe, expect, it } from 'vitest';
import {
  setUpAi,
  type AiInstaller,
  type AiSetupDeps,
  type EnabledAi,
  type Environment,
  type ServiceCommand,
} from './index.ts';
import { linuxEnvironment, windowsEnvironment } from './test-support/fixtures.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

const DATA = '/home/jan/.local/share/sarmata/ai';
const WANTED: EnabledAi = {
  enabled: true,
  modelId: 'bielik-11b-v3.1-q4_k_m',
  alias: 'bielik-11b-v3.1-instruct',
  decisionPort: 8012,
};
const service = (id: ServiceCommand['id']): ServiceCommand => ({
  id,
  command: `/opt/${id}`,
  args: [],
  env: {},
  logFile: `${DATA}/logs/${id}.log`,
});

interface Scenario {
  readonly env?: Environment;
  readonly installer?: Partial<AiInstaller>;
  readonly textReady?: boolean;
  readonly decisionReady?: boolean;
  /** Commands that fail on the system host, by their first two words. */
  readonly failing?: readonly string[];
}

function setup(scenario: Scenario = {}): { deps: AiSetupDeps; calls: Call[]; uvUsed: string[] } {
  const calls: Call[] = [];
  const uvUsed: string[] = [];
  const host = recordingHost({
    name: 'system',
    calls,
    respond: (argv) =>
      (scenario.failing ?? []).includes(argv.slice(0, 2).join(' ')) ? { exitCode: 1 } : {},
  });
  return {
    calls,
    uvUsed,
    deps: {
      env: scenario.env ?? linuxEnvironment(),
      hosts: { system: host, engine: host },
      dataDir: DATA,
      installer: {
        text: () => Promise.resolve(service('llama-server')),
        decision: (_ai, uv) => {
          uvUsed.push(uv);
          return Promise.resolve([service('bielik-one-backend'), service('bielik-one-frontend')]);
        },
        ...scenario.installer,
      },
      probes: {
        text: () => Promise.resolve(scenario.textReady ?? true),
        decision: () => Promise.resolve(scenario.decisionReady ?? true),
      },
      waitFor: (probe) => probe(),
    },
  };
}

const commands = (calls: readonly Call[]): string[] =>
  calls.filter((call) => call.op === 'run').map((call) => call.args.join(' '));

describe('setUpAi', () => {
  it('registers llama-server before Bielik-One and enables both when they answer', async () => {
    const { deps, calls } = setup();
    expect(await setUpAi(deps, WANTED)).toEqual({ ai: WANTED, warnings: [] });
    const run = commands(calls);
    const llama = run.indexOf('sudo systemctl enable --now sarmata-ai-llama-server.service');
    const bielik = run.indexOf(
      'sudo systemctl enable --now sarmata-ai-bielik-one-frontend.service',
    );
    expect(llama).toBeGreaterThanOrEqual(0);
    expect(bielik).toBeGreaterThan(llama);
  });

  it('keeps AI off and removes llama-server when it never answers', async () => {
    const { deps, calls } = setup({ textReady: false });
    const result = await setUpAi(deps, WANTED);
    expect(result.ai).toEqual({ enabled: false });
    expect(result.warnings[0]).toContain('sarmata ai');
    expect(commands(calls)).toContain(
      'sudo systemctl disable --now sarmata-ai-llama-server.service',
    );
    expect(commands(calls).some((line) => line.includes('bielik-one'))).toBe(false);
  });

  it('keeps AI off when the text model download fails', async () => {
    const { deps } = setup({
      installer: { text: () => Promise.reject(new Error('checksum mismatch')) },
    });
    const result = await setUpAi(deps, WANTED);
    expect(result.ai).toEqual({ enabled: false });
    expect(result.warnings[0]).toContain('checksum mismatch');
  });

  it('keeps the text model and drops the decision endpoint when Bielik-One fails', async () => {
    const { deps, calls } = setup({
      installer: { decision: () => Promise.reject(new Error('vLLM wheel not found')) },
    });
    const result = await setUpAi(deps, WANTED);
    expect(result.ai).toEqual({ ...WANTED, decisionPort: null });
    expect(result.warnings[0]).toContain('vLLM wheel not found');
    expect(commands(calls)).toContain(
      'sudo systemctl disable --now sarmata-ai-bielik-one-frontend.service',
    );
    expect(commands(calls)).not.toContain(
      'sudo systemctl disable --now sarmata-ai-llama-server.service',
    );
  });

  it('keeps the text model when Bielik-One never becomes ready', async () => {
    const { deps } = setup({ decisionReady: false });
    expect((await setUpAi(deps, WANTED)).ai).toEqual({ ...WANTED, decisionPort: null });
  });

  it('does not touch Bielik-One or uv without a decision port', async () => {
    const { deps, calls } = setup();
    const textOnly = { ...WANTED, decisionPort: null };
    expect(await setUpAi(deps, textOnly)).toEqual({ ai: textOnly, warnings: [] });
    expect(commands(calls).some((line) => line.includes('uv'))).toBe(false);
  });

  it('uses uv from PATH when it is there', async () => {
    const { deps, uvUsed } = setup();
    await setUpAi(deps, WANTED);
    expect(uvUsed).toEqual(['uv']);
  });

  it('installs uv into the AI data directory when it is missing, then uses that copy', async () => {
    const { deps, calls, uvUsed } = setup({
      failing: ['uv --version', `${DATA}/uv/uv --version`],
    });
    await setUpAi(deps, WANTED);
    expect(commands(calls).some((line) => line.startsWith('sh -c curl -LsSf'))).toBe(true);
    expect(uvUsed).toEqual([`${DATA}/uv/uv`]);
  });

  it('does nothing on Windows 10 with the WSL engine', async () => {
    const { deps, calls } = setup({ env: windowsEnvironment({ windowsBuild: 19045 }) });
    const result = await setUpAi(deps, WANTED);
    expect(result.ai).toEqual({ enabled: false });
    expect(calls).toEqual([]);
  });
});
