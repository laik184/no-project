/**
 * llm-client.ts
 * LLM connection utilities.
 * Single responsibility: availability check and base client config.
 */

export function isLLMAvailable(): boolean {
  const key = process.env.OPENROUTER_API_KEY
    ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

export function getLLMModel(): string {
  return process.env.LLM_MODEL ?? 'openai/gpt-4o-mini';
}

export function getLLMBaseUrl(): string {
  return process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1';
}

export function getLLMApiKey(): string {
  return (
    process.env.OPENROUTER_API_KEY ??
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY ??
    ''
  );
}
