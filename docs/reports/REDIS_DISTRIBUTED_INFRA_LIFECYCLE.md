# Redis Distributed Infrastructure — Lifecycle & Operational Guide

**Project:** Nura-X  
**Date:** 2026-05-25  
**Audience:** DevOps / Backend Engineers

---

## 1. Boot Sequence

```
Node.js process starts
│
├─ ESM static imports evaluated (synchronous)
│   └─ distributed/queue/distributed-queue.ts constructor runs
│      └─ redisOnConnectHooks.register("distributed-queue-reinit", reinit)
│
├─ server/orchestration/index.ts :: initOrchestration() called
│   ├─ initExecutionTelemetry()
│   ├─ initRuntimeSync()
│   ├─ startLifecycleTracking()
│   ├─ previewOrchestrator.init()
│   ├─ recoveryOrchestrator.init()
│   ├─ orchestratorHub.init()
│   ├─ initDagExecutors()
│   └─ [async, non-blocking]:
│       initDistributedSystem()
│       │
│       ├─ Phase 1: Redis probe
│       │   └─ getRedisClient() — IORedis connect attempt (3s timeout)
│       │       ├─ SUCCESS → redisHealth.start() (periodic PING)
│       │       │            ready event fires → redisOnConnectHooks.fire()
│       │       │              → reinit: distributedQueue.reinit() [BullMQ queue created]
│       │       │              → reinit: event-bridge-redis-transport [transport attached]
│       │       └─ FAILURE → logged, continues in degraded mode
│       │
│       └─ Phase 2: Subsystem boot (sequential, awaited)
│           ├─ event-bridge (distributedEventBridge.init())
│           │   └─ tryAttachRedisTransport() if Redis available
│           ├─ file-lock-manager (fileLockManager.init())
│           ├─ worker-pool (workerPool.init({io-bound:5, cpu-bound:2, llm:2}))
│           ├─ central-worker-pool (centralWorkerPool.init())
│           ├─ queue-scheduler (queueScheduler.start() @ 50ms poll)
│           ├─ recovery-manager (distributedRecoveryManager.init())
│           ├─ lock-manager (distributedLockManager.init())
│           │   └─ lockRecovery.start() (stale sweep every 60s)
│           ├─ event-bus (distributedEventBus.start())
│           │   └─ redisPubSub.start() if Redis available
│           ├─ queue-worker (startQueueWorker(processDistributedJob))
│           │   └─ BullMQ Worker started if Redis available
│           └─ queue-events (startQueueEvents())
│               └─ QueueEvents listener if Redis available
│
│       → distributedOrchestrationWiring.wire()
│           ├─ Verify queue stats
│           ├─ Verify worker pool pressure
│           ├─ Verify lock manager health
│           ├─ Verify event bus started
│           ├─ Verify memory queue lanes
│           ├─ Verify telemetry spans
│           └─ Verify validation gates
│
└─ Server fully booted
```

---

## 2. Shutdown Sequence

```
SIGTERM received
│
└─ shutdownDistributedSystem()
    ├─ queueScheduler.stop()           — stop polling task queue
    ├─ workerPool.shutdown()           — drain + terminate workers
    ├─ centralWorkerPool.shutdown()    — drain + terminate central workers
    ├─ fileLockManager.stop()          — stop timeout enforcer
    ├─ distributedRecoveryManager.shutdown() — stop recovery listener
    ├─ distributedLockManager.shutdown()    — stop heartbeat + sweep timers
    ├─ distributedEventBus.stop()           — close pub/sub connections
    └─ redisHealth.stop()                   — stop PING monitor
```

**Note:** BullMQ Worker + QueueEvents are NOT shut down in `shutdownDistributedSystem()`. Add `stopQueueWorker()` and `stopQueueEvents()` to the shutdown sequence when implementing graceful drain.

---

## 3. Redis Reconnection Lifecycle

