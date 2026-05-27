/**
 * response-parser.ts
 * Parses OpenAI chat completion responses into typed tool calls.
 */

import type OpenAI from 'openai';
import type { ToolName } from '../tools/tool-schema.ts';
import { isValidToolName } from '../tools/tool-registry.ts';

export interface ParsedToolCall {
  id:   string;
  name: ToolName;
  args: Record<string, unknown>;
}

export interface ParsedResponse {
  toolCalls:   ParsedToolCall[];
  textContent: string;
  finishReason: string;
}

export function parseResponse(
  choice: OpenAI.Chat.ChatCompletionChoice,
): ParsedResponse {
  const finishReason = choice.finish_reason ?? 'unknown';
  const msg          = choice.message;
  const textContent  = msg.content ?? '';
  const toolCalls: ParsedToolCall[] = [];

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      if (tc.type !== 'function') continue;

      const name = tc.function.name;
      if (!isValidToolName(name)) {
        console.warn(`[response-parser] Unknown tool: ${name} — skipping`);
        continue;
      }

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        console.warn(`[response-parser] Failed to parse args for ${name}`);
        continue;
      }

      toolCalls.push({ id: tc.id, name, args });
    }
  }

  return { toolCalls, textContent, finishReason };
}

/** Build the assistant message to append to history after a response. */
export function buildAssistantMessage(
  choice: OpenAI.Chat.ChatCompletionChoice,
): OpenAI.Chat.ChatCompletionMessageParam {
  return choice.message as OpenAI.Chat.ChatCompletionMessageParam;
}

/** Build a tool result message to send back to LLM. */
export function buildToolResultMessage(
  callId:  string,
  content: string,
): OpenAI.Chat.ChatCompletionMessageParam {
  return {
    role:         'tool',
    tool_call_id: callId,
    content,
  } as OpenAI.Chat.ChatCompletionMessageParam;
}
