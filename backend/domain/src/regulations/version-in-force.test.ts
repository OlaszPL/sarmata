import { describe, expect, it } from 'vitest';
import { calendarDate, officeVersionInForce, versionInForce } from '../index';

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

describe('officeVersionInForce', () => {
  const entry = (id: string, effectiveFrom: string, isOfficial: boolean) => ({
    id,
    effectiveFrom: calendarDate(effectiveFrom),
    isOfficial,
  });
  const versions = [
    entry('official-2016', '2016-04-23', true),
    entry('office-local', '2027-01-01', false),
    entry('official-2027', '2027-01-01', true),
  ];

  it('office version wins a tie and loses to a newer official one', () => {
    expect(officeVersionInForce(versions, calendarDate('2027-01-01'))?.id).toBe('office-local');
    expect(officeVersionInForce(versions, calendarDate('2026-12-31'))?.id).toBe('official-2016');
    const newer = [...versions, entry('official-2028', '2028-01-01', true)];
    expect(officeVersionInForce(newer, calendarDate('2028-01-01'))?.id).toBe('official-2028');
    expect(officeVersionInForce(newer, calendarDate('2027-06-01'))?.id).toBe('office-local');
  });

  it('a tie wins for the office version regardless of the list order', () => {
    const reversed = [...versions].reverse();
    expect(officeVersionInForce(reversed, calendarDate('2027-01-01'))?.id).toBe('office-local');
  });

  it('returns null before the first version', () => {
    expect(officeVersionInForce(versions, calendarDate('2016-04-22'))).toBeNull();
  });
});
