import { describe, expect, it } from 'vitest';
import { calendarDate, versionInForce } from '../index';

const version = (effectiveFrom: string) => ({
  id: effectiveFrom,
  effectiveFrom: calendarDate(effectiveFrom),
});

describe('versionInForce', () => {
  const versions = [version('2027-03-01'), version('2016-04-23')];

  it.each([
    ['2026-11-21', '2016-04-23'],
    ['2027-02-28', '2016-04-23'],
    ['2027-03-01', '2027-03-01'],
    ['2030-01-01', '2027-03-01'],
  ])('on %s picks the version effective from %s', (on, expected) => {
    expect(versionInForce(versions, calendarDate(on))?.id).toBe(expected);
  });

  it('returns null before the first version', () => {
    expect(versionInForce(versions, calendarDate('2016-04-22'))).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(versionInForce([], calendarDate('2026-11-21'))).toBeNull();
  });
});
