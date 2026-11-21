/**
 * National distribution of periodic evaluation levels in the civil service. The share of `above`
 * is read off a chart. The report gives the levels `below` and `far-below` only together, as
 * negative evaluations.
 */
export const nationalBenchmark = {
  year: 2025,
  source: 'Sprawozdanie Szefa SC za 2025 r., s. 28 i s. 66',
  levelShares: { 'far-above': 0.066, above: 0.43, meets: 0.5 },
  negativeShare: 0.0039,
} as const;
