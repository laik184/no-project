/**
 * Responsibility: Queue-level distributed recovery — replays failed tasks from the
 *                 dead-letter queue and handles queue drain on graceful shutdown.
 * Dependencies: task-queue, dead-letter-queue, queue-retry-policy, recovery-trace
 * Failure: replay failures re-send task to dead-letter queue; never infinite loops.
 * Telemetry: emits distributed.retry on replay; distributed.recovery on drain.
 */

import { taskQueue, TaskPriority } from "../queue/task-queue.ts";
import { deadLetterQueue }         from "../queue/dead-letter-queue.ts";
import { recoveryTrace }           from "../telemetry/recovery-trace.ts";
import { bus }                     from "../../infrastructure/events/bus.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_REPLAY_BATCH = 10;

// ── Recovery ─────────────────────────────────────────────────────────────────

class QueueRecovery {
  /**
   * Replay up to `maxBatch` tasks from the dead-letter queue.
   * Tasks are re-enqueued at HIGH priority with reset attempt count.
   */
  replayDeadLetter(
    runId:    string,
    projectId: number,
    maxBatch  = MAX_REPLAY_BATCH,
  ): number {
    let replayed = 0;

    for (let i = 0; i < maxBatch; i++) {
      const entry = deadLetterQueue.pop();
      if (!entry) break;

      const task = {
        ...entry.task,
        attempts: 0,                   // reset attempt count for replay
        priority: TaskPriority.HIGH,   // bump priority
      };

      const enqueued = taskQueue.enqueue(task);

      if (enqueued) {
        replayed++;
        recoveryTrace.queueReplay(runId, task.id, task.attempts);

        bus.emit("agent.event", {
          runId, projectId,
          phase:     "distributed.recovery",
          agentName: "queue-recovery",
          eventType: "distributed.retry",
          payload:   { taskId: task.id, attempt: task.attempts, source: "dead_letter_replay" },
          ts:        Date.now(),
        });
      } else {
        // Queue still blocked — put it back
        deadLetterQueue.push(task, "replay_blocked_queue_full");
      }
    }

    return replayed;
  }

  /**
   * Graceful drain: dequeue all remaining tasks and emit drain events.
   * Used on shutdown to ensure no tasks are silently dropped.
   */
  drain(runId: string, projectId: number): number {
    const drained = taskQueue.drain();

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.recovery",
      agentName: "queue-recovery",
      eventType: "distributed.recovery",
      payload:   { drained: drained.length, dlq: deadLetterQueue.size(), reason: "graceful_drain" },
      ts:        Date.now(),
    });

    return drained.length;
  }

  stats() {
    return {
      queue: taskQueue.stats(),
      dlq:   deadLetterQueue.stats(),
    };
  }
}

export const queueRecovery = new QueueRecovery();
