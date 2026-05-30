# MEMORY MIGRATION MAP
Generated: 2026-05-30

---

## Migration Strategy: Write-Through Persistence

### Architecture Decision

The 3 migration candidates (execution-history, failure-memory, learning-store) have:
1. **SYNCHRONOUS APIs** used in hot-path execution (tool selection, recovery, prediction)
2. **Multiple callers** (5, 4, and 9 files respectively)
3. **No async boundary** in their call chain

Replacing them with direct async memoryEngine calls would require:
- Making `decisionEngine.decide()` async (currently synchronous, used during execution loop)
- Making `toolSelectionEngine.selectBestTool()` async (called per task routing decision)
- Making `patternLearner.getRecommendedStrategy()` async (called per task)
- Refactoring 18+ call sites across 5 different agent subsystems

**Decision: Write-Through Persistence Pattern**

```
Before:
  local store.write(data)   ← only in-process, lost on restart
  local store.read()        ← synchronous, fast

After:
  local store.write(data)   ← still in-process (synchronous hot-path)
  memoryEngine.store(data).catch(console.error)  ← fire-and-forget persistence
  local store.read()        ← still synchronous, still fast
```

This achieves:
- server/memory/ becomes the ONLY persistent long-term intelligence store
- Local in-process stores serve as fast in-memory caches
- No callers need to change (zero breaking changes)
- No circular dependencies
- No hot-path blocking

---

## Migration 1: execution-history.ts → execution-memory/

### Source
`server/agents/executor/memory/execution-history.ts`

### Target Category
`execution` (registered in bootstrap, maps to `server/memory/execution-memory/execution-store.ts`)

### What gets persisted
Every call to `recordExecution()` triggers a fire-and-forget write:
```ts
memoryEngine.store({
  category: 'execution',
  content:  JSON.stringify({ runId, taskId, toolName, kind, outcome, errorText, retries, durationMs, errorClass, fixApplied }),
  tags:     [toolName, outcome, kind, ...(errorClass ? [errorClass] : [])],
  score:    outcome === 'success' ? 1.0 : outcome === 'partial' ? 0.5 : 0.2,
  meta:     { runId, agentSource: 'executor-history' },
})
```

### What stays local
- The in-process `_history` array (for synchronous findSimilarFailure, getByRun, hasPriorFix, summary)
- All existing exports — callers unchanged

### Classification preserved
- Local array: **EXECUTION_HISTORY** (fast cache)
- server/memory/execution-memory/: **LONG_TERM_MEMORY** (persistent)

---

## Migration 2: failure-memory.ts → bug-memory/

### Source
`server/agents/executor/memory/failure-memory.ts`

### Target Category
`bug` (maps to `server/memory/bug-memory/bug-store.ts`)

### What gets persisted
Every call to `recordFailurePattern()` triggers a fire-and-forget write:
```ts
memoryEngine.store({
  category: 'bug',
  content:  JSON.stringify({ signature, toolName, kind, errorSnippet, occurrences, firstSeen, lastSeen, runIds }),
  tags:     [toolName, kind, category],
  score:    isChronicle ? 0.2 : 0.5,
  meta:     { runId, agentSource: 'executor-failure-memory' },
})
```

### What stays local
- The in-process `_patterns` Map (for synchronous hasSeenFailure, isRetryStorm, chroniclePatterns)
- The `_recentTimestamps` array (for isRetryStorm() within 30s window)
- All existing exports — callers unchanged

### Classification preserved
- Local Map: **RUNTIME_STATE** (fast cache + recent-window detection)
- server/memory/bug-memory/: **BUG_INTELLIGENCE** (persistent cross-restart)

---

## Migration 3: learning-store.ts → learning-memory/

### Source
`server/agents/executor/learning/learning-store.ts`

### Target Category
`learning` (maps to `server/memory/learning-memory/learning-store.ts`)

**NAMING NOTE**: This is NOT the same as `server/memory/learning-memory/learning-store.ts`.
- Executor's learning-store.ts: scored intelligence (LearnedEntry with numeric value/evidence)
- Memory platform's learning-store.ts: implements BaseMemoryStore<LearningEntry> (MemoryStore interface)
The executor's learning data WRITES INTO the platform's learning category via memoryEngine.