```
Redis drops
│
├─ IORedis emits "close" → available = false; redisOnConnectHooks.reset()
│   → All isRedisAvailable() checks return false
│   → Subsystems degrade to in-process fallback automatically
│
└─ IORedis starts exponential backoff retries
    attempt 1: 200ms delay
    attempt 2: 450ms delay
    ...
    attempt N: min(delay * 2 * jitter, 30_000ms)
    │
    └─ IORedis emits "ready" on reconnect
        → available = true
        → redisOnConnectHooks.fire()
            ├─ "distributed-queue-reinit": distributedQueue.reinit()
            │   └─ createQueue("nura:tasks") — new BullMQ Queue instance
            └─ "event-bridge-redis-transport": tryAttachRedisTransport()
                └─ redisPubSubTransportAdapter attached to bridge
```

---

## 4. Enabling Redis

Set `REDIS_URL` environment variable before starting the server:

```bash
# Replit Secrets panel:
REDIS_URL = redis://default:password@host:6379

# Or TLS:
REDIS_TLS_URL = rediss://default:password@host:6380

# Or Replit KV:
KV_URL = redis://...
```

The system auto-detects and connects. No code changes required.

**Expected boot log with Redis:**
```
[redis-client] Connected — full distributed mode active.
[redis-on-connect-hooks] Redis ready — firing 2 on-connect hook(s)...
[redis-on-connect-hooks] ✓ distributed-queue-reinit
[redis-on-connect-hooks] ✓ event-bridge-redis-transport
[queue-factory] Queue "nura:tasks" created (BullMQ/Redis).
[distributed-event-bridge] Redis pub/sub transport wired ✓
[distributed-event-bus] Started — backend: Redis
[queue-worker] BullMQ worker started — queue="nura:tasks" concurrency=10
[distributed] ✓ All 10 subsystems ready in Xms
[distributed-wiring] ✓ 7 systems wired (100% readiness) — backend=redis
```

**Expected boot log without Redis:**
```
[redis-client] Initial connect failed — Redis unavailable: Connection is closed.
[distributed] Redis unavailable — running in in-process mode.
[distributed] ✓ All 10 subsystems ready in 9ms
[distributed-wiring] ✓ 7 systems wired (100% readiness) — backend=in-process
```

---

## 5. Registering BullMQ Job Handlers

```typescript
import { registerJobHandler } from "server/distributed/queue/queue-worker-processor.ts";

// Call once during server startup (before jobs arrive)
registerJobHandler("dag-execution", async (payload, data) => {
  const { runId, projectId, nodeId } = payload as DagJobPayload;
  return dagExecutionService.execute(runId, projectId, nodeId);
});

registerJobHandler("code-write", async (payload, data) => {
  const { filePath, content } = payload as CodeWritePayload;
  return fileService.write(filePath, content);
});
```

**Default handler** (catches unregistered types):
```typescript
registerJobHandler("default", async (payload, data) => {
  console.warn(`[processor] Unhandled job type: ${data.workerType}`);
  return { skipped: true };
});
```

---

## 6. Using the Distributed Lock

```typescript
import { distributedLockManager } from "server/distributed/locks/distributed-lock-manager.ts";

// RAII style (recommended)
const result = await distributedLockManager.withLock(
  "nura:lock:run-123:file-write",
  { ownerId: "agent-executor", ttlMs: 30_000, waitMs: 5_000, autoRenewMs: 10_000 },
  async (token) => {
    // exclusive section — lock auto-renewed every 10s
    await writeFile(...);
  },
);

// Manual style
const { acquired, token } = await distributedLockManager.acquire(key, opts);
if (!acquired) throw new Error("Lock contended");
try {
  // critical section
} finally {
  await distributedLockManager.release(key, token!, ownerId);
}
```

---

## 7. Using the Redis Sync Barrier

