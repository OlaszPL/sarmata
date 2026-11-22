import { describe, expect, it } from 'vitest';
import { evaluationStatuses, statusTag } from './status-labels';

describe('statusTag', () => {
  it('gives every status a label and a tone', () => {
    expect(evaluationStatuses).toHaveLength(9);
    for (const status of evaluationStatuses) {
      const tag = statusTag(status);
      expect(tag.label.length).toBeGreaterThan(0);
      expect(tag.tone.length).toBeGreaterThan(0);
    }
  });

  it('labels an objection as attention', () => {
    expect(statusTag('objection')).toEqual({ label: 'Sprzeciw', tone: 'attention' });
  });
});
