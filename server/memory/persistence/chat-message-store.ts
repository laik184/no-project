/**
 * chat-message-store.ts
 *
 * DB read/write for the chat_messages table.
 *
 * Every agent run writes its conversation turns here so the UI can replay
 * them and so future runs can reference them for continuity.
 *
 * Ownership: memory/persistence — DB I/O only, no logic.
 */

import { db }          from "../../infrastructure/db/index.ts";
import { chatMessages } from "../../../shared/schema.ts";
import { eq, asc }     from "drizzle-orm";
import type { ChatMessage } from "../../../shared/schema.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatTurnInsert {
  projectId: number;
  runId:     string;
  role:      "user" | "assistant" | "system";
  content:   string;
  toolCalls?: unknown;
}

// ─── Writers ──────────────────────────────────────────────────────────────────

/**
 * Persist one chat turn (user prompt or assistant reply) to the DB.
 * Swallows errors — never crashes the calling flow.
 */
export async function persistChatTurn(turn: ChatTurnInsert): Promise<void> {
  try {
    await db.insert(chatMessages).values({
      projectId: turn.projectId,
      runId:     turn.runId,
      role:      turn.role,
      content:   turn.content,
      toolCalls: (turn.toolCalls ?? null) as any,
    });
  } catch (e) {
    console.warn("[chat-message-store] persistChatTurn failed (non-fatal):", (e as Error).message);
  }
}

/**
 * Persist multiple turns in insertion order.
 * Sequential to preserve chronological order in the DB.
 */
export async function persistChatTurns(turns: ChatTurnInsert[]): Promise<void> {
  for (const turn of turns) {
    await persistChatTurn(turn);
  }
}

// ─── Readers ──────────────────────────────────────────────────────────────────

/** Load all chat messages for a specific run, ordered oldest → newest. */
export async function loadChatTurns(
  projectId: number,
  runId:     string,
): Promise<ChatMessage[]> {
  try {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.runId, runId))
      .orderBy(asc(chatMessages.createdAt));
  } catch {
    return [];
  }
}
