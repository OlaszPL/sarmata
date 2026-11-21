import { describe, expect, it } from 'vitest';
import {
  aiServicePlan,
  aiServiceRemovalPlan,
  aiSettings,
  aiUnsupportedReason,
  uvInstall,
  UV_INSTALLER,
  type Action,
  type Plan,
  type ServiceCommand,
} from './index.ts';
import { MODEL_FILES, BIELIK_ONE_PACKAGES, type RuntimeRecommendation } from '@sarmata/ai-runtime';
import { linuxEnvironment, macEnvironment, windowsEnvironment } from './test-support/fixtures.ts';

const llama: ServiceCommand = {
  id: 'llama-server',
  command: '/home/jan/.local/share/sarmata/ai/llama.cpp/b12359-vulkan/llama-server',
  args: ['--model', '/home/jan/models/Bielik 11B.gguf', '--port', '55491', '--host', '127.0.0.1'],
  env: {},
  logFile: '/home/jan/.local/share/sarmata/ai/logs/llama-server.log',
};
const bielikOne: ServiceCommand = {
  id: 'bielik-one-frontend',
  command: '/home/jan/.local/share/sarmata/ai/bielik-one/vllm/bin/bielik-one',
  args: ['frontend', 'speakleash/Bielik-One-11B-v3.1-r1-Adapter', '--revision', 'e8ded5d3'],
  env: { HF_HOME: '/home/jan/.local/share/sarmata/ai/huggingface' },
  logFile: '/home/jan/.local/share/sarmata/ai/logs/bielik-one-frontend.log',
};

const stdinOf = (action: Action | undefined): string =>
  action?.kind === 'run' ? (action.stdin ?? '') : '';
const contentOf = (action: Action | undefined): string =>
  action?.kind === 'write' ? action.content : '';
const commandsOf = (plan: Plan): string[] =>
  plan.steps.map((current) =>
    current.action.kind === 'run' ? current.action.argv.join(' ') : current.action.kind,
  );
const lastArg = (action: Action | undefined): string =>
  action?.kind === 'run' ? (action.argv[action.argv.length - 1] ?? '') : '';

describe('aiServicePlan', () => {
  it('Linux: systemd units for the user with quoted arguments and the Hugging Face cache, loopback only', () => {
    const plan = aiServicePlan(linuxEnvironment(), [llama, bielikOne]);
    const llamaUnit = stdinOf(plan.steps[0]?.action);
    expect(llamaUnit).toContain('User=jan');
    expect(llamaUnit).toContain('"--model" "/home/jan/models/Bielik 11B.gguf"');
    expect(llamaUnit).toContain('"--host" "127.0.0.1"');
    expect(stdinOf(plan.steps[1]?.action)).toContain(
      'Environment="HF_HOME=/home/jan/.local/share/sarmata/ai/huggingface"',
    );
    expect(commandsOf(plan)).toEqual([
      'sudo sh -c cat > /etc/systemd/system/sarmata-ai-llama-server.service',
      'sudo sh -c cat > /etc/systemd/system/sarmata-ai-bielik-one-frontend.service',
      'sudo systemctl daemon-reload',
      'sudo systemctl enable --now sarmata-ai-llama-server.service',
      'sudo systemctl enable --now sarmata-ai-bielik-one-frontend.service',
    ]);
  });

  it('macOS: launch agents with every argument and variable as their own strings', () => {
    const plan = aiServicePlan(macEnvironment(), [llama, bielikOne]);
    expect(plan.steps[0]?.action).toMatchObject({
      kind: 'write',
      path: '/Users/jan/Library/LaunchAgents/pl.sarmata.ai.llama-server.plist',
    });
    expect(contentOf(plan.steps[0]?.action)).toContain(
      '<string>/home/jan/models/Bielik 11B.gguf</string>',
    );
    expect(contentOf(plan.steps[3]?.action)).toContain(
      '<key>HF_HOME</key><string>/home/jan/.local/share/sarmata/ai/huggingface</string>',
    );
    expect(commandsOf(plan)[2]).toBe(
      'launchctl load -w /Users/jan/Library/LaunchAgents/pl.sarmata.ai.llama-server.plist',
    );
  });

  it('Windows: a scheduled task at logon with Windows quoting of the arguments', () => {
    const script = lastArg(aiServicePlan(windowsEnvironment(), [llama]).steps[0]?.action);
    expect(script).toContain("Register-ScheduledTask -TaskName 'Sarmata AI llama-server'");
    expect(script).toContain(
      '-Argument \'--model "/home/jan/models/Bielik 11B.gguf" --port 55491 --host 127.0.0.1\'',
    );
  });

  it('Linux: escapes systemd specifiers and variables, and hardens the unit', () => {
    const odd: ServiceCommand = {
      ...llama,
      args: ['--alias', '100%$HOME'],
      env: { NAME: 'a%b$c' },
    };
    const unit = stdinOf(aiServicePlan(linuxEnvironment(), [odd]).steps[0]?.action);
    expect(unit).toContain('"--alias" "100%%$$HOME"');
    expect(unit).toContain('Environment="NAME=a%%b$$c"');
    expect(unit).toContain('NoNewPrivileges=yes');
    expect(unit).toContain('ProtectSystem=full');
  });
});

