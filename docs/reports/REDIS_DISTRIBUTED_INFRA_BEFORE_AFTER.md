# Redis Distributed Infrastructure — Before / After Change Log

**Project:** Nura-X  
**Date:** 2026-05-25  
**Files Changed:** 10 files (4 new, 6 modified)

---

## New Files Created

### 1. `server/distributed/redis/redis-on-connect-hooks.ts` *(NEW)*

**Before:** No hook system existed. Redis reconnection had no effect on dependent subsystems.

**After:** Registry of named callbacks fired on the `ready` event via IORedis client. Supports late registration (immediate invocation if Redis already connected). Used by `DistributedQueue` and `DistributedEventBridge` to reinitialize when Redis comes online.

```
// Before: Nothing happened when Redis connected
client.on("ready", () => { available = true; redisTelemetry.onReady(); });

// After: All registered hooks fire when Redis is ready
client.on("ready", () => { available = true; redisTelemetry.onReady(); redisOnConnectHooks.fire().catch(console.error); });
```

---

### 2. `server/distributed/queue/queue-worker-processor.ts` *(NEW)*

**Before:** BullMQ worker started with `async (data) => data` — a no-op passthrough.

**After:** Typed handler registry (`registerJobHandler(workerType, fn)`) + `processDistributedJob()` that routes BullMQ jobs to `CentralWorkerPool` for governed, backpressure-aware, telemetried execution. Throws on failure (triggers BullMQ retry); returns skip result on unregistered type (avoids infinite retry loops).

---

### 3. `server/distributed/sync/redis-sync-barrier.ts` *(NEW)*

**Before:** No cross-process sync barrier. `DistributedSyncBarrier` was in-process only — could not coordinate workers across multiple Node.js processes.

**After:** Redis-backed barrier using `INCR` (atomic multi-process arrival counting) + `EXPIRE` (5-minute TTL safety cap) + polling loop. Delegates to in-process barrier when Redis unavailable. `cleanup()` method for run abort.

---

### 4. `server/infrastructure/events/redis-transport-adapter.ts` *(NEW)*

**Before:** `DistributedEventBridge.transport` was always `null`. No adapter existed connecting `RedisPubSub` to the `ExternalTransport` interface.

**After:** Thin adapter implementing `ExternalTransport` using `redisPubSub.publish()` and `redisPubSub.subscribe()`. Handles JSON serialization/deserialization between the bridge's string-based transport protocol and `DistributedEvent` objects.

---

## Modified Files

### 5. `server/distributed/redis/redis-client.ts`

**Change 1 — Fire on-connect hooks on `ready`:**
```typescript
// Before
client.on("ready", () => { available = true; redisTelemetry.onReady(); });
client.on("close", () => { available = false; redisTelemetry.onClose(); });
client.on("end",   () => { available = false; redisTelemetry.onDisconnected(); });

// After
client.on("ready", () => { available = true; redisTelemetry.onReady(); redisOnConnectHooks.fire().catch(console.error); });
client.on("close", () => { available = false; redisTelemetry.onClose(); redisOnConnectHooks.reset(); });
client.on("end",   () => { available = false; redisTelemetry.onDisconnected(); redisOnConnectHooks.reset(); });
```

**Change 2 — Add `keyPrefix` to dedicated client:**
```typescript
// Before
export function createDedicatedClient(): Redis {
  return new Redis({ host, port, password, db, maxRetriesPerRequest: null, enableOfflineQueue: false });
}

// After
export function createDedicatedClient(): Redis {
  return new Redis({ host, port, password, db, keyPrefix: cfg.keyPrefix, maxRetriesPerRequest: null, enableOfflineQueue: false });
}
```

---

### 6. `server/distributed/queue/distributed-queue.ts`

**Change — Register reinit hook + lazy constructor comment:**
```typescript
// Before: bq initialized at module load time (always null — Redis not yet connected)
class DistributedQueue {
  private bq = createQueue(QUEUE_NAME);
  ...
  reinit(): void { this.bq = createQueue(QUEUE_NAME); }
}

// After: bq initialized at module load (null if Redis absent), reinit wired to ready event
class DistributedQueue {
  private bq = createQueue(QUEUE_NAME); // null if Redis not yet available
  constructor() {
    redisOnConnectHooks.register("distributed-queue-reinit", () => this.reinit());
  }
  reinit(): void {
    this.bq = createQueue(QUEUE_NAME);
    if (this.bq) console.log("[distributed-queue] BullMQ queue reinitialized after Redis connect.");
  }
}
```

