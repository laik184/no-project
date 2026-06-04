import type { ChatMessageRecord } from '../types/message.types.ts';
import { DEFAULT_CONTEXT_WINDOW } from '../constants/chat.constants.ts';

const AVG_CHARS_PER_TOKEN = 4;

export const contextWindow = {
  apply(
    messages:     ChatMessageRecord[],
    maxMessages = DEFAULT_CONTEXT_WINDOW,
  ): ChatMessageRecord[] {
    if (messages.length <= maxMessages) return messages;
    const system = messages.filter((m) => m.role === 'system');
    const rest   = messages.filter((m) => m.role !== 'system');
    const sliced = rest.slice(-Math.max(1, maxMessages - system.length));
    return [...system.slice(-1), ...sliced];
  },

  estimateTokens(messages: ChatMessageRecord[]): number {
    return Math.ceil(
      messages.reduce((acc, m) => acc + m.content.length, 0) / AVG_CHARS_PER_TOKEN,
    );
  },

  trimToTokenBudget(
    messages:  ChatMessageRecord[],
    maxTokens: number,
  ): ChatMessageRecord[] {
    const result: ChatMessageRecord[] = [];
    let total = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const tokens = Math.ceil(messages[i].content.length / AVG_CHARS_PER_TOKEN);
      if (total + tokens > maxTokens) break;
      result.unshift(messages[i]);
      total += tokens;
    }
    return result;
  },
};
