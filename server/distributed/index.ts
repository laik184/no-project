/**
 * Responsibility: Distributed system bootstrap — initializes all distributed subsystems
 *                 in the correct dependency order on server startup.
 * Dependencies: all distributed subsystems
 * Failure: individual subsystem failures are logged; server continues in degraded mode.
 * Telemetry: emits agent.started on init, agent.completed when all systems are ready.
 */

import { workerPool }                  from "./workers/worker-pool.ts";
import { centralWorkerPool }           from "./workers/central-worker-pool.ts";
import { queueScheduler }              from "./queue/queue-scheduler.ts";
import { fileLockManager }             from "./locks/file-lock-manager.ts";
import { distributedEventBridge }      from "../infrastructure/events/distributed-event-bridge.ts";
import { distributedRecoveryManager }  from "./recovery/distributed-recovery-manager.ts";
import { distributedLockManager }      from "./locks/distributed-lock-manager.ts";
import { distributedEventBus }         from "./events/distributed-event-bus.ts";
import { getRedisClient, redisHealth, redisTelemetry } from "./redis/index.ts";
import { redisOnConnectHooks }         from "./redis/redis-on-connect-hooks.ts";
import { redisStartupValidator }       from "./redis/redis-startup-validator.ts";
import { redisWorkerRegistry }         from "./workers/redis-worker-registry.ts";
import { startQueueWorker }            from "./queue/queue-worker.ts";
import { startQueueEvents }            from "./queue/queue-events.ts";
import { processDistributedJob }       from "./queue/queue-worker-processor.ts";
import { bus }                         from "../infrastructure/events/bus.ts";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export async function initDistributedSystem(): Promise<void> {
  const t0 = Date.now();
  console.log("[distributed] Initializing distributed execution system...");

  // Phase 1: Validate Redis environment + attempt connection
  const startupReport = await redisStartupValidator.validate();
  const redisClient   = startupReport.status === "connected"
    ? await getRedisClient().catch(() => null)
    : null;

  if (redisClient) {
    redisHealth.start();
    redisWorkerRegistry.start();
    redisTelemetry.stopDegradedMonitor();
    console.log("[distributed] Redis connected — full distributed mode active.");
  } else {
    redisTelemetry.startDegradedMonitor();
    console.warn("[distributed] Redis unavailable — running in in-process mode.");
  }

  // Register on-connect hooks so Redis-dependent subsystems activate automatically
  // if Redis becomes available after initial startup (late REDIS_URL, reconnect, etc.)
  redisOnConnectHooks.register("distributed-event-bus-pubsub", () => distributedEventBus.start());
  redisOnConnectHooks.register("distributed-queue-worker",     () => startQueueWorker(processDistributedJob));
  redisOnConnectHooks.register("distributed-queue-events",     () => startQueueEvents());
  redisOnConnectHooks.register("redis-health-monitor",         () => redisHealth.start());

  const steps: Array<{ name: string; fn: () => void | Promise<void> }> = [
    { name: "event-bridge",        fn: () => distributedEventBridge.init() },
    { name: "file-lock-manager",   fn: () => fileLockManager.init() },
    // Pre-allocate slots at full capacity; worker-pool enforces per-type limits internally
    { name: "worker-pool",         fn: () => workerPool.init({ "io-bound": 20, "cpu-bound": 4, "llm": 5 }) },
    { name: "central-worker-pool", fn: () => centralWorkerPool.init() },
    { name: "queue-scheduler",     fn: () => queueScheduler.start() },
    { name: "recovery-manager",    fn: () => distributedRecoveryManager.init() },
    { name: "lock-manager",        fn: () => distributedLockManager.init() },
    { name: "event-bus",           fn: () => distributedEventBus.start() },
    // Real processor — routes BullMQ jobs to CentralWorkerPool (replaces no-op passthrough)
    { name: "queue-worker",        fn: () => startQueueWorker(processDistributedJob) },
    { name: "queue-events",        fn: () => startQueueEvents() },
  ];

  const initialized: string[] = [];
  const failed:      string[] = [];

  for (const step of steps) {
    try {
      await Promise.resolve(step.fn()); // await async steps; sync steps resolve immediately
      initialized.push(step.name);
    } catch (err) {
      failed.push(step.name);
      console.error(`[distributed] Failed to initialize ${step.name}:`, (err as Error).message);
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
  try { centralWorkerPool.shutdown();       } catch {}
  try { fileLockManager.stop();             } catch {}
  try { redisWorkerRegistry.stop();         } catch {}
  try { distributedRecoveryManager.shutdown("system", 0); } catch {}
  try { await distributedLockManager.shutdown(); } catch {}
  try { await distributedEventBus.stop();   } catch {}
  try { redisHealth.stop();                 } catch {}
  try { redisTelemetry.stopDegradedMonitor(); } catch {}
  console.log("[distributed] Shutdown complete.");
}

// ── Re-exports for convenience ────────────────────────────────────────────────

// Legacy in-process layer (preserved for backward compat)
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

// New distributed layer (Redis-backed where available)
export { centralWorkerPool }           from "./workers/central-worker-pool.ts";
export { distributedQueue }            from "./queue/distributed-queue.ts";
export { distributedLockManager }      from "./locks/distributed-lock-manager.ts";
export { distributedEventBus }         from "./events/distributed-event-bus.ts";
export { distributedMemoryQueue }      from "./memory/distributed-memory-queue.ts";
export { distributedTelemetry }        from "./telemetry/distributed-telemetry.ts";
export { distributedValidator }        from "./validation/distributed-validator.ts";
export { failClosedGate }              from "./validation/fail-closed-gate.ts";
export { getRedisClient, isRedisAvailable, redisTelemetry } from "./redis/index.ts";
export { redisStartupValidator }       from "./redis/redis-startup-validator.ts";
export { redisWorkerRegistry }         from "./workers/redis-worker-registry.ts";
export { redisReplayStore }            from "../infrastructure/replay/redis-replay-store.ts";
