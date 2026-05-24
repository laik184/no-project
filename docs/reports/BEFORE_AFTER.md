# BEFORE_AFTER — Specialist Coordination Architecture

Precise before/after diff for every changed execution path.

---

## specialist-wave-runner.ts — Stub → Real Dispatch

### BEFORE
```typescript
const specialistFn = async (): Promise<SpecialistResult> => {
  // Specialist execution stub
  return {
    taskId:     task.taskId,
    domain:     task.domain,
    success:    true,
    patches:    [],          // ← always empty
    artifacts:  { goal: task.goal, context: task.context },
    durationMs: Date.now() - t0,
  };
};
const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error("specialist_timeout")), task.timeoutMs)
);
const submittedResult = await Promise.race([
  centralWorkerPool.submit({ ... fn: specialistFn }),
  timeout,
]);
```

### AFTER
```typescript
const signal = ctx.abortController.signal;
const submittedResult = await centralWorkerPool.submit<SpecialistResult>({
  taskId:    task.taskId,
  runId,
  priority:  "normal" as const,
  timeoutMs: task.timeoutMs,
  fn:        () => specialistDispatcher.dispatch(task, signal),
});
// Real LLM agent loop executes per domain with scoped system prompt
```

**Impact**: Specialists now execute real LLM tool-loop cycles. File writes, API calls,
schema changes, and verifications actually happen instead of returning phantom success.

---

## swarm-dispatcher.ts — simulateAgentExecution → Real Dispatch

### BEFORE
```typescript
async function simulateAgentExecution(task, agent): Promise<SwarmTaskResult> {
  const t0 = Date.now();
  await new Promise(r => setTimeout(r, 50)); // yield — no actual work
  return {
    success:    true,
    confidence: 0.85,
    output:     { note: `${agent.role} completed ${task.description}` },
    filesWritten: [],   // ← always empty
    durationMs: Date.now() - t0,
  };
}
```

### AFTER
```typescript
async function executeAgentViaCoordination(task, agent, runId, timeoutMs) {
  const domain = mapSwarmRoleToDomain(agent.role);
  const result = await specialistDispatcher.dispatch({
    taskId, runId, projectId, domain,
    goal: task.description,
    ...
  }, signal);
  return {
    success:      result.success,
    filesWritten: result.patches.map(p => p.filePath),
    output:       result.artifacts,
    ...
  };
}
```

**Impact**: Each swarm agent now does real domain-scoped LLM work instead of sleeping 50ms.

---

## execution-router.ts — Missing → swarm Mode

### BEFORE
```typescript
switch (mode) {
  case "tool-loop": ...
  case "planned":   ...
  case "pipeline":  ...
  case "dag":       ...
  case "recovery":  ...
  case "quantum":   ...
  // ← swarm: not registered. Falls through silently.
}
```

### AFTER
```typescript
case "swarm":
  await _routable(ctx, state, executeSwarm);
  break;

async function executeSwarm(ctx): Promise<void> {
  const result = await coordinateSpecialists(goal, runId, projectId, metadata);
  // Full parallel specialist coordination lifecycle
}
```

**Impact**: Swarm-mode orchestration requests now execute instead of being silently ignored.

---

## main.ts — Missing → context sweeper + SSE bridge

### BEFORE
```typescript
startPortSweeper(300_000);
// ← contextRegistry.startSweeper() never called → memory leak
// ← wireCoordinationSSE() never called → no swarm events reach frontend
console.log('[nura-x] systems online...');
```

### AFTER
```typescript
startPortSweeper(300_000);
contextRegistry.startSweeper(60_000);  // ← evicts leaked contexts
wireCoordinationSSE();                  // ← 28 event types → SSE
console.log('[nura-x] coordination-sweeper ✓');
```

**Impact**: Memory leak closed. Frontend now receives real-time specialist swarm events.

---

## OrchestrationMode union — "swarm" added

### BEFORE
```typescript
export type OrchestrationMode =
  | "tool-loop" | "planned" | "pipeline"
  | "dag" | "recovery" | "quantum";
```

### AFTER
```typescript
export type OrchestrationMode =
  | "tool-loop" | "planned" | "pipeline"
  | "dag" | "swarm" | "recovery" | "quantum";
```
