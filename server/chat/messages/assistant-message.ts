/**
 * assistant-message.ts — Constructs and validates assistant messages.
 * Owns assistant-specific rules: token counting, tool-call formatting.
 */
import { sanitizeContent } from './message-validator.ts';
import type { AssistantMessagePayload, ToolCallRecord } from '../types/message.types.ts';

/** Approximate token count (4 chars ≈ 1 token — good enough for budget tracking). */
export function approximateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Builds the payload for an assistant message from a streamed response.
 * Call this once streaming is finalized.
 */
export function buildAssistantPayload(
  projectId:  number,
  content:    string,
  runId?:     string,
  toolCalls?: ToolCallRecord[],
): AssistantMessagePayload {
  const clean = sanitizeContent(content);
  return {
    projectId,
    runId,
    content:    clean,
    toolCalls,
    tokensUsed: approximateTokenCount(clean),
  };
}

/**
 * Formats a tool-call result into a ToolCallRecord.
 */
export function buildToolCallRecord(
  tool:       string,
  args:       Record<string, unknown>,
  result:     unknown,
  durationMs: number,
  success:    boolean,
): ToolCallRecord {
  return {
    tool,
    args,
    result,
    status:     success ? 'done' : 'error',
    durationMs,
  };
}
