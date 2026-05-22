/**
 * Responsibility: Distributed system bootstrap — initializes all distributed subsystems
 *                 in the correct dependency order on server startup.
 * Dependencies: all distributed subsystems
 * Failure: individual subsystem failures are logged; server continues in degraded mode.
 * Telemetry: emits agent.started on init, agent.completed when all systems are ready.
 */

import { workerPool }                  from "./workers/worker-pool.ts";
import { queueScheduler }              from "./queue/queue-scheduler.ts";
import { fileLockManager }             from "./locks/file-lock-manager.ts";
import { distributedEventBridge }      from "../infrastructure/events/distributed-event-bridge.ts";
import { distributedRecoveryManager }  from "./recovery/distributed-recovery-manager.ts";
import { bus }                         from "../infrastructure/events/bus.ts";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export async function initDistributedSystem(): Promise<void> {
  const t0 = Date.now();
  console.log("[distributed] Initializing distributed execution system...");

  const steps: Array<{ name: string; fn: () => void }> = [
    { name: "event-bridge",       fn: () => distributedEventBridge.init() },
    { name: "file-lock-manager",  fn: () => fileLockManager.init() },
    { name: "worker-pool",        fn: () => workerPool.init({ "io-bound": 5, "cpu-bound": 2, "llm": 2 }) },
    { name: "queue-scheduler",    fn: () => queueScheduler.start() },
    { name: "recovery-manager",   fn: () => distributedRecoveryManager.init() },
  ];

  const initialized: string[] = [];
  const failed:      string[] = [];

  for (const step of steps) {
    try {
      step.fn();
      initialized.push(step.name);
    } catch (err) {
      failed.push(step.name);
      console.error(`[distributed] Failed to initialize ${step.name}:`, err);
    }
  }

  const durationMs = Date.now() - t0;

  bus.emit("agent.event", {
    runId:     "system",
    projectId: 0,
    phase:     "distributed.init",
    agentName: "distributed-system",
    eventType: failed.length === 0 ? "agent.completed" : "agent.failed",
    payload:   { initialized, failed, durationMs },
    ts:        Date.now(),
  });

  if (failed.length > 0) {
    console.warn(`[distributed] ⚠ Initialized with ${failed.length} failures: ${failed.join(", ")}`);
  } else {
    console.log(`[distributed] ✓ All ${initialized.length} subsystems ready in ${durationMs}ms`);
  }
}

export async function shutdownDistributedSystem(): Promise<void> {
  console.log("[distributed] Shutting down...");
  try { queueScheduler.stop();              } catch {}
  try { workerPool.shutdown();              } catch {}
  try { fileLockManager.stop();             } catch {}
  try { distributedRecoveryManager.shutdown("system", 0); } catch {}
  console.log("[distributed] Shutdown complete.");
}

// ── Re-exports for convenience ────────────────────────────────────────────────

export { workerPool }                  from "./workers/worker-pool.ts";
export { taskQueue, TaskPriority }     from "./queue/task-queue.ts";
export { queueScheduler }              from "./queue/queue-scheduler.ts";
export { fileLockManager }             from "./locks/file-lock-manager.ts";
export { distributedLock }             from "./locks/distributed-lock.ts";
export { resultAggregator }            from "./aggregation/result-aggregator.ts";
export { conflictResolver }            from "./conflicts/conflict-resolver.ts";
export { memorySync }                  from "./memory/memory-sync.ts";
export { distributedRecoveryManager }  from "./recovery/distributed-recovery-manager.ts";
export { quantumDAGEngine }            from "../engine/graph/quantum-dag-engine.ts";
export { distributedWaveRunner }       from "../engine/graph/distributed-wave-runner.ts";
export { dynamicNodeInjection }        from "../engine/graph/dynamic-node-injection.ts";
export { distributedNodeSync }         from "../engine/graph/distributed-node-sync.ts";
