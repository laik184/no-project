/**
 * context-builder.ts — Assembles the LLM context window for a run.
 * Single responsibility: compose context from loaded messages + metadata.
 */
import type { ChatMessageRecord } from '../types/message.types.ts';
import { contextWindow } from './context-window.ts';

export interface ContextEntry {
  role:    string;
  content: string;
}

export interface BuiltContext {
  entries:      ContextEntry[];
  totalTokens:  number;
  truncated:    boolean;
  droppedCount: number;
}

/**
 * Build the context array from raw message records.
 * Applies sliding-window truncation to stay within budget.
 */
export function buildContext(
  messages:   ChatMessageRecord[],
  systemPrompt?: string,
  maxMessages = 40,
): BuiltContext {
  const windowed   = contextWindow.apply(messages, maxMessages);
  const truncated  = windowed.length < messages.length;
  const dropped    = messages.length - windowed.length;

  const entries: ContextEntry[] = [];

  if (systemPrompt) {
    entries.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of windowed) {
    entries.push({ role: msg.role, content: msg.content });
  }

  const totalTokens = entries.reduce(
    (sum, e) => sum + Math.ceil(e.content.length / 4), 0,
  );

  return { entries, totalTokens, truncated, droppedCount: dropped };
}

/**
 * Serialize context entries to a flat string for logging/debugging.
 */
export function serializeContext(ctx: BuiltContext): string {
  return ctx.entries
    .map((e) => `[${e.role.toUpperCase()}]\n${e.content}`)
    .join('\n\n---\n\n');
}
