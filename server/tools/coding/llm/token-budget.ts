/**
 * server/tools/coding/llm/token-budget.ts
 *
 * Token budget estimation and context truncation for LLM prompts.
 * Pure functions — no side effects, no I/O.
 */

const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 6_000;

/**
 * Rough token estimate: 1 token ≈ 4 characters.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Check whether the combined system + user prompt fits within budget.
 */
export function isWithinBudget(
  system:    string,
  user:      string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): boolean {
  return estimateTokens(system + user) <= maxTokens;
}

/**
 * Truncate a string to fit within a token budget.
 * Appends "[...truncated]" when truncated.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  const marker = '\n[...truncated]';
  return text.slice(0, maxChars - marker.length) + marker;
}

/**
 * Fit user prompt within available token budget after system prompt.
 */
export function fitUserPrompt(
  system:    string,
  user:      string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): string {
  const systemTokens = estimateTokens(system);
  const remaining    = maxTokens - systemTokens - 200; // 200 token safety margin
  if (remaining <= 0) return '';
  return truncateToTokens(user, remaining);
}

export { DEFAULT_MAX_TOKENS };
