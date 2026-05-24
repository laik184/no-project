# EVENT_GRAPH — Specialist Coordination Bus Events

Complete mapping of every bus event emitted during a specialist swarm run.

---

## Event Bus Pattern

All coordination events use the canonical pattern:
```typescript
bus.emit("agent.event", {
  runId, projectId,
  phase:     "coordination",
  agentName: "<emitter>",
  eventType: "<event.type>",
  payload:   { ... },
  ts:        Date.now(),
});
```

The existing subscription-manager fans these out to SSE connections automatically.

---

## Event Catalog

### Coordination Lifecycle

| Event | Emitter | Payload | When |
|-------|---------|---------|------|
| `coordination.start` | parallel-specialist-coordinator | `{ goal, runId, waveCount }` | Before wave 1 |
| `coordination.complete` | parallel-specialist-coordinator | `{ specialistsRan, wavesExecuted, patchCount, durationMs }` | All waves done |
| `coordination.partial` | parallel-specialist-coordinator | `{ completedWaves, failedTasks }` | Partial success |
| `coordination.failed` | parallel-specialist-coordinator | `{ error, specialistsRan }` | Total failure |
| `coordination.aborted` | parallel-specialist-coordinator | `{ runId, reason }` | AbortSignal fired |
| `coordination.wave.total_failure` | specialist-wave-runner | `{ waveIndex, failed }` | All wave tasks fail |

---

### Specialist Lifecycle

| Event | Emitter | Payload | When |
|-------|---------|---------|------|
| `specialist.start` | specialist-dispatcher | `{ taskId, domain, goal }` | Before LLM call |
| `specialist.complete` | specialist-dispatcher | `{ taskId, domain, durationMs, patchCount }` | LLM loop done, success |
| `specialist.failed` | specialist-dispatcher | `{ taskId, domain, error, retryable }` | LLM loop done, error |
| `specialist.cancelled` | specialist-dispatcher | `{ taskId, domain }` | AbortSignal before start |
| `specialist.execute.start` | specialist-executor | `{ taskId, domain, maxSteps }` | runAgentLoop() called |
| `specialist.execute.complete` | specialist-executor | `{ taskId, domain, steps, stopReason, patchCount }` | Loop returned |
| `specialist.execute.failed` | specialist-executor | `{ taskId, domain, error, durationMs }` | Loop threw |

---

### Agent Loop Events (existing, forwarded)

| Event | Payload | When |
|-------|---------|------|
| `agent.start` | `{ taskId, domain }` | Wave runner marks task started |
| `agent.complete` | `{ taskId, domain, durationMs }` | Wave runner marks task complete |
| `agent.failed` | `{ taskId, domain, error, durationMs }` | Wave runner marks task failed |

---

### Lock Events (from unifiedLockCoordinator)

| Event | Payload | When |
|-------|---------|------|
| `lock.acquire` | `{ taskId, files }` | Before acquiring exclusive locks |
| `lock.acquired` | `{ taskId }` | All locks held |
| `lock.release` | `{ taskId, durationMs }` | Locks released after task |

---

### Merge Events (from aggregation layer)

| Event | Payload | When |
|-------|---------|------|
| `merge.start` | `{ patchCount, conflictCount }` | Merge phase begins |
| `merge.plan.built` | `{ steps, strategy }` | MergePlan constructed |
| `merge.patch.applied` | `{ filePath, domain, confidence }` | Patch written |
| `merge.patch.skipped` | `{ filePath, reason }` | Patch skipped (conflict loser) |
| `merge.complete` | `{ appliedCount, skippedCount, durationMs }` | Merge done |

---

### Conflict Events (from conflict-resolution layer)

| Event | Payload | When |
|-------|---------|------|
| `conflict.detected` | `{ filePath, domains, count }` | Overlapping patches found |
| `conflict.resolved` | `{ filePath, winner, loser, strategy }` | Winner selected |

---

### Verification Events (from post-coordination-verifier)

| Event | Payload | When |
|-------|---------|------|
| `verification.start` | `{ specialistsRan, patchCount }` | Before checks |
| `verification.complete` | `{ verdict, checksTotal, checksFailed, durationMs }` | All checks done |

---

## Event Flow Timeline (swarm with 3 domains)

```
coordination.start
  lock.acquire (database)
  lock.acquired (database)
  specialist.start (database)
  specialist.execute.start (database)
  lock.acquire (backend)
  lock.acquired (backend)
  specialist.start (backend)
  specialist.execute.start (backend)
    ... LLM calls happening in parallel ...
  specialist.execute.complete (database)
  specialist.complete (database)
  agent.complete (database)
  lock.release (database)
  specialist.execute.complete (backend)
  specialist.complete (backend)
  agent.complete (backend)
  lock.release (backend)
conflict.detected (if any)
conflict.resolved (if any)
merge.start
merge.plan.built
merge.patch.applied × N
merge.complete
verification.start
verification.complete { verdict: "pass" }
coordination.complete
```

---

## SSE Subscription

Frontend subscribes on:
```
GET /api/chat/events?runId=<runId>&topics=agent
```

All `agent.event` bus emissions with matching `runId` arrive as:
```json
{
  "event": "agent",
  "data": {
    "type": "specialist.complete",
    "phase": "coordination",
    "payload": { "taskId": "...", "domain": "backend", "durationMs": 4823 },
    "ts": 1706000000000,
    "projectId": 1
  }
}
```
