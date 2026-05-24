# REAL SPECIALIST WIRING BEFORE / AFTER
**Date:** 2026-05-24

---

## BEFORE: DAG Agent Node Execution (Broken)

```
builderBridge.executeWithDAG()
  └─ runGraph(graph, { executor })
       └─ createNodeExecutor({ runId, projectId })
            └─ dispatchNode(node)   → node.type === "agent"
                 └─ dispatchAgent(node, runId, projectId)
                      ├─ key = `${runId}:${node.id}`
                      ├─ agentPromiseRegistry.register(key, 300_000)  ← registers promise
                      ├─ bus.emit("agent.event", { eventType: "dag.agent.execute", payload: { promiseKey: key, goal } })
                      │     └─ subscription-manager.ts forwards to SSE clients ONLY
                      │        ╳ NOBODY calls runAgentLoop()
                      │        ╳ NOBODY calls agentPromiseRegistry.resolve()
                      │
                      └─ await agentPromiseRegistry.register(key)
                           └─ ... waits 300 seconds ...
                                └─ setTimeout fires: resolve({ timedOut: true })
                                     └─ node marked "completed" with fake output
                                          └─ downstream nodes receive { timedOut: true }
```

**Result:** Every planned/DAG execution takes 5 minutes, produces no real work, marks nodes as "completed."

---

## AFTER: DAG Agent Node Execution (Fixed)

```
builderBridge.executeWithDAG()
  └─ runGraph(graph, { executor })
       └─ createNodeExecutor({ runId, projectId })
            └─ dispatchNode(node)   → node.type === "agent"
                 └─ dispatchAgent(node, runId, projectId)
                      ├─ key = `${runId}:${node.id}`
                      ├─ agentPromiseRegistry.register(key, 300_000)
                      ├─ bus.emit("agent.event", { eventType: "dag.agent.execute", payload: { promiseKey: key, goal } })
                      │     ├─ subscription-manager.ts → SSE clients (telemetry)
                      │     └─ dag-agent-executor.ts [NEW]
                      │          └─ void executeAgent(event)
                      │               ├─ bus.emit "dag.agent.started"
                      │               ├─ result = await runAgentLoop({ projectId, runId, goal, maxSteps: 25 })
                      │               ├─ bus.emit "dag.agent.completed"
                      │               └─ agentPromiseRegistry.resolve(promiseKey, result)
                      │
                      └─ await agentPromiseRegistry.register(key)
                           └─ settles when runAgentLoop() completes (real work done)
                                └─ node marked "completed" with real LLM output
```

---

## BEFORE: AgentPromiseRegistry Timeout (Fake Success)

```typescript
// BEFORE — fake success (corrupts DAG)
const timer = setTimeout(() => {
  if (this.handles.has(key)) {
    resolve({ timedOut: true, key });  // ← node "completes" with garbage
  }
}, timeoutMs);
```

## AFTER: AgentPromiseRegistry Timeout (Fail-Closed)

```typescript
// AFTER — real failure (enables retry/rollback)
const timer = setTimeout(() => {
  if (this.handles.has(key)) {
    reject(new Error(`dag_agent_timeout:${key}:${timeoutMs}ms`));  // ← node fails → retry fires
  }
}, timeoutMs);
```

---

## BEFORE: CodeWriterAgent (Silent Swallow)

```typescript
async write(prompt, fallbackPaths) {
  try {
    const raw    = await this.llmClient.complete(prompt);
    const parsed = safeJsonParse(raw);
    const files  = parsed.files?.filter(...).map(...);
    if (files && files.length > 0) return formatFiles(files);
  } catch {
    // Intentionally fall back to deterministic stubs.  ← SILENT SWALLOW
  }
  // Any error: LLM failure, network error, JSON parse error → placeholder
  return formatFiles(fallbackPaths.map(path => ({
    path,
    content: `export const placeholder = "Generated fallback for ${path}";`,
  })));
}
```

## AFTER: CodeWriterAgent (Fail-Closed with Explicit Error Paths)

```typescript
async write(prompt, fallbackPaths = []) {
  // LLM/network errors ALWAYS thrown — caller must retry
  const raw = await this.llmClient.complete(prompt);

  // Only JSON parse errors are recoverable (fallback to skeletons if caller opts in)
  let parsed: LlmResponse;
  try {
    parsed = safeJsonParse(raw);
  } catch (parseErr) {
    if (fallbackPaths.length > 0) {
      console.warn(`LLM returned malformed JSON. Building skeleton files.`);
      return buildSkeletons(fallbackPaths);  // ← clearly marked skeletons
    }
    throw new Error(`LLM returned malformed JSON: ${parseErr.message}`);
  }

  if (!files || files.length === 0) {
    throw new Error("LLM returned valid JSON but no files generated.");
  }
  return formatFiles(files);
}
```

---

## Files Changed

| File | Change Type | Impact |
|---|---|---|
| `server/engine/execution/dag-agent-executor.ts` | **NEW** | Resolves dag.agent.execute → runAgentLoop() |
| `server/engine/execution/dag-verify-executor.ts` | **NEW** | Resolves dag.verify.execute → verificationBridge |
| `server/engine/execution/dag-executor-wiring.ts` | **NEW** | Boot-time wiring entry point |
| `server/engine/execution/agent-promise-registry.ts` | **FIXED** | Timeout → reject (fail-closed) |
| `server/engine/execution/index.ts` | **UPDATED** | Exports new modules |
| `server/orchestration/index.ts` | **UPDATED** | Calls initDagExecutors() at boot |
| `server/agents/generation/code-gen/agents/code-writer.agent.ts` | **FIXED** | Surfaces LLM errors explicitly |
| `client/src/components/tab-views/AgentView.tsx` | **REPLACED** | Real monitor UI (was placeholder) |
