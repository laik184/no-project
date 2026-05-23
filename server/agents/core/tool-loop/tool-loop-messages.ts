/**
 * tool-loop-messages.ts
 *
 * Message construction utilities — extracted from tool-loop.agent.ts (Phase 1 split).
 *
 * Single responsibility: build the initial message array for the LLM conversation.
 * No dispatch logic, no verification, no LLM calls.
 */

import type { ToolMessage } from "../../../llm/openrouter.client.ts";

// ── Initial message builder ───────────────────────────────────────────────────

/**
 * Construct the opening message array for an agent run.
 * Injects optional memory context as a primed assistant turn.
 */
export function buildInitialMessages(
  systemPrompt:  string,
  projectId:     number,
  goal:          string,
  memoryContext?: string,
): ToolMessage[] {
  const msgs: ToolMessage[] = [{ role: "system", content: systemPrompt }];

  if (memoryContext) {
    msgs.push({ role: "user",      content: memoryContext });
    msgs.push({ role: "assistant", content: "I've reviewed the project memory. I'll build on existing work." });
  }

  msgs.push({ role: "user", content: `Project ID: ${projectId}\nGoal:\n${goal}` });
  return msgs;
}

// ── Event helper ──────────────────────────────────────────────────────────────

/**
 * Typed bus emission helper — keeps agent code free of raw bus.emit calls.
 */
export function buildAgentEvent(
  runId:     string,
  eventType: string,
  phase:     string,
  payload:   unknown,
) {
  return { runId, eventType: eventType as any, phase, ts: Date.now(), payload };
}
