import { describe, expect, it } from 'vitest';
import { workerConfigFromEnv } from './config';

const base = { SUPABASE_URL: 'http://127.0.0.1:55421', SUPABASE_SECRET_KEY: 'secret' };

describe('workerConfigFromEnv', () => {
  it('needs only the database and ignores the unset mail settings', () => {
    expect(workerConfigFromEnv({ ...base, SMTP_HOST: '', SMTP_PORT: '25' })).toEqual({
      supabaseUrl: 'http://127.0.0.1:55421',
      secretKey: 'secret',
      idleDelayMs: 1_000,
      siteUrl: 'http://localhost:3000',
      smtp: null,
    });
  });

  it('reads the mail settings of the installer', () => {
    const config = workerConfigFromEnv({
      ...base,
      SMTP_HOST: 'poczta.urzad.test',
      SMTP_PORT: '587',
      SMTP_USER: 'sarmata',
      SMTP_PASS: 'tajne',
      SMTP_SENDER_EMAIL: 'sarmata@urzad.test',
      SMTP_SENDER_NAME: 'Sarmata Urząd',
    });
    expect(config.smtp).toEqual({
      host: 'poczta.urzad.test',
      port: 587,
      user: 'sarmata',
      password: 'tajne',
      senderEmail: 'sarmata@urzad.test',
      senderName: 'Sarmata Urząd',
    });
  });

  it('site url defaults to localhost', () => {
    expect(workerConfigFromEnv(base).siteUrl).toBe('http://localhost:3000');
    expect(workerConfigFromEnv({ ...base, SITE_URL: 'https://sarmata.urzad.test' }).siteUrl).toBe(
      'https://sarmata.urzad.test',
    );
  });

  it('rejects a mail host without port and sender', () => {
    expect(() => workerConfigFromEnv({ ...base, SMTP_HOST: 'poczta.urzad.test' })).toThrow(
      /SMTP_PORT/,
    );
  });

  it('names the worker in the error for a missing key', () => {
    expect(() => workerConfigFromEnv({ SUPABASE_URL: base.SUPABASE_URL })).toThrow(
      /Invalid worker configuration/,
    );
  });
});
