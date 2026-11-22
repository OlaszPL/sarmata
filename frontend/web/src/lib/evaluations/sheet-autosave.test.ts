import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, warsawTime } from './sheet-autosave';

describe('createAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves once after the pause that follows the last change', () => {
    const save = vi.fn();
    const autosave = createAutosave(save, 1500);
    autosave.schedule();
    vi.advanceTimersByTime(1000);
    autosave.schedule();
    vi.advanceTimersByTime(1499);
    expect(save).not.toHaveBeenCalled();
    expect(autosave.pending).toBe(true);
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.pending).toBe(false);
  });

  it('flushes a scheduled save at once and not again later', () => {
    const save = vi.fn();
    const autosave = createAutosave(save, 1500);
    autosave.schedule();
    autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does nothing on flush without a scheduled change', () => {
    const save = vi.fn();
    createAutosave(save, 1500).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves now and drops the scheduled save', () => {
    const save = vi.fn();
    const autosave = createAutosave(save, 1500);
    autosave.saveNow();
    autosave.schedule();
    autosave.saveNow();
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('hands a scheduled change over once', () => {
    const save = vi.fn();
    const autosave = createAutosave(save, 1500);
    autosave.schedule();
    expect(autosave.takePending()).toBe(true);
    expect(autosave.takePending()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('warsawTime', () => {
  it('shows hours and minutes in Warsaw', () => {
    expect(warsawTime(new Date('2026-11-22T13:05:00Z'))).toBe('14:05');
    expect(warsawTime(new Date('2026-07-01T22:30:00Z'))).toBe('00:30');
  });
});
