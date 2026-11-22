/**
 * Debounced save of a form. `schedule` waits for a pause, `flush` saves a scheduled change at once
 * (leaving the page, a decision that must not wait), `takePending` hands a scheduled change to the
 * caller, e.g. an unmount that saves without touching the state of the component.
 */
export interface Autosave {
  /** Saves `delayMs` after the last call. */
  schedule: () => void;
  /** Saves now when a save is scheduled, otherwise does nothing. */
  flush: () => void;
  /** Saves now, scheduled or not. */
  saveNow: () => void;
  /** Drops a scheduled save and tells whether there was one. */
  takePending: () => boolean;
  readonly pending: boolean;
}

export function createAutosave(save: () => void, delayMs: number): Autosave {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const takePending = (): boolean => {
    if (timer === null) return false;
    clearTimeout(timer);
    timer = null;
    return true;
  };

  return {
    schedule: () => {
      takePending();
      timer = setTimeout(() => {
        timer = null;
        save();
      }, delayMs);
    },
    flush: () => {
      if (takePending()) save();
    },
    saveNow: () => {
      takePending();
      save();
    },
    takePending,
    get pending() {
      return timer !== null;
    },
  };
}

const warsawTimeFormat = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Time of a save as the status line shows it, in Warsaw, e.g. "14:32". */
export function warsawTime(at: Date): string {
  return warsawTimeFormat.format(at);
}
