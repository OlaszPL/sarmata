import { isIP } from 'node:net';
import { INSTALL_PROFILES } from '@sarmata/ai-runtime';
import { z } from 'zod';
import { PROFILE_TABLE, usesCaddy } from './profiles.ts';

export const profileSchema = z.enum(INSTALL_PROFILES);

/** Host ports of the app and of Kong (Supabase API), published on 127.0.0.1 only. */
export const APP_PORT = 3000;
export const API_PORT = 8000;
/** llama-server of an installation. The dev server of pnpm ai:start uses 55490, so both can run. */
export const AI_PORT = 55491;
/** Native AI listens only here. Containers reach it through CONTAINER_AI_HOST (ADR 0003). */
export const NATIVE_AI_BIND = '127.0.0.1';
/** The host's loopback as containers see it: Docker Desktop and Colima map it, ai-relay elsewhere. */
export const CONTAINER_AI_HOST = 'host.docker.internal';

/** A DNS name or an IP address, nothing a Caddyfile or a URL would read differently. */
export function isHostName(value: string): boolean {
  if (isIP(value) !== 0) return true;
  return (
    value.length <= 253 &&
    value.split('.').every((label) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
}

const tlsSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({ mode: z.literal('internal') }),
  z.object({ mode: z.literal('files'), certPath: z.string().min(1), keyPath: z.string().min(1) }),
]);

const supabaseSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('local') }),
  z.object({ mode: z.literal('external'), url: z.url() }),
]);

const smtpSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    user: z.string(),
    senderEmail: z.email(),
    senderName: z.string().min(1),
  }),
]);

const aiSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    /** MODEL_FILES key from @sarmata/ai-runtime. */
    modelId: z.string().min(1),
    /** Model name in the OpenAI-compatible API (SARMATA_AI_TEXT_MODEL). */
    alias: z.string().min(1),
    /** Port of the Bielik-One frontend, null without Bielik-One. */
    decisionPort: z.number().int().positive().nullable(),
  }),
]);

/** Non-secret installation settings, stored as sarmata.json in the installation directory. */
export const installConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    profile: profileSchema,
    exposure: z.enum(['localhost', 'lan']),
    host: z.string().refine(isHostName, 'Podaj nazwę komputera z DNS albo adres IP.'),
    tls: tlsSchema,
    supabase: supabaseSchema,
    smtp: smtpSchema,
    ai: aiSchema,
    office: z.object({ name: z.string().trim().min(1) }),
    admin: z.object({
      email: z.email(),
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
    }),
    shortcut: z.boolean(),
  })
  .superRefine((config, ctx) => {
    const allowed = PROFILE_TABLE[config.profile].exposures;
    if (!allowed.includes(config.exposure)) {
      ctx.addIssue({
        code: 'custom',
        path: ['exposure'],
        message: `Profil ${config.profile} działa tylko z dostępem: ${allowed.join(', ')}.`,
      });
    }
    if (usesCaddy(config) !== (config.tls.mode !== 'none')) {
      ctx.addIssue({
        code: 'custom',
        path: ['tls'],
        message: 'Dostęp z sieci urzędu idzie przez HTTPS (Caddy), dostęp z tego komputera bez.',
      });
    }
    if (config.exposure === 'localhost' && config.host !== 'localhost') {
      ctx.addIssue({
        code: 'custom',
        path: ['host'],
        message: 'Przy dostępie tylko z tego komputera host to localhost.',
      });
    }
  });
export type InstallConfig = z.infer<typeof installConfigSchema>;
export type AiSettings = InstallConfig['ai'];
export type EnabledAi = Extract<AiSettings, { enabled: true }>;

/** Wizard answers: the settings plus secrets that never land in sarmata.json. */
export const answersSchema = z
  .object({
    config: installConfigSchema,
    adminPassword: z.string().min(12),
    smtpPassword: z.string().default(''),
    external: z
      .object({
        publishableKey: z.string().min(1),
        secretKey: z.string().min(1),
        databaseUrl: z.string().min(1),
      })
      .nullable()
      .default(null),
  })
  .superRefine((answers, ctx) => {
    if ((answers.config.supabase.mode === 'external') !== (answers.external !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['external'],
        message:
          'Klucze i adres bazy podaje się wtedy i tylko wtedy, gdy Supabase jest zewnętrzne.',
      });
    }
  });
export type Answers = z.infer<typeof answersSchema>;

export interface PublicUrls {
  /** Address of the app in the browser. */
  readonly appUrl: string;
  /** Supabase API as the browser and e-mail links see it (Kong, Caddy or the external project). */
  readonly apiUrl: string;
}

export function publicUrls(config: InstallConfig): PublicUrls {
  const caddy = usesCaddy(config);
  const appUrl = caddy ? `https://${config.host}` : `http://${config.host}:${APP_PORT}`;
  if (config.supabase.mode === 'external')
    return { appUrl, apiUrl: config.supabase.url.replace(/\/$/, '') };
  return { appUrl, apiUrl: caddy ? appUrl : `http://${config.host}:${API_PORT}` };
}
