# MEMORY COMPATIBILITY REPORT
Generated: 2026-05-30

---

## Memory Platform Architecture (server/memory/)

```
server/memory/
├── index.ts                    ← re-exports everything
├── bootstrap.ts                ← one-time boot: register stores + start manager
├── core/
│   ├── memory-engine.ts        ← PUBLIC API (store/retrieve/search/update/forget/list)
│   ├── memory-router.ts        ← routes ops to correct store by category
│   ├── memory-registry.ts      ← central store directory (throws on duplicate)
│   ├── memory-store.ts         ← BaseMemoryStore abstract class (fs/path/crypto)
│   └── memory-manager.ts       ← TTL eviction lifecycle
├── types/
│   ├── memory.types.ts         ← MemoryCategory, MemoryEntry, MemoryStore, MemoryFilter
│   ├── entry.types.ts          ← category-specific entry types
│   ├── search.types.ts         ← SearchQuery, SearchResult
│   ├── graph.types.ts          ← knowledge graph types
│   └── telemetry.types.ts      ← metrics/event envelopes
├── decision-memory/            ← category: 'decision'
├── architecture-memory/        ← category: 'architecture'
├── bug-memory/                 ← category: 'bug'
├── business-memory/            ← category: 'business'
├── user-feedback-memory/       ← category: 'user-feedback'
├── revenue-memory/             ← category: 'revenue'
├── learning-memory/            ← category: 'learning'
├── prediction-memory/          ← category: 'prediction'
├── execution-memory/           ← category: 'execution'
├── conversation-memory/        ← category: 'conversation'
├── reflection/                 ← category: 'reflection' (also reflectionStore)
├── checkpoints/                ← category: 'checkpoint' (NOT in bootstrap — not yet registered)
├── compression/                ← archival utilities (no category)
├── knowledge-graph/            ← graph layer (no category in MemoryCategory)
├── retrieval/                  ← multi-modal search (no direct category)
└── telemetry/                  ← memoryMetrics, memoryEvents, telemetryReporter
```

### Registered Categories (per bootstrap.ts)
`decision` | `architecture` | `bug` | `business` | `user-feedback` | `revenue` |
`learning` | `prediction` | `execution` | `conversation` | `reflection`

### NOT registered at bootstrap
`checkpoint` (store exists in checkpoints/ but not registered)

### Public API (memory-engine.ts)
```ts
memoryEngine.store(input: CreateEntryInput): Promise<MemoryEntry>
memoryEngine.retrieve(category, id): Promise<MemoryEntry | undefined>
memoryEngine.update(category, id, patch): Promise<MemoryEntry | undefined>
memoryEngine.forget(category, id): Promise<boolean>
memoryEngine.list(category, filter?): Promise<MemoryEntry[]>
memoryEngine.search(query: SearchQuery): Promise<SearchResult>
memoryEngine.searchCategory(category, text, limit?): Promise<MemoryEntry[]>
memoryEngine.totalCount(): Promise<number>
memoryEngine.categoryCount(category): Promise<number>
memoryEngine.registeredCategories(): MemoryCategory[]
```

### CreateEntryInput shape
```ts
{
  id?:       string;           // auto-generated if omitted
  category:  MemoryCategory;   // must be registered
  content:   string;           // serialized text (use JSON.stringify for objects)
  tags?:     string[];
  score?:    number;           // 0.0–1.0 confidence/quality
  ttlMs?:    number;           // optional TTL
  meta?:     Record<string, unknown>;
}
```

---

## Duplicate Memory Analysis

### Naming Collision: learning-store (two files, different purposes)

