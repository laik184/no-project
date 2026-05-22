/**
 * server/quantum/scheduler/task-router.ts
 *
 * Routes incoming pool tasks to the correct worker class based on task type.
 * Centralises the mapping between business-level task types and infrastructure
 * worker categories, keeping orchestration code free of routing logic.
 *
 * Worker classes
 * ──────────────
 *   io-bound   — file I/O, network reads, db queries (high concurrency, low CPU)
 *   cpu-bound  — AST analysis, diff computation, compilation (low concurrency)
 *   llm        — LLM API calls (strictly limited by token budget)
 *   agent      — autonomous agent runs (lowest concurrency, highest timeout)
 */

import type { PoolTask, PoolWorkerType } from "./worker-types.ts";
import { TaskPriority } from "./worker-types.ts";

// ── Routing table ─────────────────────────────────────────────────────────────

const TASK_TYPE_MAP: Record<string, PoolWorkerType> = {
  // LLM calls
  "llm-call":          "llm",
  "llm-stream":        "llm",
  "embedding":         "llm",
  "chat-completion":   "llm",

  // Agent execution
  "agent-run":         "agent",
  "tool-loop":         "agent",
  "dag-execution":     "agent",
  "orchestration":     "agent",

  // CPU-bound work
  "ast-analysis":      "cpu-bound",
  "diff-compute":      "cpu-bound",
  "typecheck":         "cpu-bound",
  "lint":              "cpu-bound",
  "test-run":          "cpu-bound",
  "build":             "cpu-bound",
  "security-scan":     "cpu-bound",

  // Default: I/O-bound
  "tool-call":         "io-bound",
  "file-read":         "io-bound",
  "file-write":        "io-bound",
  "file-search":       "io-bound",
  "shell-exec":        "io-bound",
  "network-fetch":     "io-bound",
  "db-query":          "io-bound",
  "dag-node":          "io-bound",
  "preview":           "io-bound",
  "git-op":            "io-bound",
};

const DEFAULT_WORKER_TYPE: PoolWorkerType = "io-bound";

// ── Concurrency limits per worker type ───────────────────────────────────────

export const WORKER_TYPE_LIMITS: Record<PoolWorkerType, number> = {
  "io-bound":  20,
  "cpu-bound":  4,
  "llm":        5,
  "agent":      3,
};

// ── Default timeouts per worker type (ms) ────────────────────────────────────

export const WORKER_TYPE_TIMEOUTS: Record<PoolWorkerType, number> = {
  "io-bound":   30_000,
  "cpu-bound":  60_000,
  "llm":       120_000,
  "agent":     300_000,
};

// ── Router ────────────────────────────────────────────────────────────────────

class TaskRouter {
  /** Map a task to its worker type. */
  route(task: PoolTask): PoolWorkerType {
    return TASK_TYPE_MAP[task.taskType] ?? DEFAULT_WORKER_TYPE;
  }

  /** Get the concurrency limit for a given worker type. */
  limitFor(workerType: PoolWorkerType): number {
    return WORKER_TYPE_LIMITS[workerType];
  }

  /** Get the default timeout for a worker type. */
  timeoutFor(workerType: PoolWorkerType): number {
    return WORKER_TYPE_TIMEOUTS[workerType];
  }

  /** Resolve effective timeout — task-level overrides worker-type default. */
  resolveTimeout(task: PoolTask): number {
    if (task.timeoutMs > 0) return task.timeoutMs;
    return this.timeoutFor(this.route(task));
  }

  /** Higher priority tasks should reduce their timeout to free slots faster. */
  adjustedTimeoutMs(task: PoolTask): number {
    const base = this.resolveTimeout(task);
    if (task.priority === TaskPriority.CRITICAL) return Math.min(base, 60_000);
    return base;
  }
}

export const taskRouter = new TaskRouter();
