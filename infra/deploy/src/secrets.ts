import { createHmac } from 'node:crypto';
import { AI_PORT, publicUrls, type Answers, type InstallConfig } from './config.ts';

/** Returns cryptographically random bytes. Injected so secret generation stays a pure function. */
export type RandomBytes = (size: number) => Uint8Array;

/** Secrets of a local Supabase stack, named like the variables in .env. */
export interface GeneratedSecrets {
  readonly POSTGRES_PASSWORD: string;
  readonly JWT_SECRET: string;
  readonly ANON_KEY: string;
  readonly SERVICE_ROLE_KEY: string;
  readonly DASHBOARD_PASSWORD: string;
  readonly PG_META_CRYPTO_KEY: string;
  readonly S3_PROTOCOL_ACCESS_KEY_ID: string;
  readonly S3_PROTOCOL_ACCESS_KEY_SECRET: string;
}

/** Everything secret in .env. For an external Supabase ANON_KEY and SERVICE_ROLE_KEY are its keys. */
export interface Secrets extends GeneratedSecrets {
  readonly SMTP_PASS: string;
  readonly EXTERNAL_DATABASE_URL: string;
}

// Long-lived HS256 API keys, like generate-keys.sh upstream (5 years there, 10 here: an office
// installation must not stop working on a forgotten date).
const API_KEY_LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60;
const AI_HOST = 'http://host.docker.internal';

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const base64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const base64url = (text: string): string => Buffer.from(text).toString('base64url');

function signHs256(payload: Readonly<Record<string, string | number>>, secret: string): string {
  const unsigned = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(payload))}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** Same sizes as docker/utils/generate-keys.sh in supabase/supabase v1.26.08, for our services only. */
export function generateSecrets(random: RandomBytes, now: Date): GeneratedSecrets {
  const jwtSecret = base64(random(30));
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + API_KEY_LIFETIME_SECONDS;
  return {
    POSTGRES_PASSWORD: hex(random(16)),
    JWT_SECRET: jwtSecret,
    ANON_KEY: signHs256({ role: 'anon', iss: 'supabase', iat, exp }, jwtSecret),
    SERVICE_ROLE_KEY: signHs256({ role: 'service_role', iss: 'supabase', iat, exp }, jwtSecret),
    DASHBOARD_PASSWORD: hex(random(16)),
    PG_META_CRYPTO_KEY: base64(random(24)),
    S3_PROTOCOL_ACCESS_KEY_ID: hex(random(16)),
    S3_PROTOCOL_ACCESS_KEY_SECRET: hex(random(32)),
  };
}

export function secretsFromAnswers(answers: Answers, generated: GeneratedSecrets): Secrets {
  const external = answers.external;
  return {
    ...generated,
    ...(external === null
      ? {}
      : { ANON_KEY: external.publishableKey, SERVICE_ROLE_KEY: external.secretKey }),
    SMTP_PASS: answers.smtpPassword,
    EXTERNAL_DATABASE_URL: external?.databaseUrl ?? '',
  };
}

