/**
 * server/agents/coordination/multi-agent-coordinator.ts
 *
 * MultiAgentCoordinator — active parallel agent dispatch.
 *
 * Unlike CoordinationAgent (which gates dependencies), this system actively
 * DISPATCHES N agents simultaneously via CentralWorkerPool and waits for
 * all to complete via a typed barrier.
 *
 * Execution model:
 *   Pre-execution:  [PlannerScan + SecurityScan + ContextScan]  PARALLEL
 *   Execution:      [Builder + Runtime + Verification]          COORDINATED
 *   Post-execution: [Reflection + Scoring + MemoryObserver]     PARALLEL
 *
 * Single responsibility: parallel dispatch + fan-in + aggregation.
 * No mutation, no orchestration logic, no side effects beyond telemetry.
 */

import { bus }             from "../../infrastructure/events/bus.ts";
import { centralWorkerPool } from "../../distributed/workers/central-worker-pool.ts";
import type { CentralTask }  from "../../distributed/workers/central-worker-pool.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentMode = "parallel" | "sequential";

export interface AgentTask<TInput = unknown, TOutput = unknown> {
  agentId:    string;
  agentName:  string;
  priority?:  "critical" | "high" | "normal" | "low";
  timeoutMs?: number;
  fn:         (input: TInput, signal: AbortSignal) => Promise<TOutput>;
  input:      TInput;
}

export interface AgentResult<TOutput = unknown> {
  agentId:    string;
  agentName:  string;
  success:    boolean;
  output?:    TOutput;
  error?:     string;
  durationMs: number;
}

export interface DispatchResult<TOutput = unknown> {
  ok:          boolean;
  results:     AgentResult<TOutput>[];
  succeeded:   AgentResult<TOutput>[];
  failed:      AgentResult<TOutput>[];
  durationMs:  number;
  successRate: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "coordination",
    agentName: "multi-agent-coordinator",
    eventType,
    payload,
    ts:        Date.now(),
  });
}

// ── Parallel dispatch ─────────────────────────────────────────────────────────

async function dispatchParallel<TOutput>(
  tasks:     AgentTask<unknown, TOutput>[],
  runId:     string,
  projectId: number,
  signal:    AbortSignal,
): Promise<AgentResult<TOutput>[]> {
  const workerTasks: Promise<AgentResult<TOutput>>[] = tasks.map(task => {
    const poolTask: CentralTask<TOutput> = {
      taskId:    `${runId}:${task.agentId}`,
      runId,
      priority:  task.priority ?? "normal",
      timeoutMs: task.timeoutMs ?? 30_000,
      fn:        async () => task.fn(task.input, signal),
    };

    const start = Date.now();
    return centralWorkerPool.submit<TOutput>(poolTask).then(result => {
      const durationMs = Date.now() - start;
      if (result.success && result.output !== undefined) {
        emit(runId, projectId, "agent.parallel.completed", { agentId: task.agentId, agentName: task.agentName, durationMs });
        return { agentId: task.agentId, agentName: task.agentName, success: true, output: result.output, durationMs };
      }
      emit(runId, projectId, "agent.parallel.failed", { agentId: task.agentId, agentName: task.agentName, error: result.error, durationMs });
      return { agentId: task.agentId, agentName: task.agentName, success: false, error: result.error ?? "unknown", durationMs };
    }).catch((err: Error) => {
      const durationMs = Date.now() - start;
      emit(runId, projectId, "agent.parallel.failed", { agentId: task.agentId, agentName: task.agentName, error: err.message, durationMs });
      return { agentId: task.agentId, agentName: task.agentName, success: false, error: err.message, durationMs };
    });
  });

  return Promise.all(workerTasks);
}

// ── Sequential dispatch ───────────────────────────────────────────────────────

async function dispatchSequential<TOutput>(
  tasks:     AgentTask<unknown, TOutput>[],
  runId:     string,
  projectId: number,
  signal:    AbortSignal,
): Promise<AgentResult<TOutput>[]> {
  const results: AgentResult<TOutput>[] = [];
  for (const task of tasks) {
    if (signal.aborted) {
      results.push({ agentId: task.agentId, agentName: task.agentName, success: false, error: "aborted", durationMs: 0 });
      continue;
    }
    const start = Date.now();
    try {
      const output = await task.fn(task.input, signal);
      const durationMs = Date.now() - start;
      emit(runId, projectId, "agent.sequential.completed", { agentId: task.agentId, durationMs });
      results.push({ agentId: task.agentId, agentName: task.agentName, success: true, output, durationMs });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      emit(runId, projectId, "agent.sequential.failed", { agentId: task.agentId, error: err.message, durationMs });
      results.push({ agentId: task.agentId, agentName: task.agentName, success: false, error: err.message, durationMs });
    }
  }
  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export class MultiAgentCoordinator {
  /**
   * Dispatch N agent tasks in parallel or sequential mode.
   * Always returns — never throws. Failed tasks are captured in results.
   */
  async dispatch<TOutput = unknown>(
    tasks:     AgentTask<unknown, TOutput>[],
    runId:     string,
    projectId: number,
    opts: {
      mode:        AgentMode;
      timeoutMs?:  number;
      abortOnFail?: boolean;
    } = { mode: "parallel" },
  ): Promise<DispatchResult<TOutput>> {
    const start      = Date.now();
    const controller = new AbortController();
    const signal     = controller.signal;

    if (opts.timeoutMs) {
      setTimeout(() => controller.abort(), opts.timeoutMs);
    }

    emit(runId, projectId, "multi.dispatch.started", {
      mode:      opts.mode,
      agentCount: tasks.length,
      agents:    tasks.map(t => t.agentName),
    });

    const results = opts.mode === "parallel"
      ? await dispatchParallel(tasks, runId, projectId, signal)
      : await dispatchSequential(tasks, runId, projectId, signal);

    const succeeded = results.filter(r => r.success);
    const failed    = results.filter(r => !r.success);
    const durationMs = Date.now() - start;
    const ok = failed.length === 0;

    emit(runId, projectId, ok ? "multi.dispatch.completed" : "multi.dispatch.partial", {
      succeeded: succeeded.length,
      failed:    failed.length,
      durationMs,
    });

    return {
      ok,
      results,
      succeeded,
      failed,
      durationMs,
      successRate: tasks.length > 0 ? succeeded.length / tasks.length : 1,
    };
  }

  /**
   * Wait for a set of named operations to complete.
   * Returns true if all succeeded within timeout.
   */
  async barrier(
    promises:  Promise<boolean>[],
    timeoutMs: number,
  ): Promise<{ ok: boolean; timedOut: boolean }> {
    const timer = new Promise<boolean>(r => setTimeout(() => r(false), timeoutMs));
    const all   = Promise.all(promises).then(results => results.every(Boolean));
    const timedOut = await Promise.race([all.then(() => false), timer.then(() => true)]);
    if (timedOut) return { ok: false, timedOut: true };
    const ok = await all;
    return { ok, timedOut: false };
  }
}

export const multiAgentCoordinator = new MultiAgentCoordinator();
