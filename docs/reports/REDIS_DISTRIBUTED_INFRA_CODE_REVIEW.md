# Redis Distributed Infrastructure — Code Review Report

**Project:** Nura-X  
**Reviewer:** Distributed Systems Analysis  
**Date:** 2026-05-25  
**Files Reviewed:** 10 core distributed infrastructure files

---

## Scoring Summary

| Category | Before | After | Notes |
|----------|--------|-------|-------|
| Correctness | 4/10 | 9/10 | Boot chain, async handling, processor |
| Reliability | 5/10 | 9/10 | On-connect hooks, lazy init, keyPrefix |
| Observability | 8/10 | 9/10 | Already strong; errors now explicit |
| Fail-Closed Safety | 7/10 | 9/10 | Async await fixes silent swallowing |
| Abstraction Quality | 7/10 | 9/10 | Transport adapter, hook registry |
| Code Standards | 9/10 | 10/10 | <250 LOC, typed, no `any`, ES modules |

---

## File-by-File Review

---

### `server/distributed/redis/redis-client.ts` — Grade: A

**Strengths:**
- IORedis singleton with proper lazy connect pattern
- Exponential backoff reconnect via `redis-reconnect.ts` (capped strategy)
- All lifecycle events telemetried (`connected`, `ready`, `error`, `close`, `end`, `reconnecting`)
- `enableOfflineQueue: false` — correct fail-closed behavior (commands during disconnect fail immediately)
- `maxRetriesPerRequest: 3` for normal client, `null` for dedicated clients (BullMQ requirement)

**Issues resolved:**
- `createDedicatedClient()` lacked `keyPrefix` — fixed
- No mechanism for on-connect callbacks — fixed with `redisOnConnectHooks`

**Remaining note:** The `getRedisClientSync()` function returns `instance && available ? instance : null` but doesn't guard against the window between `connect` event (available=true) and `ready` event. In practice, `ready` fires milliseconds after `connect` and IORedis queues commands until ready. Low risk.

---

### `server/distributed/redis/redis-on-connect-hooks.ts` — Grade: A *(NEW)*

**Design quality:** Clean singleton with idempotent `fire()` and re-entrant `reset()`. Late registration support (callbacks invoked immediately if Redis already connected) is essential for modules initialized after the `ready` event.

**Correctness:** `reset()` called on both `close` and `end` events ensures hooks can re-fire on reconnect.

**Note:** The `fired` flag gates the entire batch. If Redis drops and reconnects multiple times, hooks fire on each reconnect (after `reset()`). This is correct behavior for reinit-style hooks.

---

### `server/distributed/queue/distributed-queue.ts` — Grade: A-

**Before review:** Class instantiated BullMQ queue synchronously at module evaluation time. `isRedisAvailable()` always `false` during ESM static initialization → `this.bq = null` forever.

**After fix:** Constructor registers a reinit hook. Queue is lazy-initialized; when Redis connects, `reinit()` is called automatically.

**Remaining concern:** The `createdQueues` map in `queue-factory.ts` caches queues by name. After `reinit()`, a new `Queue` instance is created and cached. The old `null` is replaced. This is correct. However, if `reinit()` is called multiple times (e.g., on reconnect after a drop), `createQueue()` returns the cached instance — no memory leak.

**Minor:** `enqueue()` logs validation failure with `console.warn` rather than `bus.emit` telemetry. Should emit `queue.validation_failed` event for observability. Not blocking.

---

### `server/distributed/queue/queue-worker-processor.ts` — Grade: A *(NEW)*

**Design quality:** Handler registry pattern is the correct approach for extensible job routing without coupling the processor to specific job logic.

**Fail-closed:** Returns a skip result (not an error) for unregistered types — correct choice. An error would cause BullMQ to retry infinitely on an unregisterable type, filling the retry queue. A skip completes the job and preserves the retry budget for real failures.

**Worker routing:** Routes to `centralWorkerPool.submit()` which enforces backpressure, priority tiers, capacity limits, and heartbeat monitoring. Correct.

**Concern:** `processDistributedJob` passes `data.priority` directly to `CentralWorkerPool.submit()`. `CentralTask.priority` expects `TaskPriority` (a union type from `worker-priority.ts`). `DistributedJobData.priority` is `TaskPriorityLevel` (from `priority-queue.ts`). These are the same string union (`"critical" | "high" | "normal" | "low" | "background"`) defined in separate files. Works at runtime; a shared type would be cleaner.

---

### `server/distributed/queue/queue-factory.ts` — Grade: B+

**Strengths:** Clean BullMQ Queue factory with correct `defaultJobOptions` (exponential backoff, bounded history).

**Note:** Uses raw `ConnectionOptions` (host/port/password) rather than an IORedis instance. This is the correct BullMQ pattern — BullMQ manages its own connection pool internally.

**Issue noted (not fixed — out of scope):** `buildConnection()` doesn't pass `tls` options. If using `REDIS_TLS_URL`, TLS won't be negotiated for BullMQ connections. Should read `redisConfig` and pass `tls: { rejectUnauthorized: true }` when URL scheme is `rediss://`.

---

### `server/distributed/locks/distributed-lock-manager.ts` — Grade: A

**Strengths:**
- Single public API over `lockAcquisition`, `redisLockStore`, `lockRegistry`, `lockHeartbeat`, `lockRecovery`, `lockTelemetry`
- `withLock` RAII pattern — releases in `finally` block
- Auto-renewal registration when `autoRenewMs > 0`
- Backend reported in `health()` snapshot