function envValues(config: InstallConfig, secrets: Secrets): Readonly<Record<string, string>> {
  const urls = publicUrls(config);
  const local = config.supabase.mode === 'local';
  const smtp = config.smtp;
  const ai = config.ai;
  return {
    ...secrets,
    POSTGRES_HOST: 'db',
    POSTGRES_DB: 'postgres',
    POSTGRES_PORT: '5432',
    SUPABASE_PUBLIC_URL: urls.apiUrl,
    SUPABASE_INTERNAL_URL: local ? 'http://kong:8000' : urls.apiUrl,
    API_EXTERNAL_URL: `${urls.apiUrl}/auth/v1`,
    SITE_URL: urls.appUrl,
    ADDITIONAL_REDIRECT_URLS: `${urls.appUrl}/**`,
    JWT_EXPIRY: '3600',
    DISABLE_SIGNUP: 'true',
    ENABLE_EMAIL_SIGNUP: 'true',
    // Without SMTP the admin sets temporary passwords, so e-mail confirmation cannot be required.
    ENABLE_EMAIL_AUTOCONFIRM: smtp.enabled ? 'false' : 'true',
    ENABLE_ANONYMOUS_USERS: 'false',
    ENABLE_PHONE_SIGNUP: 'false',
    ENABLE_PHONE_AUTOCONFIRM: 'false',
    SMTP_ADMIN_EMAIL: smtp.enabled ? smtp.senderEmail : 'noreply@sarmata.invalid',
    SMTP_HOST: smtp.enabled ? smtp.host : '',
    SMTP_PORT: smtp.enabled ? String(smtp.port) : '25',
    SMTP_USER: smtp.enabled ? smtp.user : '',
    SMTP_SENDER_NAME: smtp.enabled ? smtp.senderName : 'Sarmata',
    MAILER_URLPATHS_CONFIRMATION: '/auth/v1/verify',
    MAILER_URLPATHS_INVITE: '/auth/v1/verify',
    MAILER_URLPATHS_RECOVERY: '/auth/v1/verify',
    MAILER_URLPATHS_EMAIL_CHANGE: '/auth/v1/verify',
    PGRST_DB_SCHEMAS: 'public,graphql_public',
    DASHBOARD_USERNAME: 'supabase',
    STUDIO_DEFAULT_ORGANIZATION: 'Sarmata',
    STUDIO_DEFAULT_PROJECT: 'Sarmata',
    OPENAI_API_KEY: '',
    // Opaque sb_ keys stay off: the stack uses the HS256 keys above (Kong passes them through).
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_SECRET_KEY: '',
    GLOBAL_S3_BUCKET: 'stub',
    REGION: 'stub',
    STORAGE_TENANT_ID: 'stub',
    IMGPROXY_AUTO_WEBP: 'true',
    // Contract of backend/ai/src/config.ts. Empty values count as unset there.
    SARMATA_AI_ENABLED: ai.enabled ? 'true' : 'false',
    SARMATA_AI_TEXT_BASE_URL: ai.enabled ? `${AI_HOST}:${AI_PORT}/v1` : '',
    SARMATA_AI_TEXT_MODEL: ai.enabled ? ai.alias : '',
    SARMATA_AI_DECISION_BASE_URL:
      ai.enabled && ai.decisionPort !== null ? `${AI_HOST}:${ai.decisionPort}/v1` : '',
  };
}

/** The .env of an installation: compose reads it for every ${VARIABLE} in compose.yaml. */
export function renderEnv(config: InstallConfig, secrets: Secrets): string {
  const lines = Object.entries(envValues(config, secrets)).map(([key, value]) => {
    // Single quotes keep values literal in compose (no ${} interpolation), so they cannot contain one.
    if (/['\r\n]/.test(value))
      throw new Error(`${key} must not contain a single quote or a line break`);
    return `${key}='${value}'`;
  });
  return `# Generated by the Sarmata installer. Contains secrets: keep it private (mode 600).\n${lines.join('\n')}\n`;
}

export function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)='([^']*)'$/.exec(line);
    const key = match?.[1];
    const value = match?.[2];
    if (key !== undefined && value !== undefined) values[key] = value;
  }
  return values;
}

/** Secrets of an existing installation, so an update rewrites .env without new passwords. */
export function readSecrets(values: Readonly<Record<string, string>>): Secrets {
  const get = (name: keyof Secrets): string => {
    const value = values[name];
    if (value === undefined) throw new Error(`.env is missing ${name}`);
    return value;
  };
  return {
    POSTGRES_PASSWORD: get('POSTGRES_PASSWORD'),
    JWT_SECRET: get('JWT_SECRET'),
    ANON_KEY: get('ANON_KEY'),
    SERVICE_ROLE_KEY: get('SERVICE_ROLE_KEY'),
    DASHBOARD_PASSWORD: get('DASHBOARD_PASSWORD'),
    PG_META_CRYPTO_KEY: get('PG_META_CRYPTO_KEY'),
    S3_PROTOCOL_ACCESS_KEY_ID: get('S3_PROTOCOL_ACCESS_KEY_ID'),
    S3_PROTOCOL_ACCESS_KEY_SECRET: get('S3_PROTOCOL_ACCESS_KEY_SECRET'),
    SMTP_PASS: get('SMTP_PASS'),
    EXTERNAL_DATABASE_URL: get('EXTERNAL_DATABASE_URL'),
  };
}
