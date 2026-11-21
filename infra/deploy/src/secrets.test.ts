import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  answersSchema,
  generateSecrets,
  parseEnv,
  publicUrls,
  readSecrets,
  renderEnv,
  secretsFromAnswers,
} from './index.ts';
import { config, PROFILES, secrets } from './test-support/fixtures.ts';

interface Claims {
  readonly role: string;
  readonly iss: string;
  readonly iat: number;
  readonly exp: number;
}

const claimsOf = (token: string): Claims =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as Claims;

describe('generateSecrets', () => {
  it('gives the same secrets for the same random bytes and time, in upstream sizes', () => {
    const generated = secrets();
    expect(secrets()).toEqual(generated);
    expect(generated.POSTGRES_PASSWORD).toMatch(/^[0-9a-f]{32}$/);
    expect(generated.JWT_SECRET).toHaveLength(40);
    expect(generated.PG_META_CRYPTO_KEY).toHaveLength(32);
    expect(generated.S3_PROTOCOL_ACCESS_KEY_SECRET).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives different secrets for different random bytes', () => {
    const other = generateSecrets(
      (size) => new Uint8Array(size).fill(7),
      new Date('2026-11-21T12:00:00Z'),
    );
    expect(other.POSTGRES_PASSWORD).not.toBe(secrets().POSTGRES_PASSWORD);
    expect(other.JWT_SECRET).not.toBe(secrets().JWT_SECRET);
  });

  it('signs the API keys as HS256 JWTs with the JWT secret, valid for 10 years', () => {
    const generated = secrets();
    const [header = '', payload = '', signature = ''] = generated.ANON_KEY.split('.');
    const expected = createHmac('sha256', generated.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    expect(signature).toBe(expected);
    const anon = claimsOf(generated.ANON_KEY);
    expect(anon).toMatchObject({ role: 'anon', iss: 'supabase' });
    expect(anon.exp - anon.iat).toBe(10 * 365 * 24 * 60 * 60);
    expect(claimsOf(generated.SERVICE_ROLE_KEY).role).toBe('service_role');
  });
});

describe('.env', () => {
  it('reads back to the same secrets, also with $ and double quotes', () => {
    const withSmtp = secrets({ SMTP_PASS: 'p@ss$word"x' });
    expect(readSecrets(parseEnv(renderEnv(config(), withSmtp)))).toEqual(withSmtp);
  });

  it('rejects a value with a single quote, which compose could not read literally', () => {
    expect(() => renderEnv(config(), secrets({ SMTP_PASS: "it's" }))).toThrow(/SMTP_PASS/);
  });

  it('uses the external project keys and database for an external Supabase', () => {
    const answers = answersSchema.parse({
      config: PROFILES.external,
      adminPassword: 'x'.repeat(12),
      external: {
        publishableKey: 'sb_publishable_1',
        secretKey: 'sb_secret_1',
        databaseUrl: 'postgresql://u:p@h:5432/postgres',
      },
    });
    expect(secretsFromAnswers(answers, secrets())).toMatchObject({
      ANON_KEY: 'sb_publishable_1',
      SERVICE_ROLE_KEY: 'sb_secret_1',
      EXTERNAL_DATABASE_URL: 'postgresql://u:p@h:5432/postgres',
      SMTP_PASS: '',
    });
  });

  it('points the app at the native AI runtime with the SARMATA_AI_* contract', () => {
    expect(parseEnv(renderEnv(PROFILES.withAi, secrets()))).toMatchObject({
      SARMATA_AI_ENABLED: 'true',
      SARMATA_AI_TEXT_BASE_URL: 'http://host.docker.internal:55491/v1',
      SARMATA_AI_TEXT_MODEL: 'bielik-11b-v3.1-instruct',
      SARMATA_AI_DECISION_BASE_URL: 'http://host.docker.internal:8026/v1',
    });
    expect(parseEnv(renderEnv(config(), secrets()))).toMatchObject({
      SARMATA_AI_ENABLED: 'false',
      SARMATA_AI_TEXT_BASE_URL: '',
    });
  });

  it('confirms e-mails automatically only without SMTP', () => {
    expect(parseEnv(renderEnv(config(), secrets())).ENABLE_EMAIL_AUTOCONFIRM).toBe('true');
    const withSmtp = config({
      smtp: {
        enabled: true,
        host: 'smtp.urzad.test',
        port: 587,
        user: 'oceny',
        senderEmail: 'oceny@urzad.test',
        senderName: 'Oceny',
      },
    });
    expect(parseEnv(renderEnv(withSmtp, secrets())).ENABLE_EMAIL_AUTOCONFIRM).toBe('false');
  });
});

describe('publicUrls', () => {
  it.each([
    ['light', PROFILES.light, 'http://localhost:3000', 'http://localhost:8000'],
    ['standard', PROFILES.standard, 'http://oceny-pc:3000', 'http://oceny-pc:8000'],
    ['server', PROFILES.server, 'https://oceny.urzad.local', 'https://oceny.urzad.local'],
    ['external', PROFILES.external, 'http://localhost:3000', 'https://abc.supabase.co'],
  ] as const)('%s', (_name, profile, appUrl, apiUrl) => {
    expect(publicUrls(profile)).toEqual({ appUrl, apiUrl });
  });
});
