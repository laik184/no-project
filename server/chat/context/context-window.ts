/**
 * context-window.ts — Sliding-window truncation for LLM context budget.
 * Pure logic — no I/O, no side effects.
 */
import type { ChatMessageRecord } from '../types/message.types.ts';
import { DEFAULT_CONTEXT_WINDOW, MAX_CONTEXT_WINDOW } from '../constants/chat.constants.ts';

export const contextWindow = {
  /**
   * Apply sliding-window to message list.
   * Always keeps the system message (first, if present) + newest N messages.
   */
  apply(
    messages: ChatMessageRecord[],
    maxMessages = DEFAULT_CONTEXT_WINDOW,
  ): ChatMessageRecord[] {
    const limit = Math.min(maxMessages, MAX_CONTEXT_WINDOW);

    if (messages.length <= limit) return messages;

    // Keep the first system message if present, then the most recent (limit - 1).
    const systemMsg = messages[0]?.role === 'system' ? [messages[0]] : [];
    const rest      = systemMsg.length > 0 ? messages.slice(1) : messages;
    const tail      = rest.slice(-(limit - systemMsg.length));

    return [...systemMsg, ...tail];
  },

  /**
   * Estimate total token usage of a message array.
   */
  estimateTokens(messages: ChatMessageRecord[]): number {
    return messages.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0,
    );
  },

  /**
   * Find how many messages to drop to stay under a token budget.
   */
  trimToTokenBudget(
    messages: ChatMessageRecord[],
    maxTokens: number,
  ): ChatMessageRecord[] {
    let tokens = 0;
    const result: ChatMessageRecord[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const t = Math.ceil(messages[i].content.length / 4);
      if (tokens + t > maxTokens) break;
      result.unshift(messages[i]);
      tokens += t;
    }
    return result;
  },
};
