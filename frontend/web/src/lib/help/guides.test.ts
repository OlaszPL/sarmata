import { describe, expect, it } from 'vitest';
import { guides, guidesFor } from './guides';

describe('guidesFor', () => {
  it('puts the own guide first', () => {
    expect(guidesFor('evaluator').map((guide) => guide.id)).toEqual(['oceniajacy', 'kadry']);
    expect(guidesFor('hr').map((guide) => guide.id)).toEqual(['kadry', 'oceniajacy']);
  });

  it('gives the admin both guides in the default order', () => {
    expect(guidesFor('admin')).toEqual(guides);
  });
});

describe('guides', () => {
  it('keeps to the prose rules of the UI', () => {
    const text = guides
      .flatMap((guide) => [guide.intro, ...guide.steps.flatMap((step) => [step.title, step.body])])
      .join(' ');
    expect(text).not.toMatch(/[–—;]|\.\.\./);
  });
});
