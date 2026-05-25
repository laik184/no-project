# Redis Distributed Infrastructure — Architecture Blueprint

**Project:** Nura-X  
**Version:** Post-fix (2026-05-25)  
**Layer:** `server/distributed/` + `server/infrastructure/events/` + `server/quantum/locks/`

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NURA-X DISTRIBUTED LAYER                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ORCHESTRATION BOOT CHAIN                  │   │
│  │  initOrchestration()                                         │   │
│  │    → initDistributedSystem()    ← FIXED: now actually called │   │
│  │      → distributedOrchestrationWiring.wire()                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ REDIS LAYER │  │  LOCK LAYER  │  │      QUEUE LAYER         │   │
│  │             │  │              │  │                          │   │
│  │ IORedis     │  │ SET NX PX    │  │ BullMQ (Redis)           │   │
│  │ singleton   │  │ Lua release  │  │ ↓ via processDistributed │   │
│  │ + health    │  │ heartbeat    │  │   Job() → CentralWorker  │   │
│  │ + reconnect │  │ renewal      │  │   Pool                   │   │
│  │             │  │ stale sweep  │  │                          │   │
│  │ lazy connect│  │ in-proc      │  │ In-process PriorityQueue │   │
│  │ exponential │  │ fallback     │  │ fallback                 │   │
│  │ backoff     │  │              │  │ ← FIXED: lazy init +     │   │
│  │             │  │              │  │   reinit hook            │   │
│  │ OnConnect   │  │              │  └──────────────────────────┘   │
│  │ Hooks ←NEW  │  │              │                                  │
│  └─────────────┘  └──────────────┘  ┌──────────────────────────┐   │
│                                     │      EVENT BUS LAYER     │   │
│  ┌──────────────────────────────┐   │                          │   │
│  │      SYNC BARRIER LAYER      │   │ RedisPubSub (ioredis)    │   │
│  │                              │   │ dedicated pub + sub      │   │
│  │ RedisDistributedSyncBarrier  │   │ connections              │   │
│  │ ← NEW: Redis INCR + EXPIRE   │   │                          │   │
│  │ fallback: in-process barrier │   │ EventBridge ← FIXED:     │   │
│  │                              │   │ transport auto-attached  │   │
│  └──────────────────────────────┘   │ via RedisTransportAdapter│   │
│                                     │                          │   │
│  ┌──────────────────────────────┐   │ BusActivator ← FIXED:    │   │
│  │      WORKER LAYER            │   │ delegates to real        │   │
│  │                              │   │ distributedEventBus      │   │
│  │ CentralWorkerPool            │   └──────────────────────────┘   │
│  │ → WorkerPool (in-process)    │                                  │
│  │   io-bound: 5 slots          │   ┌──────────────────────────┐   │
│  │   cpu-bound: 2 slots         │   │    TELEMETRY LAYER       │   │
│  │   llm: 2 slots               │   │                          │   │
│  │                              │   │ correlation IDs          │   │
│  │ WorkerHeartbeat (5s scan)    │   │ execution spans          │   │
│  │ WorkerBackpressure           │   │ queue/lock/retry traces  │   │
│  │ WorkerCapacity               │   │ aggregation traces       │   │
│  └──────────────────────────────┘   └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Contracts

### Redis Client (`distributed/redis/redis-client.ts`)

```typescript
getRedisClient(): Promise<Redis | null>   // async connect, null on failure
getRedisClientSync(): Redis | null         // sync accessor — available after connect
isRedisAvailable(): boolean               // connection state flag
createDedicatedClient(): Redis            // for BullMQ/pub-sub (separate conn required)
shutdownRedis(): Promise<void>            // graceful quit
```

**Key behaviors:**
- `lazyConnect: true` — explicit `.connect()` call required
- `enableOfflineQueue: false` — no buffered commands during disconnect (fail-closed)
- `maxRetriesPerRequest: 3` — singleton client
- `maxRetriesPerRequest: null` — dedicated clients (required by BullMQ)
- `keyPrefix: "nura:"` — all keys namespaced

### Redis On-Connect Hooks (`distributed/redis/redis-on-connect-hooks.ts`)  *(NEW)*

```typescript
redisOnConnectHooks.register(name: string, fn: () => void | Promise<void>): void
redisOnConnectHooks.fire(): Promise<void>   // called by redis-client on ready
redisOnConnectHooks.reset(): void           // called on close/end for reconnection
```

**Registration pattern:**
```typescript
// In constructor of any Redis-dependent singleton:
redisOnConnectHooks.register("my-subsystem-reinit", () => this.reinit());
```

### Distributed Queue (`distributed/queue/distributed-queue.ts`)

