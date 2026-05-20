/**
 * conversation-persister.ts
 *
 * Orchestrates end-of-run conversation persistence to the chat_messages table.
 *
 * Called fire-and-forget from tool-loop.executor.ts after every agent run.
 * Never throws — all errors are swallowed to protect the run lifecycle.
 *
 * Flow:
 *   1. extractChatTurns   — convert ToolMessage[] → ChatTurnInsert[]
 *   2. persistChatTurns   — write rows to DB in order
 *
 * Ownership: memory/conversation — orchestration only.
 */

import { extractChatTurns }  from "./message-extractor.ts";
import { persistChatTurns }  from "../persistence/chat-message-store.ts";
import type { ToolMessage }  from "../../../llm/openrouter.client.ts";

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Persist the full conversation for a completed agent run.
 *
 * @param projectId  Owning project
 * @param runId      The run whose conversation is being saved
 * @param goal       The original user goal (written as turn 0)
 * @param messages   The ToolMessage[] array from the agent loop result
 */
export async function persistConversation(
  projectId: number,
  runId:     string,
  goal:      string,
  messages:  ToolMessage[] | undefined,
): Promise<void> {
  try {
    if (!messages || messages.length === 0) {
      // No messages (e.g. immediate error) — at minimum write the user goal
      await persistChatTurns([{ projectId, runId, role: "user", content: goal }]);
      return;
    }

    const turns = extractChatTurns(projectId, runId, goal, messages);
    await persistChatTurns(turns);
  } catch (e) {
    // Memory writes MUST NOT crash the agent run
    console.warn("[conversation-persister] Failed (non-fatal):", (e as Error).message);
  }
}
