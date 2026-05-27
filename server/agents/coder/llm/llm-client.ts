export function isLLMAvailable(): boolean {
  return !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY
  );
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
