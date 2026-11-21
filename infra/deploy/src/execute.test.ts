import { describe, expect, it } from 'vitest';
import type { CommandResult } from '@sarmata/ai-runtime';
import { executePlan, type Hosts, type Plan, type Step } from './index.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

const hostsFor = (
  calls: Call[],
  respond?: (argv: readonly string[]) => Partial<CommandResult>,
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
  (argv: readonly string[]): Partial<CommandResult> =>
    commands.includes(argv.join(' ')) ? { exitCode: 1, stderr: 'boom' } : {};

describe('executePlan', () => {
  it('runs the steps in order on the host named by each step', async () => {
    const calls: Call[] = [];
    const plan: Plan = {
      steps: [
        { title: 'write', on: 'system', action: { kind: 'write', path: '/x', content: 'x' } },
        run('info', ['docker', 'info']),
      ],
    };
    expect(await executePlan(plan, hostsFor(calls))).toEqual({ status: 'ok', warnings: [] });
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
    expect(await executePlan(plan, hostsFor(calls, failing('gio')))).toEqual({
      status: 'ok',
      warnings: [],
    });
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

  it('runs the cleanup only after every step succeeded, and turns its failures into warnings', async () => {
    const calls: Call[] = [];
    const events: string[] = [];
    const plan: Plan = {
      steps: [run('a', ['do', 'a'], [run('undo a', ['undo', 'a'])])],
      cleanup: [run('tidy 1', ['tidy', '1']), run('tidy 2', ['tidy', '2'])],
    };
    const result = await executePlan(plan, hostsFor(calls, failing('tidy 1')), (event) => {
      events.push(`${event.type} ${event.step.title}`);
    });
    expect(result).toEqual({ status: 'ok', warnings: ['tidy 1: exit code 1: boom'] });
    expect(calls.map((call) => call.args.join(' '))).toEqual(['do a', 'tidy 1', 'tidy 2']);
    expect(events).toContain('warning tidy 1');
    expect(events.some((event) => event.startsWith('rollback'))).toBe(false);
  });

  it('skips the cleanup when a step fails', async () => {
    const calls: Call[] = [];
    const plan: Plan = { steps: [run('a', ['do', 'a'])], cleanup: [run('tidy', ['tidy'])] };
    await executePlan(plan, hostsFor(calls, failing('do a')));
    expect(calls.map((call) => call.args.join(' '))).toEqual(['do a']);
  });

  it('reports a command that could not start', async () => {
    const plan: Plan = { steps: [run('missing', ['missing'])] };
    const result = await executePlan(
      plan,
      hostsFor([], () => ({ exitCode: null, stderr: 'ENOENT' })),
    );
    expect(result).toMatchObject({ status: 'failed', message: 'exit code none: ENOENT' });
  });
});
