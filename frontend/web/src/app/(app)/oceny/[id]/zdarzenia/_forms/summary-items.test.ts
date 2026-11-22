import { describe, expect, it } from 'vitest';
import { summaryItems } from './summary-items';

describe('summaryItems', () => {
  it('links known fields in page order and leaves the rest unlinked', () => {
    expect(
      summaryItems({ closedOn: 'A', gradeRequest: 'B', reason: undefined }, ['reason', 'closedOn']),
    ).toEqual({ linked: [{ fieldId: 'closedOn', message: 'A' }], unlinked: ['B'] });
  });

  it('orders linked items by the fields list', () => {
    const result = summaryItems({ b: 'two', a: 'one' }, ['a', 'b']);
    expect(result.linked.map((item) => item.fieldId)).toEqual(['a', 'b']);
  });
});
