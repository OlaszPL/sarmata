import { type AppreciationGap, type CalendarDate, type NoteFact } from '@sarmata/domain';
import { z } from 'zod';
import { type Task, describeNotes, ok, withSignal } from './task';

const DAY_MS = 86_400_000;

/**
 * Days since the last appreciation note. Without one the gap is overdue. `thresholdDays` is the office
 * setting `appreciationGapDays`.
 */
export function appreciationGap(
  notes: readonly NoteFact[],
  today: CalendarDate,
  thresholdDays: number,
): AppreciationGap {
  const last = notes
    .filter((note) => note.kind === 'appreciation')
    .map((note) => note.occurredOn)
    .sort()
    .at(-1);
  if (last === undefined) {
    return { lastAppreciationOn: null, daysSince: null, thresholdDays, overdue: true };
  }
  const daysSince = Math.round((Date.parse(today) - Date.parse(last)) / DAY_MS);
  return {
    lastAppreciationOn: last,
    daysSince,
    thresholdDays,
    overdue: daysSince >= thresholdDays,
  };
}

/** When to appreciate the employee: the gap since the last appreciation and SBI feedback from positive notes. */
export const appreciationMoments: Task<'appreciation_moments'> = async (
  input,
  { ai, system },
  signal,
) => {
  const gap = appreciationGap(input.notes, input.today, input.gapDays);
  const positive = input.notes.filter((note) => note.sign === 'plus');
  if (positive.length === 0) return ok({ gap, moments: [] });
  const ids = positive.map((note) => note.id);
  const result = await ai.generateObject({
    schemaName: 'appreciation_moments',
    schema: z.object({
      moments: z.array(
        z.object({
          noteIds: z.array(z.string()),
          reason: z.string(),
          sbi: z.object({ situation: z.string(), behaviour: z.string(), impact: z.string() }),
        }),
      ),
    }),
    system,
    prompt:
      `Dzisiaj jest ${input.today}. ` +
      (gap.lastAppreciationOn === null
        ? 'W notatkach nie ma jeszcze docenienia.'
        : `Ostatnie docenienie: ${gap.lastAppreciationOn}, ${gap.daysSince} dni temu.`) +
      `\n\nNotatki pozytywne:\n${describeNotes(positive)}`,
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  const known = new Set(ids);
  const moments = result.value.moments
    .map((moment) => ({ ...moment, noteIds: moment.noteIds.filter((id) => known.has(id)) }))
    .filter((moment) => moment.noteIds.length > 0);
  return ok({ gap, moments });
};
