import { describe, expect, it } from 'vitest';
import { aiEnvLines } from './dev-env.ts';

describe('aiEnvLines', () => {
  it('writes the model call limits next to the endpoints', () => {
    const lines = aiEnvLines({ text: { baseUrl: 'http://127.0.0.1:55490/v1', model: 'bielik' } });
    expect(lines).toContain('SARMATA_AI_ENABLED=true');
    expect(lines).toContain('SARMATA_AI_TIMEOUT_MS=120000');
    expect(lines).toContain('SARMATA_AI_LONG_TIMEOUT_MS=600000');
    expect(lines).toContain('SARMATA_SEMBLE_TIMEOUT_MS=300000');
    expect(lines).toContain('SARMATA_AI_TEXT_BASE_URL=http://127.0.0.1:55490/v1');
  });
});
