/**
 * message-extractor.ts
 *
 * Convert the agent's internal ToolMessage[] into DB-ready ChatTurnInsert rows.
 *
 * Rules:
 *   - system messages → skipped (too large, internal)
 *   - tool result messages → skipped (verbose, not user-facing)
 *   - user messages → kept (context injections, questions, goal)
 *   - assistant messages with text → kept; tool_call names attached as metadata
 *
 * The initial user goal is always written as the first turn so the session
 * is self-contained even if the messages array is empty.
 *
 * Ownership: memory/conversation — extraction logic only, no I/O.
 */

import type { ToolMessage } from "../../../llm/openrouter.client.ts";
import type { ChatTurnInsert } from "../persistence/chat-message-store.ts";

interface ToolCallMeta {
  id:   string;
  name: string;
}

// ─── Extractor ────────────────────────────────────────────────────────────────

/**
 * Produce an ordered list of ChatTurnInserts from a ToolMessage array.
 * The goal string is always injected as turn 0 (deduped against messages).
 */
export function extractChatTurns(
  projectId: number,
  runId:     string,
  goal:      string,
  messages:  ToolMessage[],
): ChatTurnInsert[] {
  const turns: ChatTurnInsert[] = [];

  // Turn 0: the user's original goal — always first
  turns.push({ projectId, runId, role: "user", content: goal });

  for (const msg of messages) {
    // Skip internal messages
    if (msg.role === "system" || msg.role === "tool") continue;

    // Skip user messages that are just the memory context blob or the goal itself
    if (msg.role === "user") {
      const c = msg.content?.trim() ?? "";
      if (!c) continue;
      if (c === goal.trim()) continue;                         // exact duplicate
      if (c.startsWith("=== PROJECT MEMORY ===")) continue;   // memory injection
      if (c.startsWith("=== CONTINUATION")) continue;         // continuation blob
      turns.push({ projectId, runId, role: "user", content: c });
      continue;
    }

    // Assistant messages: keep text + attach tool-call metadata
    if (msg.role === "assistant") {
      const content = msg.content?.trim() ?? "";
      const rawCalls = (msg as any).tool_calls as Array<{
        id: string;
        function: { name: string };
      }> | undefined;

      const toolCalls: ToolCallMeta[] | undefined = rawCalls?.length
        ? rawCalls.map((tc) => ({ id: tc.id, name: tc.function?.name ?? "unknown" }))
        : undefined;

      // Must have text OR tool calls to be worth storing
      if (!content && !toolCalls?.length) continue;

      turns.push({
        projectId,
        runId,
        role:      "assistant",
        content:   content || `[${toolCalls!.map((t) => t.name).join(", ")}]`,
        toolCalls: toolCalls ?? undefined,
      });
    }
  }

  return turns;
}
