import { contextWindow }   from './context-window.ts';
import type { ChatMessageRecord } from '../types/message.types.ts';
import { DEFAULT_CONTEXT_WINDOW } from '../constants/chat.constants.ts';

export interface BuiltContext {
  entries:        ChatMessageRecord[];
  systemPrompt?:  string;
  tokenEstimate:  number;
}

export function buildContext(
  messages:       ChatMessageRecord[],
  systemPrompt?:  string,
  maxMessages  = DEFAULT_CONTEXT_WINDOW,
): BuiltContext {
  const entries       = contextWindow.apply(messages, maxMessages);
  const tokenEstimate = contextWindow.estimateTokens(entries);
  return { entries, systemPrompt, tokenEstimate };
}

export function serializeContext(ctx: BuiltContext): string {
  const parts: string[] = [];
  if (ctx.systemPrompt) parts.push(`[System]\n${ctx.systemPrompt}`);
  for (const m of ctx.entries) {
    parts.push(`[${m.role.toUpperCase()}]\n${m.content}`);
  }
  return parts.join('\n\n');
}
