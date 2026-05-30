# MEMORY WRITE GRAPH (Phase 3)
Audit date: 2026-05-30

---

## Legend
- ✓ = verified in source code
- ✗ = absent / broken
- F&F = fire-and-forget (.catch(console.error))
- W-T = write-through (in-process first, then async persist)

---

## Agent Write Paths

### planner-agent.ts → memory
```
plan() → success path only
  ├─ memoryEngine.store({ category: 'decision',      ... })  F&F ✓
  │    content: { goal, planId, durationMs }
  │    tags: ['planning', 'goal']
  │    score: 1.0
  └─ memoryEngine.store({ category: 'architecture',  ... })  F&F ✓
       content: { planId, taskCount }
       tags: ['architecture', 'execution-plan']
       score: 0.9
```
Writes: ON SUCCESSFUL PLANNING ONLY. Failures NOT written.
Categories: `decision`, `architecture`

---

### executor-agent.ts → memory
```
runExecutorAgent() → always (success or failure)
  └─ memoryEngine.store({ category: 'execution', ... })  F&F ✓
       content: { ok, tasksCompleted, tasksFailed, durationMs }
       tags: ['executor', 'success'|'failure']
       score: 1.0 (success) | 0.2 (failure)
```
Categories: `execution`

---

### verifier-agent.ts → memory
```
runVerification() → ONLY when errors.length > 0
  └─ memoryEngine.store({ category: 'bug', ... })  F&F ✓
       content: { phases, errors, stepsRun }
       tags: ['verification', 'failure', ...phases]
       score: 0.3
```
Categories: `bug` — CONDITIONAL (only on failure)

---

### browser-agent.ts → memory
```
runBrowserAgent() → always (success or failure)
  └─ memoryEngine.store({ category: 'learning', ... })  F&F ✓
       content: { url, ok, stepsExecuted, integrityOk, durationMs }
       tags: ['browser', 'success'|'failure']
       score: 0.9 (success) | 0.2 (failure)
```
Categories: `learning`

---

### supervisor-agent.ts → memory
```
supervise() → always (success or failure)
  └─ memoryEngine.store({ category: 'decision', ... })  F&F ✓
       content: { goal, success, tasksRun, durationMs }
       tags: ['supervision', 'success'|'failure']
       score: 1.0 (success) | 0.3 (failure)
```
Categories: `decision`

---

### coderx-agent.ts → memory
```
runCoderXAgent() → always (success or failure)
  └─ memoryEngine.store({ category: 'execution', ... })  F&F ✓
       content: { ok, tasksCompleted, tasksFailed, durationMs }
       tags: ['coderx', 'success'|'failure']
       score: 1.0 (success) | 0.2 (failure)
```
Categories: `execution`

---

### chat-orchestrator.ts → memory
```
startRun() → always (on every chat turn start)
  └─ memoryEngine.store({ category: 'conversation', ... })  F&F ✓
       content: <goal text>
       tags: ['chat', 'user-goal']
       score: 1.0
```
Categories: `conversation`

---

## Write-Through Paths (executor sub-systems)

### execution-history.ts → memory
```
recordExecution(params) → always
  └─ memoryEngine.store({ category: 'execution', ... })  W-T ✓
       content: { runId, taskId, toolName, kind, outcome, retries, durationMs, errorClass, fixApplied }
       tags: [toolName, outcome, kind, errorClass?]
       score: 1.0|0.5|0.2 based on outcome
```
Frequency: EVERY tool step execution

---

### failure-memory.ts → memory
```
recordFailurePattern(runId, toolName, kind, error) → always
  └─ memoryEngine.store({ category: 'bug', ... })  W-T ✓
       content: FailurePattern object (signature, toolName, kind, errorSnippet, occurrences)
       tags: [toolName, kind, errorCategory]
       score: 0.1 (chronic) | 0.4 (active) | 0.5 (new)
```
Frequency: EVERY failure event

---

### learning-store.ts (executor) → memory
```
upsert(kind, key, delta, metadata?) → always
  └─ memoryEngine.store({ category: 'learning', ... })  W-T ✓
       content: { kind, key, value, evidence, version, metadata }
       tags: [kind, key.split('::')[0]]
       score: learned value (0-1)
```
Frequency: EVERY learning update (post-run feedback loop, tool selection outcomes)

---

## Agents NOT Writing to Memory

| Agent | Status |
|-------|--------|
| filesystem-agent.ts | NO memory writes |
| terminal agents | NO memory writes |
| verifier (success case) | NO memory writes on successful verification |

---

## Store Coverage Summary

| Category | Writers | Frequency |
|----------|---------|-----------|
| `decision` | planner, supervisor | Per run |
| `architecture` | planner | Per successful plan |
| `bug` | verifier (failure), failure-memory (per error) | Per failure |
| `business` | NONE | Never |
| `user-feedback` | NONE | Never |
| `revenue` | NONE | Never |
| `learning` | browser, learning-store (per upsert) | Per run + per learning update |
| `prediction` | NONE | Never |
| `execution` | executor, coderx, execution-history (per step) | Per run + per step |
| `conversation` | chat | Per chat turn |
| `reflection` | reflectionEngine (when called) | NEVER (loop not triggered) |