```typescript
distributedQueue.enqueue(data: DistributedJobData): Promise<boolean>
distributedQueue.stats(): Promise<QueueStats>
distributedQueue.drain(): Promise<void>
distributedQueue.reinit(): void   // called by on-connect hook
```

**Job data shape:**
```typescript
interface DistributedJobData {
  taskId:     string;
  runId:      string;
  projectId:  number;
  workerType: string;   // routes to registered handler
  priority:   TaskPriorityLevel;
  payload:    unknown;
  timeoutMs:  number;
  enqueuedAt: number;
}
```

**Job handler registration:**
```typescript
registerJobHandler("my-worker-type", async (payload, data) => {
  // process job
  return result;
});
```

### Distributed Lock Manager (`distributed/locks/distributed-lock-manager.ts`)

```typescript
distributedLockManager.acquire(key, opts): Promise<DistributedLockResult>
distributedLockManager.release(key, token, ownerId): Promise<boolean>
distributedLockManager.withLock(key, opts, fn): Promise<T>   // RAII
distributedLockManager.isLocked(key): Promise<boolean>
distributedLockManager.health(): LockHealth
```

**Options:**
```typescript
interface DistributedLockOptions {
  ownerId:      string;
  ttlMs:        number;
  waitMs?:      number;    // acquisition timeout
  retryMs?:     number;    // poll interval
  autoRenewMs?: number;    // heartbeat renewal interval
}
```

### Distributed Event Bus (`distributed/events/distributed-event-bus.ts`)

```typescript
distributedEventBus.start(): Promise<void>
distributedEventBus.publish(channel, eventType, runId, projectId, payload, opts): Promise<void>
distributedEventBus.subscribe(opts: SubscriptionOptions): Promise<string>  // returns subId
distributedEventBus.unsubscribe(subId: string): Promise<void>
distributedEventBus.replay(subId, sinceTs): void
distributedEventBus.stats(): EventBusStats
distributedEventBus.stop(): Promise<void>
```

### Redis Sync Barrier (`distributed/sync/redis-sync-barrier.ts`)  *(NEW)*

```typescript
redisSyncBarrier.create(runId, name, expected, timeoutMs?): Promise<void>
redisSyncBarrier.arrive(runId, name, workerId): Promise<void>
redisSyncBarrier.cleanup(runId, name): Promise<void>
```

**Usage pattern:**
```typescript
// Coordinator
const barrier = redisSyncBarrier.create(runId, "wave-3-complete", 4, 30_000);

// Workers (any process)
await redisSyncBarrier.arrive(runId, "wave-3-complete", workerId);

// Coordinator waits for all 4
await barrier;
```

### Fail-Closed Gate (`distributed/validation/fail-closed-gate.ts`)

```typescript
failClosedGate.execute(runId, projectId, lockKey, fn, opts): Promise<T>
failClosedGate.validateReplay(runId, checkpointVersion): ValidationResult
```

---

## Degradation Tiers

All subsystems implement the same degradation contract:

| Tier | Condition | Behavior |
|------|-----------|----------|
| **Full Redis** | `REDIS_URL` set + connection healthy | BullMQ queues, SET NX PX locks, pub/sub events, Redis barriers |
| **Degraded** | Redis was unavailable at boot, now connected | On-connect hooks reinit queue + event bridge transport |
| **In-Process** | `REDIS_URL` unset | PriorityQueue, LeaseManager, EventEmitter3 bus, in-process barriers |

---

## Key Prefix Namespace

All keys use the `nura:` prefix (configurable via `REDIS_KEY_PREFIX`):

| Subsystem | Key Pattern |
|-----------|-------------|
| Distributed locks | `nura:lock:{key}` |
| BullMQ queue | `nura:bull:{queue}:{...}` |
| Pub/sub channels | `nura:events:{channel}` |
| Sync barriers | `nura:barrier:{runId}:{name}` |
| Health checks | `nura:health:ping` |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | — | Primary Redis URL (redis://...) |
| `REDIS_TLS_URL` | — | TLS Redis URL |
| `KV_URL` | — | Replit KV store URL |
| `REDIS_HOST` | `127.0.0.1` | Host fallback |
| `REDIS_PORT` | `6379` | Port fallback |
| `REDIS_PASSWORD` | — | Auth password |
| `REDIS_DB` | `0` | Database index |
| `REDIS_KEY_PREFIX` | `nura:` | Key namespace |
| `BUS_CHANNEL` | `nura-x:events` | Pub/sub channel name |
| `QUEUE_WORKER_CONCURRENCY` | `10` | BullMQ worker concurrency |