| | executor/learning/learning-store.ts | server/memory/learning-memory/learning-store.ts |
|---|---|---|
| Purpose | In-process scored intelligence (LearnedEntry with value/evidence/governance) | BaseMemoryStore<LearningEntry> implementing MemoryStore interface |
| Storage | In-process Map (max 1000, eviction by age) | File-backed JSON persistence |
| Schema | LearnedEntry { id, kind, key, value: number, evidence: number } | MemoryEntry { id, category, content: string, tags, score, meta } |
| API | upsert(kind, key, delta), getValue, byKind, topByKind | create, get, update, delete, list, search, count |
| Consumers | executor/learning/*, planner/learning/*, browser/learning/* | memoryRouter (via memoryRegistry) |
| Conflict? | **NO** — completely different interface, schema, and consumers |

### Naming Collision: working-memory (two files, different purposes)

| | executor/memory/working-memory.ts | coderx/memory/working-memory.ts |
|---|---|---|
| Purpose | Run-scoped executor state (Set/Map: files, tool outputs, retries, browser) | Run-scoped coderx context (CodingTaskAnalysis, CodingPlan, scratchpad) |
| Schema | WorkingMemorySlot (browserState, validationResults, snapshotHistory) | WorkingMemoryEntry (analysis, plan, completedTaskIds, failedTaskIds) |
| Conflict? | **NO** — different owners, different schemas, not shared |

### Naming Collision: execution-history (two files, different purposes)

| | executor/memory/execution-history.ts | coderx/memory/execution-history.ts |
|---|---|---|
| Purpose | Cross-run ring-buffer with error classification + fix detection | Per-run snapshots + retries + task outputs |
| Schema | ExecutionHistoryEntry (toolName, kind, outcome, errorClass, fixApplied) | ExecutionSnapshot + RetryHistoryEntry + CodingTaskOutput |
| Conflict? | **NO** — different owners, different schemas, different consumers |

### Conclusion: ZERO TRUE DUPLICATES
All naming collisions are false positives — the files have completely different schemas,
interfaces, owners, and consumers.

---

## Circular Dependency Analysis

### server/memory/ import graph (outbound only)
```
memory-engine.ts
  → memory-router.ts → memory-registry.ts → memory.types.ts
  → memory-registry.ts
  → types/ (no runtime imports)

memory-store.ts (BaseMemoryStore)
  → fs (Node built-in)
  → path (Node built-in)
  → crypto (Node built-in)
  → memory.types.ts

domain stores (e.g. decision-store.ts)
  → memory-store.ts
  → memory.types.ts
  → uuid (npm)
```

**server/memory/ imports ZERO files from:**
- server/agents/*
- server/orchestration/*
- server/chat/*
- server/tools/*
- server/infrastructure/*

### After integration: agent → memory-engine dependency direction
```
server/agents/[agent]/[agent]-agent.ts
  → server/memory/core/memory-engine.ts  ← NEW (outbound only)
    → memory-router → memory-registry → domain stores → BaseMemoryStore → Node built-ins
```

**RESULT: NO CIRCULAR DEPENDENCY POSSIBLE.**
The memory graph only flows toward Node built-ins. Agents never imported by memory modules.

---

## Context Ownership Conflict Analysis

| Private System | Owner | Scope | Purpose | Conflict with memoryEngine? |
|---|---|---|---|---|
| executor/memory/working-memory | executor agent | per-run transient | Current task/step/tool outputs (hot-path) | NO — transient vs persistent |
| executor/memory/execution-history | executor agent | cross-run ring-buffer | Fix/failure patterns for retries | NO — in-process vs file-backed |
| executor/memory/failure-memory | executor agent | cross-run | Failure pattern frequency table | NO — specialized vs generic |
| executor/learning/learning-store | executor agent (shared) | cross-run | Scored intelligence (governance-gated) | NO — scored tuning vs categorized entries |
| coderx/memory/working-memory | coderx agent | per-run | Coding context + plan | NO — transient vs persistent |
| coderx/memory/execution-history | coderx agent | per-run | Step snapshots + retries | NO — per-run vs cross-run |
| orchestration/orchestration-replay | orchestration | per-run | Phase checkpoints (not memory) | NO — state machine vs memory |
| orchestration/execution-result-registry | orchestration | per-run | Run stats (not memory) | NO — observability vs memory |
| chat/persistence/* | chat module | DB-backed | Message/run/conversation storage | NO — DB I/O vs memory platform |

**RESULT: ZERO OWNERSHIP CONFLICTS.**

---

## Integration Safety Verdict

| Check | Result |
|---|---|
| Duplicate memory system | NONE |
| Circular dependency | NONE |
| Ownership conflict | NONE |
| Bootstrap called | NOT YET — must add to main.ts |
| memoryEngine used by any agent | NOT YET — all agents are clean insertion points |

**VERDICT: SAFE TO INTEGRATE.**

Conditions:
1. Call `bootstrapMemory()` in `main.ts` before `loadAllTools()` and `initOrchestration()`
2. Inject `memoryEngine` via import in agent entry points only
3. All `memoryEngine.store()` calls must be fire-and-forget (`.catch(console.error)`)
4. Never import sub-modules — only `server/memory/core/memory-engine.ts`
5. Never replace any private memory module
