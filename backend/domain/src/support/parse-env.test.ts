import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorMessage } from './error-message';
import { parseEnv } from './parse-env';

const schema = z.object({ PORT: z.coerce.number().int().positive(), NAME: z.string().min(1) });

describe('parseEnv', () => {
  it('returns the parsed values', () => {
    expect(parseEnv(schema, { PORT: '8080', NAME: 'x' }, 'test')).toEqual({
      PORT: 8080,
      NAME: 'x',
    });
  });

  it('treats empty variables as unset', () => {
    const withDefault = z.object({ NAME: z.string().min(1).default('fallback') });
    expect(parseEnv(withDefault, { NAME: '' }, 'test')).toEqual({ NAME: 'fallback' });
  });

  it('lists every problem under the label and appends the hint', () => {
    expect(() => parseEnv(schema, { PORT: 'abc' }, 'test', 'Run the setup.')).toThrow(
      /^Invalid test configuration:\n[\s\S]*PORT[\s\S]*NAME[\s\S]*\nRun the setup\.$/,
    );
  });
});

describe('errorMessage', () => {
  it('reads the message of an Error and stringifies anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(42)).toBe('42');
  });
});
