import { describe, expect, it } from 'vitest';
import { nationalBenchmark } from './national-benchmark';

describe('nationalBenchmark', () => {
  it('national shares stay below one', () => {
    const sum =
      Object.values(nationalBenchmark.levelShares).reduce((a, b) => a + b, 0) +
      nationalBenchmark.negativeShare;
    expect(sum).toBeLessThanOrEqual(1.05);
    expect(Object.values(nationalBenchmark.levelShares).every((share) => share < 1)).toBe(true);
  });
});
