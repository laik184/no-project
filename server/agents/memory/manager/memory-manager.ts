/**
 * memory-manager.ts
 *
 * Unified project-scoped facade for all memory operations.
 * UPDATED: Now integrates semantic pipeline for enhanced context retrieval.
 *
 * Callers (tool-loop.executor.ts, memory-tools.ts, API routes) interact with
 * ONE object instead of importing individual functions from scattered modules.
 *
 * ── Run lifecycle methods (called by executor) ────────────────────────────────
 *   loadContext()            — build compressed LLM-ready context string (now semantically enhanced)
 *   saveRunSummary()         — persist run outcome + feed memory pipeline
 *   persistConversation()    — save conversation turns to DB chat_messages
 *   trackTaskOutcome()       — update tasks.md based on run result
 *
 * ── Mid-run write methods (called by memory_update tool) ─────────────────────
 *   appendDecisionMd()       — append to decisions.md
 *   appendProgressMd()       — append to progress.md
 *   appendFailedAttemptMd()  — append to failed-attempts.md
 *
 * ── Read methods (called by memory_read tool + API routes) ───────────────────
 *   getArchitecture()        — read architecture.md
 *   getProgressMd()          — read progress.md
 *   getDecisionsMd()         — read decisions.md
 *   getFailedAttemptsMd()    — read failed-attempts.md
 *   getTasksMd()             — read tasks.md
 *   setArchitecture()        — overwrite architecture.md
 *   getDecisions()           — read decisions.json (last N)
 *   getRecentRuns()          — read run-history.jsonl (last N)
 *   getFailures()            — read failures.json (last N)
 *
 * Ownership: memory/manager — orchestration facade only.
 */

import { buildProjectContext }   from "../context/project-context-builder.ts";
import { buildEnhancedContext, feedRunToMemoryPipeline } from "../context/semantic-context-enhancer.ts";
import { summarizeAndPersist }   from "../context/run-summarizer.ts";
import { persistConversation }   from "../conversation/conversation-persister.ts";
import { appendPendingTask, appendCompletedTask, readTasksMd } from "../task-memory/tasks-store.ts";
import {
  readArchitectureMd,
  writeArchitectureMd,
  readDecisions,
  readRecentRuns,
  readFailures,
  readProgressMd,
  appendProgressMd   as storeAppendProgressMd,
  readDecisionsMd,
  appendDecisionMd   as storeAppendDecisionMd,
  readFailedAttemptsMd,
  appendFailedAttemptMd as storeAppendFailedAttemptMd,
}                                 from "../persistence/memory-store.ts";
import { memoryTelemetry }        from "../../../memory/telemetry/memory-telemetry.ts";
import type { SummarizableResult } from "../context/run-summarizer.ts";
import type { ArchitectureDecision, RunSummary, FailureEntry } from "../types.ts";
import type { ToolMessage }       from "../../../llm/openrouter.client.ts";

export class MemoryManager {
  private constructor(private readonly projectId: number) {}

  static for(projectId: number): MemoryManager {
    return new MemoryManager(projectId);
  }

  // ── Context loading ───────────────────────────────────────────────────────────

  /**
   * Load context for injection into an agent prompt.
   * FIXED: Now uses semantic pipeline augmentation (vector search) in addition
   * to the file-based context. Falls back to file-only on any error.
   */
  async loadContext(opts?: { runId?: string; goal?: string }): Promise<string | null> {
    const { runId, goal } = opts ?? {};

    // If we have a goal + runId, use the enhanced context (semantic + file)
    if (goal && runId) {
      try {
        const enhanced = await buildEnhancedContext({
          projectId: this.projectId,
          runId,
          goal,
          phase: "planning",
        });

        if (enhanced.hasVectorMemory) {
          memoryTelemetry.retrieved({
            runId,
            projectId: this.projectId,
            query:       goal.slice(0, 100),
            resultCount: enhanced.retrievedCount,
            topScore:    0,
            strategy:    "semantic",
          });
        }

        return enhanced.context;
      } catch {
        // Fallback to file-only context on any failure
      }
    }

    return buildProjectContext(this.projectId);
  }

  // ── Run lifecycle (called from executor, fire-and-forget safe) ───────────────

  async saveRunSummary(runId: string, goal: string, result: SummarizableResult): Promise<void> {
    // 1. Persist to .nura/ files (original behavior)
    await summarizeAndPersist(this.projectId, runId, goal, result);

    // 2. Feed into the semantic memory pipeline for future retrieval
    feedRunToMemoryPipeline({
      projectId: this.projectId,
      runId,
      goal,
      summary:   result.summary,
      success:   result.success,
      error:     result.error,
    }).catch(() => {}); // Non-fatal, fire-and-forget
  }

  async persistConversation(runId: string, goal: string, messages: ToolMessage[] | undefined): Promise<void> {
    return persistConversation(this.projectId, runId, goal, messages);
  }

  async trackTaskOutcome(
    runId: string,
    goal:  string,
    result: SummarizableResult & { steps: number },
  ): Promise<void> {
    try {
      if (result.success) {
        await appendCompletedTask(this.projectId, runId, goal);
      } else if (result.stopReason === "max_steps") {
        await appendPendingTask(this.projectId, runId, goal, result.steps);
      }
    } catch (e) {
      console.warn("[memory-manager] trackTaskOutcome failed (non-fatal):", (e as Error).message);
    }
  }

  // ── Mid-run writes (called by memory_update tool) ────────────────────────────

  async appendDecisionMd(content: string): Promise<void> {
    return storeAppendDecisionMd(this.projectId, content);
  }

  async appendProgressMd(content: string): Promise<void> {
    return storeAppendProgressMd(this.projectId, content);
  }

  async appendFailedAttemptMd(content: string): Promise<void> {
    return storeAppendFailedAttemptMd(this.projectId, content);
  }

  // ── Architecture ─────────────────────────────────────────────────────────────

  async getArchitecture(): Promise<string> {
    return readArchitectureMd(this.projectId);
  }

  async setArchitecture(content: string): Promise<void> {
    return writeArchitectureMd(this.projectId, content);
  }

  // ── Human-readable .md reads (C9 files) ──────────────────────────────────────

  async getProgressMd(): Promise<string> {
    return readProgressMd(this.projectId);
  }

  async getDecisionsMd(): Promise<string> {
    return readDecisionsMd(this.projectId);
  }

  async getFailedAttemptsMd(): Promise<string> {
    return readFailedAttemptsMd(this.projectId);
  }

  async getTasksMd(): Promise<string> {
    return readTasksMd(this.projectId);
  }

  // ── Structured JSON reads ────────────────────────────────────────────────────

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
