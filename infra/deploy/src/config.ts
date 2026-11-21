import { z } from 'zod';

export const profileSchema = z.enum(['light', 'standard', 'server']);
export type Profile = z.infer<typeof profileSchema>;

/** Host ports. Kong (Supabase API) and the app, both behind Caddy in the server profile. */
export const APP_PORT = 3000;
export const API_PORT = 8000;
/** llama-server of an installation (the dev server from plan 5 uses 55490). */
export const AI_PORT = 55491;

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
    host: z.string().min(1),
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
    if (config.profile === 'light' && config.exposure !== 'localhost') {
      ctx.addIssue({
        code: 'custom',
        path: ['exposure'],
        message: 'Profil light działa tylko na localhost.',
      });
    }
    if (config.profile === 'server' && config.exposure !== 'lan') {
      ctx.addIssue({
        code: 'custom',
        path: ['exposure'],
        message: 'Profil server działa w sieci urzędu (lan).',
      });
    }
    if ((config.profile === 'server') !== (config.tls.mode !== 'none')) {
      ctx.addIssue({
        code: 'custom',
        path: ['tls'],
        message: 'HTTPS przez Caddy jest tylko w profilu server.',
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
  const appUrl =
    config.profile === 'server' ? `https://${config.host}` : `http://${config.host}:${APP_PORT}`;
  if (config.supabase.mode === 'external')
    return { appUrl, apiUrl: config.supabase.url.replace(/\/$/, '') };
  return {
    appUrl,
    apiUrl: config.profile === 'server' ? appUrl : `http://${config.host}:${API_PORT}`,
  };
}
