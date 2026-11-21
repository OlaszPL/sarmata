import { fileURLToPath } from 'node:url';
import { parseEnv } from '@sarmata/domain';
import { z } from 'zod';
import { type SembleLegalSearchConfig } from './legal-search';

export interface AiEndpoint {
  /** Base URL with the API version, e.g. `http://127.0.0.1:55490/v1`. */
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string | null;
}

export interface AiConfig {
  readonly enabled: boolean;
  readonly timeoutMs: number;
  /** OpenAI-compatible text model (llama-server, vLLM, MLX). */
  readonly text: AiEndpoint | null;
  /** Bielik-One `/v1/systemone`. Null where the hardware cannot run it: the text model decides then (ADR 0005). */
  readonly decision: AiEndpoint | null;
}

const envSchema = z.object({
  SARMATA_AI_ENABLED: z.enum(['true', 'false']).default('false'),
  SARMATA_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  SARMATA_AI_TEXT_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  SARMATA_AI_TEXT_MODEL: z.string().min(1).default('bielik'),
  SARMATA_AI_TEXT_API_KEY: z.string().min(1).optional(),
  SARMATA_AI_DECISION_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  SARMATA_AI_DECISION_MODEL: z.string().min(1).default('decision'),
  SARMATA_AI_DECISION_API_KEY: z.string().min(1).optional(),
});

const endpoint = (
  baseUrl: string | undefined,
  model: string,
  apiKey: string | undefined,
): AiEndpoint | null =>
  baseUrl === undefined
    ? null
    : { baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey: apiKey ?? null };

/** Installation settings of AI. Empty variables count as unset. AI is off unless SARMATA_AI_ENABLED=true. */
export function aiConfigFromEnv(env: Record<string, string | undefined>): AiConfig {
  const values = parseEnv(envSchema, env, 'AI');
  return {
    enabled: values.SARMATA_AI_ENABLED === 'true',
    timeoutMs: values.SARMATA_AI_TIMEOUT_MS,
    text: endpoint(
      values.SARMATA_AI_TEXT_BASE_URL,
      values.SARMATA_AI_TEXT_MODEL,
      values.SARMATA_AI_TEXT_API_KEY,
    ),
    decision: endpoint(
      values.SARMATA_AI_DECISION_BASE_URL,
      values.SARMATA_AI_DECISION_MODEL,
      values.SARMATA_AI_DECISION_API_KEY,
    ),
  };
}

const legalSearchEnvSchema = z.object({
  SARMATA_SEMBLE_COMMAND: z.string().trim().min(1).default('uvx --from semble[mcp]==0.6.1 semble'),
  SARMATA_LEGAL_ROOT: z.string().min(1).optional(),
  SARMATA_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
});

/** The repository directory (backend/ai/src is three levels down): legal source paths are relative to it. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** semble command and the directory the legal source paths of the regulation versions start from. */
export function legalSearchConfigFromEnv(
  env: Record<string, string | undefined>,
): SembleLegalSearchConfig {
  const values = parseEnv(legalSearchEnvSchema, env, 'legal search');
  return {
    command: values.SARMATA_SEMBLE_COMMAND.split(/\s+/),
    root: values.SARMATA_LEGAL_ROOT ?? REPO_ROOT,
    timeoutMs: values.SARMATA_AI_TIMEOUT_MS,
  };
}
