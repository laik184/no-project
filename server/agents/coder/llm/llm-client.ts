/**
 * llm-client.ts
 * Shared OpenAI-compatible client for the executor tool loop.
 * Supports both Replit AI Integrations and direct OpenRouter keys.
 */

import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (!_client) {
    const apiKey =
      process.env.OPENROUTER_API_KEY ||
      process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ||
      'no-key';
    const baseURL =
      process.env.LLM_BASE_URL ||
      process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL ||
      'https://openrouter.ai/api/v1';

    _client = new OpenAI({ apiKey, baseURL });
  }
  return _client;
}

export function getLLMModel(): string {
  return process.env.LLM_MODEL || 'openai/gpt-4o-mini';
}

export function isLLMAvailable(): boolean {
  return !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY
  );
}

/** Reset client (used in tests / key rotation). */
export function resetLLMClient(): void {
  _client = null;
}
