import type { SystemMessagePayload } from '../types/message.types.ts';

export function buildBaseSystemPayload(
  projectId: number,
  content:   string,
  runId?:    string,
): SystemMessagePayload {
  return { projectId, content, runId };
}

export function buildContextInjectionPayload(
  projectId:  number,
  contextStr: string,
  runId?:     string,
): SystemMessagePayload {
  const content = `[Context]\n${contextStr}`;
  return { projectId, content, runId };
}
