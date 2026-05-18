/**
 * server/memory/index.ts
 *
 * Public API for the execution memory layer.
 *
 * Preferred usage: MemoryManager.for(projectId)
 *
 * The function exports (buildProjectContext, summarizeAndPersist) are kept
 * for backwards-compatibility. New consumers should use MemoryManager.
 */

// ── Primary API ───────────────────────────────────────────────────────────────

export { MemoryManager }               from "./manager/memory-manager.ts";

// ── Function API (backwards-compatible) ──────────────────────────────────────

export { buildProjectContext }         from "./context/project-context-builder.ts";
export { summarizeAndPersist }         from "./context/run-summarizer.ts";

// ── Conversation persistence ──────────────────────────────────────────────────

export { persistConversation }         from "./conversation/conversation-persister.ts";
export { extractChatTurns }            from "./conversation/message-extractor.ts";
export { persistChatTurn, persistChatTurns, loadChatTurns } from "./persistence/chat-message-store.ts";

// ── Task memory ───────────────────────────────────────────────────────────────

export { readTasksMd, appendPendingTask, appendCompletedTask } from "./task-memory/tasks-store.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type { SummarizableResult }     from "./context/run-summarizer.ts";
export type { ChatTurnInsert }         from "./persistence/chat-message-store.ts";
export type {
  RunSummary,
  FailureEntry,
  ArchitectureDecision,
  ProjectMemory,
}                                      from "./types.ts";