describe('aiServiceRemovalPlan', () => {
  it('removes only the services asked for', () => {
    const plan = aiServiceRemovalPlan(linuxEnvironment(), ['bielik-one-backend']);
    expect(commandsOf(plan)).toEqual([
      'sudo systemctl disable --now sarmata-ai-bielik-one-backend.service',
      'sudo rm -f /etc/systemd/system/sarmata-ai-bielik-one-backend.service',
    ]);
  });
});

describe('uvInstall', () => {
  it('macOS with Homebrew: brew install uv', () => {
    const { plan, command } = uvInstall(
      macEnvironment(),
      '/Users/jan/Library/Application Support/sarmata/ai',
    );
    expect(commandsOf(plan)).toEqual(['brew install uv']);
    expect(command).toBe('/opt/homebrew/bin/uv');
  });

  it('Linux: the pinned official installer into the AI data directory, PATH untouched', () => {
    const { plan, command } = uvInstall(linuxEnvironment(), '/home/jan/.local/share/sarmata/ai');
    const action = plan.steps[0]?.action;
    expect(action?.kind === 'run' ? action.argv.slice(-2) : []).toEqual([
      UV_INSTALLER,
      '/home/jan/.local/share/sarmata/ai/uv',
    ]);
    expect(action?.kind === 'run' ? action.argv[2] : '').toContain('UV_NO_MODIFY_PATH=1');
    expect(UV_INSTALLER).toMatch(/\/uv\/\d+\.\d+\.\d+\/install\.sh$/);
    expect(command).toBe('/home/jan/.local/share/sarmata/ai/uv/uv');
  });
});

describe('aiSettings and aiUnsupportedReason', () => {
  const choice = (bielikOne: boolean): RuntimeRecommendation => ({
    enabledByDefault: true,
    llamaCpp: { key: 'macos-arm64', backend: 'metal', assets: [] },
    model: MODEL_FILES['bielik-11b-v3.1-q4_k_m'],
    bielikOne: bielikOne
      ? { engine: 'mlx', package: BIELIK_ONE_PACKAGES['bielik-one-4b-r1-adapter'] }
      : null,
    decisionReason: '',
    server: { contextSize: 8192, parallel: 2 },
    reason: '',
  });

  it('keeps Bielik-One only when it fits and the user wants it', () => {
    expect(aiSettings(choice(true), true)).toMatchObject({ decisionPort: 8012 });
    expect(aiSettings(choice(true), false)).toMatchObject({ decisionPort: null });
    expect(aiSettings(choice(false), true)).toMatchObject({ decisionPort: null });
  });

  it('turns AI away on Windows 10 with the WSL engine', () => {
    expect(aiUnsupportedReason(windowsEnvironment({ windowsBuild: 19045 }))).toContain(
      'Windows 11',
    );
    expect(aiUnsupportedReason(windowsEnvironment())).toBeNull();
  });
});