### What gets persisted
Every call to `upsert()` triggers a fire-and-forget write:
```ts
memoryEngine.store({
  category: 'learning',
  content:  JSON.stringify({ kind, key, value, evidence, version, metadata }),
  tags:     [kind, key.split('::')[0]],
  score:    value,
  meta:     { agentSource: 'executor-learning-store', kind, key },
})
```

### What stays local
- The in-process `_store: Map<string, LearnedEntry>` (for synchronous getValue, byKind, topByKind)
- All existing exports — ALL 9 callers unchanged
- The learning-governor continues to gate all writes

### Classification preserved
- Local Map: **LEARNING_SYSTEM** (fast synchronous cache)
- server/memory/learning-memory/: **LONG_TERM_MEMORY** (persistent cross-restart)

---

## DO NOT MIGRATE

| Module | Classification | Reason |
|--------|---------------|--------|
| executor/memory/working-memory.ts | RUNTIME_STATE | Per-run transient, hot-path |
| executor/memory/context-window-manager.ts | ORPHANED | No callers — delete instead |
| coderx/memory/working-memory.ts | RUNTIME_STATE | Per-run transient |
| coderx/memory/execution-history.ts | RUNTIME_STATE | Per-run, has clearRun() |
| orchestration/core/orchestration-replay.ts | CHECKPOINT | Per-run phase replay |
| orchestration/execution/execution-result-registry.ts | RUNTIME_STATE | Per-run stats |
| chat/persistence/* | DB_BACKED | Different storage tier (PostgreSQL) |
| chat/context/context-cache.ts | CACHE | Per-run evicted |
| chat/realtime/connection-registry.ts | RUNTIME_STATE | Active connections, ephemeral |
| tools/filesystem/workspace-history.ts | ALREADY_PERSISTENT | File-backed .history/*.json |
| tools/terminal/state/process-history.ts | RUNTIME_STATE | Per-run, has clear() |
| tools/terminal/state/port-registry.ts | RUNTIME_STATE | Active port allocations |
| publishing/services/settings-store.ts | DB_BACKED | Drizzle PostgreSQL |
| publishing/services/log-store.ts | CACHE | Per-deployment in-memory |
| publishing/services/issue-store.ts | CACHE | Per-deployment in-memory |

---

## Files Modified by Phase 6

| File | Change |
|------|--------|
| `server/agents/executor/memory/execution-history.ts` | Added memoryEngine import + fire-and-forget in recordExecution() |
| `server/agents/executor/memory/failure-memory.ts` | Added memoryEngine import + fire-and-forget in recordFailurePattern() |
| `server/agents/executor/learning/learning-store.ts` | Added memoryEngine import + fire-and-forget in upsert() |

## Files Deleted by Phase 9

| File | Reason |
|------|--------|
| `server/agents/executor/memory/context-window-manager.ts` | Zero importers. No callers. No build references. |

---

## Final Data Flow

```
Execution pipeline (per step):
  ┌─────────────────────────────────────────────────────────┐
  │  task-executor → step-runner → tool dispatch            │
  │        ↓                                                │
  │  executionHistory.recordExecution() ← SYNC (fast)      │
  │        ↓ fire-and-forget                                │
  │  memoryEngine.store('execution') ← ASYNC (persisted)   │
  └─────────────────────────────────────────────────────────┘

Recovery pipeline:
  ┌─────────────────────────────────────────────────────────┐
  │  recoveryEngine.assess() → failureMemory.analyze()      │
  │                              ← SYNC (fast)              │
  │        ↓ fire-and-forget                                │
  │  memoryEngine.store('bug') ← ASYNC (persisted)         │
  └─────────────────────────────────────────────────────────┘

Learning pipeline:
  ┌─────────────────────────────────────────────────────────┐
  │  feedbackLoop → patternLearner → learningStore.upsert() │
  │                                   ← SYNC (fast)         │
  │        ↓ fire-and-forget                                │
  │  memoryEngine.store('learning') ← ASYNC (persisted)    │
  └─────────────────────────────────────────────────────────┘
```