```typescript
import { redisSyncBarrier } from "server/distributed/sync/redis-sync-barrier.ts";

// Coordinator creates barrier (waits for N workers across all processes)
const barrierPromise = redisSyncBarrier.create(runId, "wave-3", 4, 30_000);

// Workers arrive (can be in different processes)
await redisSyncBarrier.arrive(runId, "wave-3", workerId);

// Coordinator blocks until all 4 workers have arrived
await barrierPromise;

// Always cleanup on abort
process.on("SIGTERM", () => redisSyncBarrier.cleanup(runId, "wave-3"));
```

---

## 8. Observability

### Health Checks

```typescript
// Redis connectivity
import { redisHealth } from "server/distributed/redis/index.ts";
const health = redisHealth.getStatus();
// { connected: boolean, lastPingMs: number, consecutiveFailures: number }

// Lock system
import { distributedLockManager } from "server/distributed/locks/distributed-lock-manager.ts";
const locks = distributedLockManager.health();
// { backend: "redis"|"in-process", activeHeartbeats: number, inProcessLocks: {...}, metrics: {...} }

// Worker pool
import { centralWorkerPool } from "server/distributed/workers/central-worker-pool.ts";
const workers = centralWorkerPool.stats();
// { pressure: number, total: number, busy: number, ... }

// Queue
import { distributedQueue } from "server/distributed/queue/distributed-queue.ts";
const queue = await distributedQueue.stats();
// { waiting: number, active: number, completed: number, failed: number, ... }

// Full distributed telemetry snapshot
import { distributedTelemetry } from "server/distributed/telemetry/distributed-telemetry.ts";
const snapshot = distributedTelemetry.snapshot();
// { correlations, activeSpans, queue, workers, aggregation, retries }
```

### Bus Events

All distributed operations emit `agent.event` on the bus:

| Event | Phase | Emitted By |
|-------|-------|------------|
| `lock.acquired` | `distributed.lock` | lock-acquisition |
| `lock.released` | `distributed.lock` | distributed-lock-manager |
| `lock.contention` | `distributed.lock` | lock-acquisition |
| `queue.enqueued` | `distributed.queue` | queue-telemetry |
| `queue.completed` | `distributed.queue` | queue-telemetry |
| `queue.failed` | `distributed.queue` | queue-telemetry |
| `queue.dead_letter` | `distributed.queue` | queue-worker |
| `worker.started` | `distributed.worker` | worker-lifecycle |
| `worker.completed` | `distributed.worker` | worker-lifecycle |
| `worker.failed` | `distributed.worker` | worker-heartbeat |
| `sync.wait` | `distributed.sync` | redis-sync-barrier |
| `distributed.recovery` | `distributed.sync` | redis-sync-barrier (timeout) |
| `agent.started` | `distributed.gate` | fail-closed-gate |
| `agent.completed` | `distributed.init` | distributed/index.ts |

---

## 9. Failure Modes & Recovery

| Failure | Detection | Response |
|---------|-----------|----------|
| Redis disconnect | `close` event → `available=false` | Subsystems auto-degrade to in-process |
| Redis reconnect | `ready` event → `available=true` | `redisOnConnectHooks.fire()` reinits queue + bridge |
| Lock timeout | `lockHeartbeat` renewal fails → TTL expires | Next acquirer succeeds; `lock.expired` emitted |
| Stale locks | `lockRecovery` sweep every 60s | Expired locks removed from `lockRegistry` |
| Stalled BullMQ job | BullMQ `stalled` event (>30s) | `queue-telemetry.onStalled()` emitted; BullMQ requeues |
| Failed job (exhausted retries) | BullMQ `failed` event | `queue-telemetry.onDeadLetter()` emitted |
| Worker crash | `workerHeartbeat` scan every 5s | `failSlot()` → `worker.failed` bus event → `distributedRecoveryManager` |
| Barrier timeout | `setTimeout` in `redisSyncBarrier.create()` | Rejects with timeout error; `distributed.recovery` emitted |
| Validation gate failure | `distributedValidator.validateExecution()` | `DistributedGateError` thrown; execution blocked |
