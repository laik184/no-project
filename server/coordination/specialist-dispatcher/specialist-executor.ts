/**
 * specialist-executor.ts
 *
 * Executes a single SpecialistTask by delegating to the real agent loop.
 * Single responsibility: task → LLM execution → SpecialistResult.
 *
 * Execution model:
 *   1. Resolve domain config (system prompt + step budget)
 *   2. Run the real agent loop (runAgentLoop) scoped to this task
 *   3. Collect files written by the loop → FilePatch[]
 *   4. Return a typed SpecialistResult
 *
 * Isolation: each specialist runs in its own AbortController scope.
 * The outer coordination context abort signal is forwarded.
 */

import { runAgentLoop }     from "../../agents/core/tool-loop/tool-loop.agent.ts";
import { getDomainConfig }  from "./domain-agent-router.ts";
import { bus }              from "../../infrastructure/events/bus.ts";
import type { SpecialistTask, SpecialistResult, FilePatch }
  from "../contracts/specialist.contracts.ts";

// ── Telemetry helper ──────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "coordination",
    agentName: "specialist-executor",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Patch extraction ──────────────────────────────────────────────────────────

/**
 * Extract FilePatch records from agent loop result artifacts.
 * The agent loop emits "file_written" events captured in the bus;
 * here we derive patches from the loop's output summary.
 */
function extractPatches(
  summary:  string,
  domain:   SpecialistTask["domain"],
): FilePatch[] {
  // Parse "wrote: <path>" lines from agent summary
  const patches: FilePatch[] = [];
  const lines = summary.split("\n");

  for (const line of lines) {
    // Pattern: "wrote: server/routes.ts" or "created: shared/schema.ts"
    const writeMatch  = line.match(/(?:wrote|updated|modified):\s*([^\s,]+)/i);
    const createMatch = line.match(/(?:created|added):\s*([^\s,]+)/i);
    const deleteMatch = line.match(/(?:deleted|removed):\s*([^\s,]+)/i);

    if (writeMatch?.[1]) {
      patches.push({
        filePath:   writeMatch[1].trim(),
        operation:  "update",
        confidence: 0.85,
      });
    } else if (createMatch?.[1]) {
      patches.push({
        filePath:   createMatch[1].trim(),
        operation:  "create",
        confidence: 0.90,
      });
    } else if (deleteMatch?.[1]) {
      patches.push({
        filePath:   deleteMatch[1].trim(),
        operation:  "delete",
        confidence: 0.80,
      });
    }
  }

  // If no explicit file mentions, emit a domain-scoped synthetic patch
  // so the coordination layer knows work happened even if filenames weren't logged
  if (patches.length === 0 && summary.length > 20) {
    patches.push({
      filePath:   `[${domain}:summary]`,
      operation:  "update",
      content:    summary.slice(0, 500),
      confidence: 0.70,
    });
  }

  return patches;
}

// ── Main executor ─────────────────────────────────────────────────────────────

export async function executeSpecialist(
  task:   SpecialistTask,
  signal: AbortSignal,
): Promise<SpecialistResult> {
  const { runId, projectId, domain, goal, taskId, timeoutMs } = task;
  const t0 = Date.now();

  const config = getDomainConfig(domain);

  emit(runId, projectId, "specialist.execute.start", {
    taskId, domain, maxSteps: config.maxSteps,
  });

  try {
    // Run the real LLM tool-loop with a domain-scoped system prompt.
    // Each specialist runs in complete isolation: separate message history,
    // focused system prompt, and its own step budget.
    const loopResult = await runAgentLoop({
      projectId,
      runId:        `${runId}:${domain}`,
      goal:         `[${domain.toUpperCase()} SPECIALIST] ${goal}`,
      systemPrompt: config.systemPrompt,
      maxSteps:     config.maxSteps,
      signal,
      skipVerification: domain !== "verification",
    });

    const durationMs = Date.now() - t0;
    const patches    = extractPatches(loopResult.summary ?? "", domain);

    emit(runId, projectId, "specialist.execute.complete", {
      taskId, domain, durationMs,
      stopReason: loopResult.stopReason,
      patchCount: patches.length,
      success:    loopResult.success,
    });

    return {
      taskId,
      domain,
      success:    loopResult.success,
      patches,
      artifacts:  {
        summary:    loopResult.summary,
        stopReason: loopResult.stopReason,
        steps:      loopResult.steps,
      },
      durationMs,
      error:     loopResult.error,
      retryable: loopResult.stopReason === "error",
    };

  } catch (err: unknown) {
    const error      = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - t0;

    emit(runId, projectId, "specialist.execute.failed", {
      taskId, domain, error, durationMs,
    });

    return {
      taskId, domain,
      success:    false,
      patches:    [],
      artifacts:  {},
      durationMs,
      error,
      retryable:  true,
    };
  }
}
