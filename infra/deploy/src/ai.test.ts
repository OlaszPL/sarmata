import { describe, expect, it } from 'vitest';
import { aiServicePlan, type Action, type Plan, type ServiceCommand } from './index.ts';
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
});
