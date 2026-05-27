export function isLLMAvailable(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY);
}
