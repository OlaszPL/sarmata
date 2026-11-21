import { describe, expect, it } from 'vitest';
import { emptySheetContent, sheetContentSchema } from './sheet-content';

describe('sheet content', () => {
  it('an empty sheet is valid', () => {
    expect(sheetContentSchema.parse(emptySheetContent())).toEqual(emptySheetContent());
  });

  it('rejects an impossible date', () => {
    const content = emptySheetContent();
    expect(() =>
      sheetContentSchema.parse({
        ...content,
        partOne: { ...content.partOne, dueOn: '2026-02-30' },
      }),
    ).toThrow(/invalid date/);
  });

  it('rejects unknown properties', () => {
    expect(() => sheetContentSchema.parse({ ...emptySheetContent(), extra: 1 })).toThrow();
  });
});
