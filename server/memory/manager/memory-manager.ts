/**
 * memory-manager.ts
 *
 * Unified project-scoped facade for all memory operations.
 *
 * Callers (tool-loop.executor.ts, API routes) interact with ONE object
 * instead of importing individual functions from scattered modules.
 *
 * Responsibilities:
 *   - loadContext()          — build compressed LLM-ready context string
 *   - saveRunSummary()       — persist run outcome to all .nura/ files
 *   - persistConversation()  — save agent conversation turns to DB
 *   - trackTaskOutcome()     — update tasks.md based on run result
 *   - getArchitecture()      — read architecture.md
 *   - setArchitecture()      — overwrite architecture.md
 *   - getDecisions()         — read decisions.json (last N)
 *   - getRecentRuns()        — read run-history.jsonl (last N)
 *   - getFailures()          — read failures.json (last N)
 *
 * Ownership: memory/manager — orchestration facade only.
 * All file I/O delegated to persistence/memory-store.ts.
 * All context building delegated to context/ modules.
 * All conversation I/O delegated to conversation/ modules.
 * All task tracking delegated to task-memory/ modules.
 *
 * Usage:
 *   const mem = MemoryManager.for(projectId);
 *   const ctx = await mem.loadContext();
 *   // ... agent run ...
 *   await mem.saveRunSummary(runId, goal, result);
 *   void mem.persistConversation(runId, goal, result.messages);
 *   void mem.trackTaskOutcome(runId, goal, result);
 */

import { buildProjectContext }   from "../context/project-context-builder.ts";
import { summarizeAndPersist }   from "../context/run-summarizer.ts";
import { persistConversation }   from "../conversation/conversation-persister.ts";
import { appendPendingTask, appendCompletedTask } from "../task-memory/tasks-store.ts";
import {
  readArchitectureMd,
  writeArchitectureMd,
  readDecisions,
  readRecentRuns,
  readFailures,
}                                 from "../persistence/memory-store.ts";
import type { SummarizableResult } from "../context/run-summarizer.ts";
import type { ArchitectureDecision, RunSummary, FailureEntry } from "../types.ts";
import type { ToolMessage }       from "../../llm/openrouter.client.ts";

export class MemoryManager {
  private constructor(private readonly projectId: number) {}

  // ── Factory ─────────────────────────────────────────────────────────────────

  /** Get a MemoryManager for a specific project. Lightweight — no I/O. */
  static for(projectId: number): MemoryManager {
    return new MemoryManager(projectId);
  }

  // ── Context ─────────────────────────────────────────────────────────────────

  /**
   * Build a compressed project context string for LLM injection.
   * Returns null on the very first run (no .nura/ memory exists yet).
   */
  async loadContext(): Promise<string | null> {
    return buildProjectContext(this.projectId);
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  /**
   * Persist a run outcome to all .nura/ files.
   * Always fire-and-forget from the executor: `void mem.saveRunSummary(...)`.
   * Swallows all errors internally — memory writes never crash the agent run.
   */
  async saveRunSummary(
    runId:  string,
    goal:   string,
    result: SummarizableResult,
  ): Promise<void> {
    return summarizeAndPersist(this.projectId, runId, goal, result);
  }

  /**
   * Persist the conversation turns for a run to the DB chat_messages table.
   * Call fire-and-forget after the agent loop completes.
   * Swallows all errors — never crashes the run.
   *
   * @param runId    The run whose conversation is being saved
   * @param goal     Original user goal (written as turn 0)
   * @param messages The ToolMessage[] from the agent loop result
   */
  async persistConversation(
    runId:    string,
    goal:     string,
    messages: ToolMessage[] | undefined,
  ): Promise<void> {
    return persistConversation(this.projectId, runId, goal, messages);
  }

  /**
   * Update tasks.md based on the outcome of a run.
   *   - success → appendCompletedTask
   *   - max_steps → appendPendingTask (needs continuation on next run)
   *   - other failures → not tracked as a pending task (different failure class)
   *
   * Fire-and-forget safe — swallows errors.
   */
  async trackTaskOutcome(
    runId:      string,
    goal:       string,
    result:     SummarizableResult & { steps: number },
  ): Promise<void> {
    try {
      if (result.success) {
        await appendCompletedTask(this.projectId, runId, goal);
      } else if (result.stopReason === "max_steps") {
        await appendPendingTask(this.projectId, runId, goal, result.steps);
      }
      // Other failure types (error, aborted) are captured in failures.json by
      // run-summarizer.ts — no task entry needed.
    } catch (e) {
      console.warn("[memory-manager] trackTaskOutcome failed (non-fatal):", (e as Error).message);
    }
  }

  // ── Architecture ─────────────────────────────────────────────────────────────

  /** Read the current architecture.md narrative. Returns "" if not yet seeded. */
  async getArchitecture(): Promise<string> {
    return readArchitectureMd(this.projectId);
  }

  /**
   * Overwrite architecture.md with new content.
   * Useful for tool-based architecture updates (e.g. after a major refactor).
   */
  async setArchitecture(content: string): Promise<void> {
    return writeArchitectureMd(this.projectId, content);
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async getDecisions(limit = 10): Promise<ArchitectureDecision[]> {
    const all = await readDecisions(this.projectId);
    return all.slice(0, limit);
  }

  async getRecentRuns(limit = 10): Promise<RunSummary[]> {
    return readRecentRuns(this.projectId, limit);
  }

  async getFailures(limit = 10): Promise<FailureEntry[]> {
    const all = await readFailures(this.projectId);
    return all.slice(0, limit);
  }
}
