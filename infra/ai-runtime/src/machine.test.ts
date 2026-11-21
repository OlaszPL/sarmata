import { describe, expect, it } from 'vitest';
import { architectureOf, fakeMachine, localMachine, operatingSystemOf } from './index.ts';

describe('platform names', () => {
  it('maps Node names and rejects the rest', () => {
    expect(operatingSystemOf('darwin')).toBe('macos');
    expect(operatingSystemOf('win32')).toBe('windows');
    expect(() => operatingSystemOf('aix')).toThrow(/Unsupported platform/);
    expect(architectureOf('arm64')).toBe('arm64');
    expect(() => architectureOf('ia32')).toThrow(/Unsupported architecture/);
  });
});

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

  it('writes stdin to the command', async () => {
    const result = await localMachine().run(
      process.execPath,
      ['-e', 'process.stdin.pipe(process.stdout)'],
      { stdin: 'tajne' },
    );
    expect(result).toMatchObject({ exitCode: 0, stdout: 'tajne' });
  });

  it('kills a command that runs past its time limit', async () => {
    const result = await localMachine().run(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 60000)'],
      {
        timeoutMs: 200,
      },
    );
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain('timed out');
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
    expect(await machine.run('echo', ['a', 'b'])).toEqual({
      exitCode: 0,
      stdout: 'a b',
      stderr: '',
    });
    expect((await machine.run('missing', [])).exitCode).toBeNull();
    expect(machine.calls).toEqual([
      { command: 'echo', args: ['a', 'b'] },
      { command: 'missing', args: [] },
    ]);
    expect(machine.totalMemoryBytes).toBe(16 * 1024 ** 3);
  });
});
