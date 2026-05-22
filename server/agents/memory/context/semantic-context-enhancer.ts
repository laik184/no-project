/**
 * semantic-context-enhancer.ts
 *
 * FIXES the critical gap: vector/semantic search was coded but never called.
 *
 * Augments the markdown-based project context (project-context-builder.ts)
 * with semantically retrieved memory entries from the pipeline store.
 *
 * Pipeline:
 *   1. Build base context from file system (.nura/ markdown/JSON)
 *   2. Retrieve semantically relevant memories for the goal
 *   3. Inject validated retrieved memories into the final context string
 *   4. Emit memory.retrieved + memory.injected telemetry
 *
 * Single responsibility: context enhancement only.
 * Delegates retrieval to memory-pipeline, injection to memory-injector.
 */

import { buildProjectContext }  from "./project-context-builder.ts";
import { injectMemoryContext }  from "../../../memory/injection/memory-injector.ts";
import { observe }              from "../../../memory/pipeline/memory-pipeline.ts";
import { memoryTelemetry }      from "../../../memory/telemetry/memory-telemetry.ts";

// ── Config ─────────────────────────────────────────────────────────────────────

const MAX_ENHANCED_CHARS = 6_000;

// ── Public API ─────────────────────────────────────────────────────────────────

export interface EnhancedContextInput {
  projectId: number;
  runId:     string;
  goal:      string;
  phase?:    string;
}

export interface EnhancedContextResult {
  context:       string | null;
  hasFileMemory: boolean;
  hasVectorMemory: boolean;
  retrievedCount: number;
}

/**
 * Build the full project context with semantic memory augmentation.
 *
 * Returns:
 *   - Base markdown context from .nura/ files (episodic/structural)
 *   - + Semantically retrieved relevant memories (ranked by similarity + recency)
 *   - Bounded to MAX_ENHANCED_CHARS to fit in LLM context window
 */
export async function buildEnhancedContext(input: EnhancedContextInput): Promise<EnhancedContextResult> {
  const { projectId, runId, goal, phase = "planning" } = input;

  const [baseContext, injection] = await Promise.allSettled([
    buildProjectContext(projectId),
    injectMemoryContext({ query: goal, projectId, runId, phase }),
  ]);

  const base        = baseContext.status === "fulfilled" ? baseContext.value : null;
  const injResult   = injection.status  === "fulfilled" ? injection.value  : null;

  const hasFileMemory   = !!base;
  const hasVectorMemory = !!injResult?.blockCount && injResult.blockCount > 0;

  if (!hasFileMemory && !hasVectorMemory) {
    return { context: null, hasFileMemory: false, hasVectorMemory: false, retrievedCount: 0 };
  }

  const parts: string[] = [];

  // 1. Base file-system context
  if (base) {
    parts.push(base);
  }

  // 2. Semantic memory augmentation (appended after base)
  if (hasVectorMemory && injResult?.context) {
    parts.push("");
    parts.push("--- Semantically Retrieved Context (from memory pipeline) ---");
    parts.push(injResult.context);
  }

  let combined = parts.join("\n");

  // Enforce total size budget
  if (combined.length > MAX_ENHANCED_CHARS) {
    combined = combined.slice(0, MAX_ENHANCED_CHARS) + "\n[...memory truncated for context budget...]";
  }

  return {
    context:        combined,
    hasFileMemory,
    hasVectorMemory,
    retrievedCount: injResult?.blockCount ?? 0,
  };
}

/**
 * Feed a completed run's memory into the pipeline for future retrieval.
 * Called after successful/failed runs to populate the semantic store.
 */
export async function feedRunToMemoryPipeline(opts: {
  projectId: number;
  runId:     string;
  goal:      string;
  summary:   string;
  success:   boolean;
  error?:    string;
}): Promise<void> {
  const { projectId, runId, goal, summary, success, error } = opts;

  const content = success
    ? `Successful run: "${goal.slice(0, 120)}"\nOutcome: ${summary.slice(0, 400)}`
    : `Failed run: "${goal.slice(0, 120)}"\nFailure: ${(error ?? summary).slice(0, 400)}`;

  try {
    await observe({
      content,
      projectId,
      runId,
      hint: { success },
    });
  } catch (err) {
    memoryTelemetry.failed({
      operation: "feedRunToMemoryPipeline",
      projectId,
      reason:    (err as Error).message,
      runId,
    });
  }
}
