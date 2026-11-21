import { describe, expect, it } from 'vitest';
import { executePlan, type Hosts, type Plan, type RunResult, type Step } from './index.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

const hostsFor = (
  calls: Call[],
  respond?: (argv: readonly string[]) => Partial<RunResult>,
): Hosts => ({
  system: recordingHost({ name: 'system', calls, ...(respond === undefined ? {} : { respond }) }),
  engine: recordingHost({ name: 'engine', calls, ...(respond === undefined ? {} : { respond }) }),
});

const run = (title: string, argv: readonly string[], undo: readonly Step[] = []): Step => ({
  title,
  on: 'engine',
  action: { kind: 'run', argv },
  ...(undo.length > 0 ? { undo } : {}),
});

const failing =
  (...commands: string[]) =>
  (argv: readonly string[]): Partial<RunResult> =>
    commands.includes(argv.join(' ')) ? { code: 1, stderr: 'boom' } : {};

describe('executePlan', () => {
  it('runs the steps in order on the host named by each step', async () => {
    const calls: Call[] = [];
    const plan: Plan = {
      steps: [
        { title: 'write', on: 'system', action: { kind: 'write', path: '/x', content: 'x' } },
        run('info', ['docker', 'info']),
      ],
    };
    expect(await executePlan(plan, hostsFor(calls))).toEqual({ status: 'ok' });
    expect(calls).toEqual([
      { host: 'system', op: 'write', args: ['/x'] },
      { host: 'engine', op: 'run', args: ['docker', 'info'] },
    ]);
  });

  it('stops at a halt step without running the rest', async () => {
    const calls: Call[] = [];
    const plan: Plan = {
      steps: [
        run('a', ['true']),
        { title: 'stop', on: 'system', action: { kind: 'halt', message: 'restart' } },
        run('b', ['false']),
      ],
    };
    expect(await executePlan(plan, hostsFor(calls))).toEqual({
      status: 'halted',
      message: 'restart',
    });
    expect(calls.map((call) => call.args.join(' '))).toEqual(['true']);
  });

  it('on failure undoes the completed steps in reverse order, not the failed one', async () => {
    const calls: Call[] = [];
    const plan: Plan = {
      steps: [
        run('a', ['do', 'a'], [run('undo a', ['undo', 'a'])]),
        run('b', ['do', 'b'], [run('undo b', ['undo', 'b'])]),
        run('c', ['do', 'c'], [run('undo c', ['undo', 'c'])]),
      ],
    };
    const result = await executePlan(plan, hostsFor(calls, failing('do c')));
    expect(result).toEqual({
      status: 'failed',
      step: 'c',
      message: 'exit code 1: boom',
      rolledBack: 2,
      rollbackErrors: [],
    });
    expect(calls.map((call) => call.args.join(' '))).toEqual([
      'do a',
      'do b',
      'do c',
      'undo b',
      'undo a',
    ]);
  });

  it('continues after a failing step that allows failure', async () => {
    const calls: Call[] = [];
    const plan: Plan = {
      steps: [
        { title: 'gio', on: 'system', action: { kind: 'run', argv: ['gio'], allowFailure: true } },
        run('next', ['next']),
      ],
    };
    expect(await executePlan(plan, hostsFor(calls, failing('gio')))).toEqual({ status: 'ok' });
    expect(calls).toHaveLength(2);
  });

  it('keeps undoing when one undo step fails and reports it', async () => {
    const calls: Call[] = [];
    const plan: Plan = {
      steps: [
        run('a', ['do', 'a'], [run('undo a', ['undo', 'a'])]),
        run('b', ['do', 'b'], [run('undo b', ['undo', 'b'])]),
        run('c', ['do', 'c']),
      ],
    };
    const result = await executePlan(plan, hostsFor(calls, failing('do c', 'undo b')));
    expect(result).toMatchObject({
      status: 'failed',
      rolledBack: 2,
      rollbackErrors: ['undo b: exit code 1: boom'],
    });
    expect(calls.map((call) => call.args.join(' '))).toContain('undo a');
  });
});
