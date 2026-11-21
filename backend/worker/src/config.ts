import { parseEnv } from '@sarmata/domain';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SARMATA_WORKER_IDLE_DELAY_MS: z.coerce.number().int().positive().default(1_000),
  // Mail settings that the installer passes. No mailer reads them until notifications exist, so
  // they are validated only: a half-filled setup is caught at start, not at the first e-mail.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_SENDER_EMAIL: z.email().optional(),
  SMTP_SENDER_NAME: z.string().min(1).optional(),
});

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string | null;
  readonly password: string | null;
  readonly senderEmail: string;
  readonly senderName: string;
}

export interface WorkerConfig {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly idleDelayMs: number;
  /** Null when no mail server is configured. Unused until notifications. */
  readonly smtp: SmtpConfig | null;
}

export function workerConfigFromEnv(env: Record<string, string | undefined>): WorkerConfig {
  const values = parseEnv(envSchema, env, 'worker');
  return {
    supabaseUrl: values.SUPABASE_URL,
    secretKey: values.SUPABASE_SECRET_KEY,
    idleDelayMs: values.SARMATA_WORKER_IDLE_DELAY_MS,
    smtp: smtpFrom(values),
  };
}

function smtpFrom(values: z.output<typeof envSchema>): SmtpConfig | null {
  if (values.SMTP_HOST === undefined) return null;
  if (values.SMTP_PORT === undefined || values.SMTP_SENDER_EMAIL === undefined) {
    throw new Error(
      'Invalid worker configuration:\nSMTP_HOST needs SMTP_PORT and SMTP_SENDER_EMAIL as well',
    );
  }
  return {
    host: values.SMTP_HOST,
    port: values.SMTP_PORT,
    user: values.SMTP_USER ?? null,
    password: values.SMTP_PASS ?? null,
    senderEmail: values.SMTP_SENDER_EMAIL,
    senderName: values.SMTP_SENDER_NAME ?? 'Sarmata',
  };
}
