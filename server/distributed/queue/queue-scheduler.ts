/**
 * Responsibility: Queue scheduler — polls the task queue and dispatches tasks to the
 *                 worker pool. Implements the consume-execute-retry loop.
 * Dependencies: task-queue, worker-pool, queue-retry-policy, distributed/telemetry/queue-trace
 * Failure: task execution failures trigger retry policy; scheduler never crashes.
 * Telemetry: emits worker.started/completed/failed and distributed.retry via worker-pool.
 */

import { taskQueue }        from "./task-queue.ts";
import { queueRetryPolicy } from "./queue-retry-policy.ts";
import { queueTrace }       from "../telemetry/queue-trace.ts";
import { workerPool }       from "../workers/worker-pool.ts";
import { bus }              from "../../infrastructure/events/bus.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 50;  // how often to check for new tasks

// ── Scheduler ────────────────────────────────────────────────────────────────

class QueueScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  start(): void {
    if (this.timer) return;
    this.running = true;
    this.timer   = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    console.log("[queue-scheduler] Started — poll interval:", POLL_INTERVAL_MS, "ms");
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  stats() {
    return {
      running:    this.running,
      queue:      taskQueue.stats(),
    };
  }

  private tick(): void {
    if (!this.running || taskQueue.isEmpty()) return;
    // Dispatch up to N tasks per tick (avoid starving the event loop)
    const MAX_PER_TICK = 5;
    for (let i = 0; i < MAX_PER_TICK; i++) {
      const task = taskQueue.dequeue();
      if (!task) break;
      this.dispatch(task).catch(err =>
        console.error("[queue-scheduler] Dispatch error:", err),
      );
    }
  }

  private async dispatch(task: ReturnType<typeof taskQueue.dequeue> & {}): Promise<void> {
    const result = await workerPool.submit({
      taskId:    task.id,
      runId:     task.runId,
      projectId: task.projectId,
      type:      task.workerType,
      fn:        task.fn as () => Promise<unknown>,
      timeoutMs: task.timeoutMs,
    });

    if (!result.success) {
      const error   = result.error ?? "unknown";
      const outcome = queueRetryPolicy.evaluate(task, error);

      bus.emit("agent.event", {
        runId:     task.runId,
        projectId: task.projectId,
        phase:     "distributed.queue",
        agentName: "queue-scheduler",
        eventType: "distributed.retry",
        payload:   { taskId: task.id, decision: outcome.decision, attempt: outcome.attempts, delayMs: outcome.delayMs },
        ts:        Date.now(),
      });

      queueTrace.retried(task.id, task.runId, outcome.attempts, outcome.decision);

      if (outcome.decision === "retry") {
        await queueRetryPolicy.applyRetry(task, outcome);
      }
    }
  }
}

export const queueScheduler = new QueueScheduler();
