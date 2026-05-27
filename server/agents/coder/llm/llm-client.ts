const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
  ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;

export function isLLMAvailable(): boolean {
  return typeof OPENROUTER_KEY === 'string' && OPENROUTER_KEY.trim().length > 0;
}

export function getLLMApiKey(): string {
  if (!isLLMAvailable()) throw new Error('[llm-client] OPENROUTER_API_KEY is not set');
  return OPENROUTER_KEY!;
}

export function getLLMModel(): string {
  return process.env.LLM_MODEL ?? 'openai/gpt-4o-mini';
}

export function getLLMBaseUrl(): string {
  return process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1';
}
