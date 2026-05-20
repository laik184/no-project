/**
 * execution-coordinator.ts
 *
 * Coordinates parallel and sequential agent execution within a run.
 * Enforces dependency ordering, concurrency limits, and timeout guards.
 */

import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import type { AgentCoordinationResult, BridgeResult } from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentTask = {
  name:       string;
  role:       string;
  runId:      string;
  projectId:  number;
  execute:    () => Promise<unknown>;
  timeoutMs?: number;
  critical?:  boolean;
  dependsOn?: string[];
};

export interface CoordinationPlan {
  tasks:         AgentTask[];
  maxConcurrent: number;
  failFast:      boolean;
  timeoutMs:     number;
}

export interface CoordinationResult {
  results:    AgentCoordinationResult[];
  allPassed:  boolean;
  failedCount: number;
  durationMs: number;
}

// ── Default limits ─────────────────────────────────────────────────────────────

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS  = 60_000;
const DEFAULT_PLAN_TIMEOUT = 300_000;

// ── Main coordinator ──────────────────────────────────────────────────────────

export async function coordinateAgents(plan: CoordinationPlan): Promise<CoordinationResult> {
  const { tasks, maxConcurrent, failFast, timeoutMs } = plan;
  const t0 = Date.now();
  const results: AgentCoordinationResult[] = [];
  const completed = new Set<string>();
  const failed    = new Set<string>();

  // Build dependency-ordered waves
  const waves = buildExecutionWaves(tasks);

  for (const wave of waves) {
    // Check if any dependency in this wave has failed with failFast
    if (failFast && wave.some(t => t.dependsOn?.some(d => failed.has(d)))) {
      wave.forEach(t => {
        results.push({
          agentName:  t.name,
          role:       t.role,
          outcome:    "skipped",
          confidence: 0,
          durationMs: 0,
        });
      });
      continue;
    }

    // Execute wave with concurrency limit
    const batchResults = await executeBatch(wave, Math.min(maxConcurrent, DEFAULT_CONCURRENCY));

    for (const r of batchResults) {
      results.push(r);
      if (r.outcome === "success") {
        completed.add(r.agentName);
      } else if (r.outcome === "failure") {
        failed.add(r.agentName);
        if (failFast && wave.find(t => t.name === r.agentName)?.critical) {
          break;
        }
      }
    }
  }

  const durationMs = Date.now() - t0;
  return {
    results,
    allPassed:   failed.size === 0,
    failedCount: failed.size,
    durationMs,
  };
}

// ── Single agent execution with telemetry ─────────────────────────────────────

export async function executeAgentTask(task: AgentTask): Promise<AgentCoordinationResult> {
  const spanId = recordSpanStart(task.runId, `agent.${task.name}`, {
    role:      task.role,
    projectId: String(task.projectId),
  });

  const t0      = Date.now();
  const timeout = task.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const result = await withTimeout(task.execute(), timeout, task.name);

    const r: AgentCoordinationResult = {
      agentName:  task.name,
      role:       task.role,
      outcome:    "success",
      output:     result,
      confidence: 1.0,
      durationMs: Date.now() - t0,
    };

    emitAgentCoordination({
      runId:     task.runId,
      projectId: task.projectId,
      agentName: task.name,
      role:      task.role,
      outcome:   "success",
      phase:     "execute",
    });

    recordSpanEnd(spanId, "ok");
    return r;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const r: AgentCoordinationResult = {
      agentName:  task.name,
      role:       task.role,
      outcome:    "failure",
      confidence: 0,
      durationMs: Date.now() - t0,
    };

    emitAgentCoordination({
      runId:     task.runId,
      projectId: task.projectId,
      agentName: task.name,
      role:      task.role,
      outcome:   "failure",
      phase:     "execute",
    });

    recordSpanEnd(spanId, "error");
    console.error(`[execution-coordinator] Agent ${task.name} failed: ${msg}`);
    return r;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildExecutionWaves(tasks: AgentTask[]): AgentTask[][] {
  const waves: AgentTask[][] = [];
  const remaining = [...tasks];
  const done = new Set<string>();

  while (remaining.length > 0) {
    const wave = remaining.filter(t =>
      !t.dependsOn || t.dependsOn.every(d => done.has(d))
    );

    if (wave.length === 0) {
      // Deadlock — add all remaining
      waves.push([...remaining]);
      break;
    }

    waves.push(wave);
    wave.forEach(t => {
      done.add(t.name);
      remaining.splice(remaining.indexOf(t), 1);
    });
  }

  return waves;
}

async function executeBatch(
  tasks:      AgentTask[],
  concurrent: number,
): Promise<AgentCoordinationResult[]> {
  const results: AgentCoordinationResult[] = [];
  for (let i = 0; i < tasks.length; i += concurrent) {
    const batch  = tasks.slice(i, i + concurrent);
    const batch_results = await Promise.all(batch.map(executeAgentTask));
    results.push(...batch_results);
  }
  return results;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[execution-coordinator] ${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}
