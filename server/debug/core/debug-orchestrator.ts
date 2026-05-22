/**
 * server/debug/core/debug-orchestrator.ts
 *
 * Debug Orchestrator — bridges crash events to the Reflection Engine.
 *
 * Single responsibility: receive crash/debug events and delegate to
 * triggerReflection(). Maintains lightweight per-project status for
 * diagnostics. No analysis logic lives here.
 *
 * Wired by: crash-responder.ts via handleCrash()
 * Delegates to: reflection-engine (triggerReflection)
 */

import { triggerReflection }    from "../../engine/reflection/index.ts";
import { extractErrorLines }    from "../../engine/reflection/reflection-analyzer.ts";
import { runtimeManager }       from "../../infrastructure/runtime/runtime-manager.ts";
import type { DebugSession }    from "../types/debug-types.ts";

// ── State ─────────────────────────────────────────────────────────────────────

export interface OrchestratorState {
  projectId:    number;
  status:       "idle" | "running" | "done";
  lastSession?: DebugSession;
  lastError?:   string;
  lastTs?:      number;
}

const _states = new Map<number, OrchestratorState>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Handle a crash event for a project.
 * Gathers log context, triggers the Reflection Engine pipeline, and
 * records the debug session outcome.
 */
export async function handleCrash(event: unknown): Promise<unknown> {
  const e         = event as Record<string, unknown>;
  const projectId = (e?.projectId as number) ?? 0;
  const runId     = (e?.runId as string) ?? `debug-${projectId}-${Date.now()}`;

  _states.set(projectId, { projectId, status: "running", lastTs: Date.now() });

  console.log(`[debug-orchestrator] Crash event — project=${projectId} run=${runId.slice(0, 8)}`);

  try {
    // Gather log context for the reflection engine
    const logTail = runtimeManager.getLogs(projectId, 60);
    const errorLines = extractErrorLines(logTail);
    const errorDetail = (e?.error as string) ?? errorLines[0] ?? "Unknown crash";

    _states.set(projectId, {
      projectId,
      status:    "running",
      lastError: errorDetail,
      lastTs:    Date.now(),
    });

    // Delegate to the Reflection Engine — full pipeline: analyze → classify → decide
    const outcome = await triggerReflection({
      projectId,
      runId,
      trigger:   "crash",
      details: {
        source:     "debug-orchestrator",
        errorDetail,
        exitCode:   e?.exitCode,
        signal:     e?.signal,
      },
    });

    _states.set(projectId, {
      projectId,
      status:  "done",
      lastTs:  Date.now(),
    });

    return {
      ok:        true,
      projectId,
      decision:  outcome.decision.decision,
      skipped:   outcome.skipped,
      elapsedMs: outcome.elapsedMs,
    };

  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[debug-orchestrator] Error handling crash for project ${projectId}:`, msg);

    _states.set(projectId, {
      projectId,
      status:    "idle",
      lastError: msg,
      lastTs:    Date.now(),
    });

    return { ok: false, error: msg, projectId };
  }
}

/**
 * Get current orchestrator state for a project.
 */
export function getOrchestratorState(projectId: number): OrchestratorState {
  return _states.get(projectId) ?? { projectId, status: "idle" };
}

/**
 * Reset orchestrator state for a project (e.g. on clean server start).
 */
export async function resetProject(projectId: number): Promise<{ ok: boolean }> {
  _states.delete(projectId);
  return { ok: true };
}