---

### 7. `server/distributed/index.ts`

**Change 1 — Import real processor:**
```typescript
// Before
// (no import — processor was inline no-op)

// After
import { processDistributedJob } from "./queue/queue-worker-processor.ts";
```

**Change 2 — Await async steps:**
```typescript
// Before
for (const step of steps) {
  try {
    step.fn();       // fire-and-forget — async failures silently ignored
    initialized.push(step.name);
  } catch (err) { ... }
}

// After
for (const step of steps) {
  try {
    await Promise.resolve(step.fn()); // awaits async; resolves sync immediately
    initialized.push(step.name);
  } catch (err) { ... }
}
```

**Change 3 — Wire real processor:**
```typescript
// Before
{ name: "queue-worker", fn: () => startQueueWorker(async (data) => data) },

// After
{ name: "queue-worker", fn: () => startQueueWorker(processDistributedJob) },
```

---

### 8. `server/orchestration/index.ts`

**Change — Boot distributed system before wiring:**
```typescript
// Before: only wiring called; initDistributedSystem() never invoked
distributedOrchestrationWiring.wire().then(report => { ... }).catch(...);

// After: correct boot order — init subsystems THEN wire them
initDistributedSystem()
  .then(() => distributedOrchestrationWiring.wire())
  .then(report => { ... })
  .catch(err => { ... });
```

**Import added:**
```typescript
import { initDistributedSystem } from "../distributed/index.ts";
```

---

### 9. `server/infrastructure/events/distributed-event-bridge.ts`

**Change — Auto-attach Redis transport on init:**
```typescript
// Before: init() only wired the router; transport permanently null
init(): void {
  distributedEventRouter.init();
  bus.on("agent.event", ...);
  console.log("[distributed-event-bridge] Initialized — local delivery active.");
}

// After: init() also wires Redis transport when available + registers reconnect hook
init(): void {
  distributedEventRouter.init();
  this.tryAttachRedisTransport();  // attach now if Redis ready
  redisOnConnectHooks.register("event-bridge-redis-transport", () => this.tryAttachRedisTransport());
  bus.on("agent.event", ...);
  console.log("[distributed-event-bridge] Initialized — local delivery active.");
}

private tryAttachRedisTransport(): void {
  if (this.transport || !isRedisAvailable()) return;
  import("./redis-transport-adapter.ts").then(({ redisPubSubTransportAdapter }) => {
    this.attachTransport(redisPubSubTransportAdapter);
    console.log("[distributed-event-bridge] Redis pub/sub transport wired ✓");
  }).catch(err => console.error(...));
}
```

---

### 10. `server/infrastructure/events/distributed-bus-activator.ts`

**Complete rewrite** — removed 85 lines of broken `redis`-npm stub code.

```typescript
// Before (broken):
// - Used 'redis' npm package (not ioredis)
// - bus.emitLocal?.() doesn't exist on EventEmitter3 — silent failure
// - Parallel broken implementation duplicating distributedEventBus

// After (correct):
// - Delegates entirely to canonical distributedEventBus (ioredis-backed)
// - activateDistributedBus() calls distributedEventBus.start()
// - shutdownDistributedBus() calls distributedEventBus.stop()
// - isDistributedBusActive() returns activation state
```

---

## Net Line Count

| File | Before | After | Delta |
|------|--------|-------|-------|
| `redis-on-connect-hooks.ts` | 0 | 68 | +68 (NEW) |
| `queue-worker-processor.ts` | 0 | 62 | +62 (NEW) |
| `redis-sync-barrier.ts` | 0 | 115 | +115 (NEW) |
| `redis-transport-adapter.ts` | 0 | 54 | +54 (NEW) |
| `redis-client.ts` | 95 | 100 | +5 |
| `distributed-queue.ts` | 85 | 94 | +9 |
| `distributed/index.ts` | 122 | 123 | +1 |
| `orchestration/index.ts` | 134 | 136 | +2 |
| `distributed-event-bridge.ts` | 72 | 100 | +28 |
| `distributed-bus-activator.ts` | 125 | 72 | -53 |
| **Total** | **633** | **924** | **+291** |
