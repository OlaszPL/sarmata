import { describe, expect, it } from 'vitest';
import { importFields } from '@sarmata/services';
import { actionLabels, decisionsFromForm, importFieldLabels, mappingFromForm } from './import';

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe('mappingFromForm', () => {
  it('keeps mapped fields and drops empty ones', () => {
    const mapping = mappingFromForm(
      form({ 'map.firstName': 'Imię', 'map.lastName': 'Nazwisko', 'map.email': '' }),
    );
    expect(mapping).toEqual({ firstName: 'Imię', lastName: 'Nazwisko' });
  });
});

describe('decisionsFromForm', () => {
  it('reads create, skip and update with an id, and ignores absent rows', () => {
    const decisions = decisionsFromForm(
      form({
        'decision.2': 'update:abc-1',
        'decision.3': 'skip',
        'decision.5': 'create',
        'decision.7': 'garbage',
        other: 'skip',
      }),
    );
    expect(decisions).toEqual({ 2: { updateEmployeeId: 'abc-1' }, 3: 'skip', 5: 'create' });
    expect(decisions[4]).toBeUndefined();
  });
});

describe('labels', () => {
  it('cover every import field', () => {
    expect(Object.keys(importFieldLabels).sort()).toEqual([...importFields].sort());
  });

  it('cover every proposed action with text', () => {
    for (const { label } of Object.values(actionLabels)) expect(label).not.toBe('');
    expect(Object.keys(actionLabels)).toHaveLength(4);
  });
});
