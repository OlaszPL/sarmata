/** One of the two local AI endpoints. */
export type Endpoint = 'text' | 'decision';

/** `--only text|decision` from the command line, null without it. */
export function parseOnly(argv: readonly string[]): Endpoint | null {
  const index = argv.findIndex((arg) => arg === '--only' || arg.startsWith('--only='));
  if (index === -1) return null;
  const arg = argv[index] ?? '';
  const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[index + 1];
  if (value === 'text' || value === 'decision') return value;
  throw new Error(`--only takes text or decision, got ${value ?? 'nothing'}`);
}

export interface StartPlan {
  start: Endpoint[];
  /** A Polish note for the terminal, e.g. why Bielik-One stays off. */
  note: string | null;
}

/**
 * What pnpm ai:start starts. Without --only: the text model, and Bielik-One too when it is
 * installed and fits next to it. Where the two do not fit together, starting one while the
 * other runs is refused, so a 16 GB Mac never swaps both models.
 */
export function planStart(
  only: Endpoint | null,
  decision: { installed: boolean; together: boolean },
  running: ReadonlySet<Endpoint>,
): StartPlan {
  if (only === 'decision' && !decision.installed) {
    throw new Error('Bielik-One nie jest zainstalowany. Najpierw: pnpm ai:setup --with-bielik-one');
  }
  const start: Endpoint[] =
    only !== null
      ? [only]
      : decision.installed && decision.together
        ? ['text', 'decision']
        : ['text'];
  if (!decision.together) {
    for (const endpoint of start) {
      const other: Endpoint = endpoint === 'text' ? 'decision' : 'text';
      if (running.has(other)) {
        throw new Error(
          `Działa już ${label(other)}, a na tym komputerze oba modele nie mieszczą się naraz w pamięci. Zatrzymaj go: pnpm ai:stop --only ${other}`,
        );
      }
    }
  }
  const note =
    only === null && decision.installed && !decision.together
      ? 'Bielik-One jest zainstalowany, ale na tym komputerze nie działa razem z modelem tekstowym. Test decyzji: pnpm ai:stop && pnpm ai:start --only decision'
      : null;
  return { start, note };
}

const label = (endpoint: Endpoint): string =>
  endpoint === 'text' ? 'model tekstowy' : 'Bielik-One';
