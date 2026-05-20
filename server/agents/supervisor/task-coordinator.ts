/**
 * task-coordinator.ts
 *
 * Manages task lifecycle across multiple agents:
 * assign → track → collect results → coordinate handoffs.
 */

import { randomUUID }     from "crypto";
import type {
  AgentRole, AgentResult, TaskAssignment, ContextPartition,
} from "./supervisor-types.ts";
import { partitionContext } from "./context-partitioner.ts";

// ── Task registry ─────────────────────────────────────────────────────────────

export interface TrackedTask {
  assignment: TaskAssignment;
  status:     "pending" | "running" | "complete" | "failed" | "timeout";
  result?:    AgentResult;
  startedAt:  number;
  completedAt?:number;
  timeoutAt:  number;
}

const _tasks = new Map<string, TrackedTask>();

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAssignment(
  goal:      string,
  role:      AgentRole,
  projectId: number,
  runId:     string,
  context:   ContextPartition,
  options?: { maxSteps?: number; timeoutMs?: number },
): TaskAssignment {
  return {
    taskId:    randomUUID(),
    goal,
    role,
    context,
    maxSteps:  options?.maxSteps  ?? 25,
    timeoutMs: options?.timeoutMs ?? 300_000,
    runId,
    projectId,
  };
}

export function registerTask(assignment: TaskAssignment): TrackedTask {
  const task: TrackedTask = {
    assignment,
    status:    "pending",
    startedAt: Date.now(),
    timeoutAt: Date.now() + assignment.timeoutMs,
  };
  _tasks.set(assignment.taskId, task);
  return task;
}

export function startTask(taskId: string): void {
  const t = _tasks.get(taskId);
  if (t) t.status = "running";
}

export function completeTask(taskId: string, result: AgentResult): void {
  const t = _tasks.get(taskId);
  if (!t) return;
  t.status      = result.success ? "complete" : "failed";
  t.result      = result;
  t.completedAt = Date.now();
}

export function getTask(taskId: string): TrackedTask | undefined {
  return _tasks.get(taskId);
}

export function getRunTasks(runId: string): TrackedTask[] {
  return [..._tasks.values()].filter(t => t.assignment.runId === runId);
}

export function clearRunTasks(runId: string): void {
  for (const [id, t] of _tasks) {
    if (t.assignment.runId === runId) _tasks.delete(id);
  }
}

// ── Timeout enforcer ──────────────────────────────────────────────────────────

export function checkTimeouts(): string[] {
  const expired: string[] = [];
  const now = Date.now();
  for (const [id, t] of _tasks) {
    if (t.status === "running" && now > t.timeoutAt) {
      t.status = "timeout";
      expired.push(id);
      console.warn(`[task-coordinator] Task timeout: ${id} (${t.assignment.role})`);
    }
  }
  return expired;
}

// ── Handoff ───────────────────────────────────────────────────────────────────

export interface HandoffSpec {
  fromRole:   AgentRole;
  toRole:     AgentRole;
  reason:     string;
  carryover:  string;    // summary to inject into next agent's context
}

export function buildHandoff(
  prev:     AgentResult,
  nextRole: AgentRole,
  reason:   string,
): HandoffSpec {
  const carryover = [
    `Previous agent (${prev.role}) completed with ${prev.success ? "SUCCESS" : "FAILURE"}.`,
    `Evidence: ${prev.evidence.slice(0, 3).join("; ")}`,
    `Confidence: ${(prev.confidence * 100).toFixed(0)}%`,
    `Output summary: ${prev.output.slice(0, 300)}`,
  ].join("\n");

  return { fromRole: prev.role, toRole: nextRole, reason, carryover };
}

// ── Run summary ───────────────────────────────────────────────────────────────

export function summarizeRun(runId: string): {
  totalTasks:  number;
  completed:   number;
  failed:      number;
  avgConfidence: number;
} {
  const tasks = getRunTasks(runId);
  const done  = tasks.filter(t => t.status === "complete");
  const failed = tasks.filter(t => t.status === "failed" || t.status === "timeout");
  const avgConf = done.length === 0 ? 0
    : done.reduce((s, t) => s + (t.result?.confidence ?? 0), 0) / done.length;

  return {
    totalTasks:    tasks.length,
    completed:     done.length,
    failed:        failed.length,
    avgConfidence: avgConf,
  };
}
