import type { AssistantMessagePayload, ToolCallRecord } from '../types/message.types.ts';

export function buildAssistantPayload(
  projectId:   number,
  content:     string,
  runId?:      string,
  toolCalls?:  ToolCallRecord[],
  tokensUsed?: number,
): AssistantMessagePayload {
  return { projectId, content, runId, toolCalls, tokensUsed };
}
