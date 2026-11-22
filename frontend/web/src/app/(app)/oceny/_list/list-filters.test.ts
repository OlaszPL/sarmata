import { describe, expect, it } from 'vitest';
import { filterHref, parseListFilters } from './list-filters';

describe('parseListFilters', () => {
  it('accepts a known status and employee', () => {
    expect(parseListFilters({ status: 'period', pracownik: 'x' }, ['x'])).toEqual({
      status: 'period',
      employeeId: 'x',
    });
  });

  it('drops unknown values', () => {
    expect(parseListFilters({ status: 'bogus', pracownik: 'y' }, ['x'])).toEqual({
      status: null,
      employeeId: null,
    });
  });

  it('takes the first value of a repeated parameter', () => {
    expect(
      parseListFilters({ status: ['closed', 'period'], pracownik: ['x', 'y'] }, ['x', 'y']),
    ).toEqual({
      status: 'closed',
      employeeId: 'x',
    });
  });
});

describe('filterHref', () => {
  it('has no query without filters', () => {
    expect(filterHref({ status: null, employeeId: null })).toBe('/oceny');
  });

  it('keeps only the set parameters', () => {
    expect(filterHref({ status: 'period', employeeId: null })).toBe('/oceny?status=period');
    expect(filterHref({ status: 'period', employeeId: 'x' })).toBe(
      '/oceny?status=period&pracownik=x',
    );
  });
});
