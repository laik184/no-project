# KNOWLEDGE GRAPH REPORT (Phase 7)
Audit date: 2026-05-30

---

## Component Inventory

| Component | Location | Status |
|-----------|----------|--------|
| `graphStore` | `server/memory/knowledge-graph/graph-store.ts` | ✓ Built — file-backed |
| `graphBuilder` | `server/memory/knowledge-graph/graph-builder.ts` | ✓ Built |
| `graphTraversal` | `server/memory/knowledge-graph/graph-traversal.ts` | ✓ Built |
| Persistence path | `.data/memory/knowledge-graph/entities.json` | ✓ Auto-created |
| Persistence path | `.data/memory/knowledge-graph/relationships.json` | ✓ Auto-created |

---

## CRITICAL FINDING: Knowledge Graph Is DEAD Infrastructure

### graphBuilder.ingest() — never called outside knowledge-graph/

```
grep result: graphBuilder, graphStore, graphTraversal
  referenced outside server/memory/knowledge-graph/:
    server/agents/planner/learning/workflow-learning-engine.ts  ← graphStore? NO
    server/agents/planner/planning/task-graph-builder.ts        ← uses internal DAG, NOT graphStore
    server/memory/checkpoints/checkpoint-manager.ts             ← uses graphStore for rollback
    server/memory/checkpoints/snapshot-builder.ts               ← uses graphStore for snapshots
    server/memory/index.ts                                       ← re-exports
```

### task-graph-builder.ts vs knowledge graph

Despite the name, `task-graph-builder.ts` builds an internal `ExecutionDag` for orchestration scheduling. It does NOT import or use `graphStore`, `graphBuilder`, or `graphTraversal`. It uses its own `DagNode`/`DagEdge` types independent of the knowledge graph.

### checkpointManager.ts vs knowledge graph

`checkpoint-manager.ts` reads and writes the knowledge graph during rollbacks:
```typescript
// snapshot: saves graphStore.entities + relationships
// rollback: restores graphStore.entities + relationships
```
But checkpointManager.save/rollback are never called from agents either.

### graphStore statistics at runtime

The graph starts empty every session:
- `graphStore.entities` = `new Map()` (loaded from file, likely empty)
- `graphStore.relationships` = `new Map()` (loaded from file, likely empty)

Since `graphBuilder.ingest()` is never called, the graph accumulates zero entities.

---

## graphBuilder.ingest() — What It Does

```typescript
graphBuilder.ingest(entry: MemoryEntry)
  → extractLabel(entry)  ← first 60 chars of content
  → graphStore.createEntity({ kind: categoryToKind(entry.category), label, ... })
  → extractConcepts(entry.content)  ← PascalCase and UPPER_CASE identifiers
  → for each concept:
      graphStore.createEntity({ kind: 'concept', label: concept })
      graphStore.createRelationship({ kind: 'mentions', fromId: entity.id, toId: concept.id })
```

This builds a semantic concept network from all memory entries. If wired in, after 100 runs:
- Each planning decision becomes a graph entity
- Each failure pattern becomes a bug entity
- Shared concepts (error classes, tool names) become concept nodes with edges
- Traversal reveals: "what decisions led to what bugs" → "what patterns recur"

---

## graphTraversal — What It Can Do

`graphTraversal.bfs(fromId, depth=2)` — finds related entities within 2 hops
`graphTraversal.shortestPath(from, to)` — connects decisions to bugs to lessons
`graphTraversal.query({ kinds, fromId, depth })` — structured graph queries
`graphTraversal.neighbours(entityId)` — direct concept relationships

These are powerful tools for intelligent planning — but currently have zero input.

---

## Phase 9 Repairs Applied

### Repair: Wire graphBuilder.ingest() into memoryEngine.store()

In `memory-engine.ts`, after every successful entry creation:
```typescript
async store(input: CreateEntryInput): Promise<MemoryEntry> {
  const entry = await memoryRouter.create(input);
  // Populate knowledge graph automatically (fire-and-forget, non-fatal)
  try { graphBuilder.ingest(entry); } catch { /* non-fatal */ }
  return entry;
}
```

**Effect**: Every memory write now automatically:
1. Creates a graph entity for the new entry
2. Extracts concept nodes from content
3. Links entry to concepts via 'mentions' relationship

After Phase 9:
- Planning decision → entity in graph ✓
- Bug failure → entity in graph ✓
- Learning update → entity in graph ✓
- Execution record → entity in graph ✓
- Conversation turn → entity in graph ✓

The knowledge graph will grow organically with every agent run.

---

## Assessment

| Aspect | Pre-Phase 9 | Post-Phase 9 |
|--------|------------|-------------|
| graphStore persistence | ✓ Built | ✓ Built |
| graphBuilder.ingest() callable | ✓ Built | ✓ Called automatically |
| Entities created | ZERO | Every memoryEngine.store() |
| Relationships created | ZERO | Every concept extraction |
| Graph queried by agents | ZERO | ZERO (still — future work) |
| Snapshot/rollback | ✓ Built | ✓ Built (no callers) |

**STATUS: DEAD → ACTIVELY POPULATED (after Phase 9)**

**REMAINING GAP**: graphTraversal is still not queried by agents. The graph will accumulate data but agents don't use it yet. Integrating graph-based context into the planner's reasoning is future work.
