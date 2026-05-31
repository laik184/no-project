/**
 * server/shared/llm-client.ts
 *
 * Singleton OpenAI-compatible LLM client for the agent system.
 *
 * Key resolution order:
 *   1. OPENROUTER_API_KEY  — direct user-provided OpenRouter key
 *   2. AI_INTEGRATIONS_OPENROUTER_API_KEY — Replit's managed OpenRouter integration
 *
 * BaseURL resolution:
 *   1. LLM_BASE_URL — explicit override
 *   2. AI_INTEGRATIONS_OPENROUTER_BASE_URL — from Replit integration
 *   3. https://openrouter.ai/api/v1 — OpenRouter default
 */

import OpenAI from 'openai';

const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1';

function resolveApiKey(): string {
  const key =
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;

  if (!key) {
    throw new Error(
      '[llm-client] No LLM API key found. ' +
      'Set OPENROUTER_API_KEY or connect the OpenRouter Replit integration.',
    );
  }

  return key;
}

function resolveBaseUrl(): string {
  return (
    process.env.LLM_BASE_URL ||
    process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL ||
    OPENROUTER_DEFAULT_BASE
  );
}

export function getDefaultModel(): string {
  return process.env.LLM_MODEL ?? 'meta-llama/llama-3.3-70b-instruct';
}

let _client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey:  resolveApiKey(),
      baseURL: resolveBaseUrl(),
    });
  }
  return _client;
}

export function hasLLMKey(): boolean {
  return !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY
  );
}