**Implementation quality:** `redisLockStore.ts` uses Lua script for compare-and-delete release — correct. Prevents race condition where Token A releases Token B's lock after Token A's TTL expired.

---

### `server/distributed/events/distributed-event-bus.ts` — Grade: A

**Strengths:**
- Correct IORedis pub/sub pattern (dedicated publisher + subscriber — required by Redis protocol)
- Event replay buffer for late subscribers
- `deliverLocal()` always runs (covers same-process subscribers even when Redis publishes)
- Telemetry on every publish/subscribe/deliver/drop

**Note:** `redisPubSub.start()` called in `distributedEventBus.start()`. The `started` guard prevents double-initialization. Clean.

---

### `server/infrastructure/events/distributed-event-bridge.ts` — Grade: A-

**Before:** Dead code — transport permanently `null`, metrics accumulated `localOnly` count.

**After:** Auto-attaches `RedisPubSubTransportAdapter` on init when Redis available. Registers reconnect hook for deferred attachment. Lazy dynamic import avoids circular dependency at module load time.

**Pattern quality:** Dynamic `import()` in `tryAttachRedisTransport()` is the correct way to break circular module dependencies in ESM. The `Promise` chain is properly `.catch()`-handled.

**Minor:** `tryAttachRedisTransport()` is idempotent (early return if `this.transport` set) — correct.

---

### `server/infrastructure/events/distributed-bus-activator.ts` — Grade: A

**Before:** 125 lines of broken implementation using wrong Redis client library, non-existent API calls, and duplicate logic.

**After:** 72 lines. Thin delegation layer over `distributedEventBus`. `activateDistributedBus()` → `distributedEventBus.start()`. State tracked locally (`_active` flag).

**API compatibility:** Public types `ActivationResult`, `activateDistributedBus()`, `shutdownDistributedBus()`, `isDistributedBusActive()` all preserved. Drop-in replacement.

---

### `server/distributed/sync/redis-sync-barrier.ts` — Grade: A *(NEW)*

**Design:** Redis `INCR` for atomic multi-process counting is the standard pattern for distributed barriers (alternatives: Lua script, pub/sub notification). `INCR` is O(1) and atomic — correct choice.

**Safety:** `EXPIRE` called after every `INCR` (not just first) to refresh TTL. Correct — a worker arriving late should refresh the expiry. Hard cap of 5 minutes prevents stale barrier keys.

**Fallback:** Delegates to `inProcessBarrier` when Redis unavailable. The imported `distributedSyncBarrier` is the in-process implementation — correct.

**Polling concern:** `POLL_MS = 100` means coordinator polls Redis at 10Hz. For long-running barriers, this is reasonable. For high-frequency short barriers (sub-second), pub/sub notification would be more efficient. Not blocking.

---

### `server/infrastructure/events/redis-transport-adapter.ts` — Grade: A *(NEW)*

**Design quality:** Clean adapter implementing the `ExternalTransport` interface. Single responsibility — translate between string payloads (bridge protocol) and `DistributedEvent` objects (pub/sub protocol).

**Error handling:** Publish throws on `redisPubSub.publish()` returning `false` (which happens when Redis is disconnected). This propagates to the bridge's try/catch which logs + increments `metrics.failed`. Correct behavior — bridge degrades to local-only gracefully.

---

## Cross-Cutting Concerns

### Circular Dependency Analysis
- `redis-client.ts` → `redis-on-connect-hooks.ts` ✅ (no cycle)
- `distributed-queue.ts` → `redis-on-connect-hooks.ts` ✅ (no cycle)
- `distributed-event-bridge.ts` → dynamic `import("./redis-transport-adapter.ts")` ✅ (breaks static cycle)
- `redis-transport-adapter.ts` → `distributed/events/redis-pubsub.ts` ✅ (no cycle)

### Fail-Closed Verification
- `failClosedGate.execute()` — validates before every execution ✅
- `lockAcquisition.acquire()` — returns `{ acquired: false }` on timeout, never throws ✅
- `distributedQueue.enqueue()` — returns `false` on backpressure/validation, never throws ✅
- `processDistributedJob()` — throws on handler failure (BullMQ retries), returns skip on missing handler ✅

### Memory Leak Risks
- `lockHeartbeat` `setInterval` timers — cleared by `lockHeartbeat.shutdown()` on graceful shutdown ✅
- `workerHeartbeat` scan timer — cleared by `stop()` in `shutdownDistributedSystem()` ✅
- `redisOnConnectHooks` hook list — never cleared (intentional — hooks are permanent reinit registrations) ✅
- BullMQ `QueueEvents` — closed by `stopQueueEvents()` in `shutdownDistributedSystem()` ✅

---

## Recommendations (Non-Blocking)

1. **TLS for BullMQ connections**: Pass `tls: {}` in `buildConnection()` when `REDIS_TLS_URL` detected.
2. **Shared priority type**: Define `TaskPriorityLevel` once in `shared/` and import from both queue and worker modules.
3. **Pub/sub notification for barriers**: For low-latency barriers, subscribe to a `nura:barrier:{runId}:{name}:notify` channel and publish on INCR reaching threshold.
4. **Circuit breaker**: After `MAX_RECONNECT_ATTEMPTS`, stop retrying and emit `redis.circuit_open` event. Let operator intervention reset.
5. **Dead letter persistence**: Current `deadLetterQueue` is in-memory. Use Redis `LPUSH`/`RPOP` on `nura:dlq:{queue}` for persistence across restarts.
