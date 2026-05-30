# MEMORY ENGINE AUDIT (Phase 1)
Audit date: 2026-05-30 | Source: server/memory/core/

---

## 1. Component Inventory

| File | Role | Status |
|------|------|--------|
| `memory-engine.ts` | Public facade — single consumer entry point | ✓ FUNCTIONAL |
| `memory-router.ts` | Routes CRUD + search to correct store by category | ✓ FUNCTIONAL |
| `memory-registry.ts` | Register/get stores by MemoryCategory | ✓ FUNCTIONAL |
| `memory-store.ts` (BaseMemoryStore) | Abstract base: CRUD + file-backed persistence + TTL eviction | ✓ FUNCTIONAL |
| `memory-manager.ts` | Boots eviction interval (default 60s) | ✓ FUNCTIONAL |

---

## 2. Registration Verification

bootstrap.ts registers **11 stores** in this order:
1. `decision` → `DecisionStore`
2. `architecture` → `ArchitectureStore`
3. `bug` → `BugStore`
4. `business` → `BusinessStore`
5. `user-feedback` → `FeedbackStore`
6. `revenue` → `RevenueStore`
7. `learning` → `LearningStore` (platform store, not executor's)
8. `prediction` → `PredictionStore`
9. `execution` → `ExecutionStore`
10. `conversation` → `ConversationStore`
11. `reflection` → `ReflectionStore`

**Server boot log confirms**: `[memory] Platform ready — 11 stores registered` ✓

---

## 3. Routing Verification

`memoryRouter.create(input)` → `memoryRegistry.get(input.category).create(input)` ✓

All operations (`get`, `update`, `delete`, `list`, `search`, `count`) route correctly through registry. `searchAll()` fans out across all registered categories and merges by score.

**POTENTIAL FAILURE MODE**: `memoryRegistry.get()` THROWS if category not registered. Unregistered category writes/reads cause 500 errors. All 11 registered categories are safe. MemoryCategory type includes `checkpoint` which is NOT registered — writing to `checkpoint` via memoryEngine would throw.

---

## 4. Persistence Verification

`BaseMemoryStore.persist()` uses **synchronous** `writeFileSync` to:
```
.data/memory/{category}/store.json
```
- File created on first write ✓
- Loaded in constructor (`load()`) on server startup ✓
- Restart-safe: data survives server restarts ✓
- TTL eviction: `memoryManager` calls `store.evictStale()` every 60s ✓
- Failure tolerance: persist/load errors are silently swallowed — in-memory state remains authoritative ✓

**VERIFIED**: `.data/memory/` directory structure is created automatically via `mkdirSync({ recursive: true })` ✓

---

## 5. Store Method Verification

### memoryEngine.store(input) — CREATE
```
memoryEngine.store(input)
  → memoryRouter.create(input)
  → registry.get(category).create(input)
  → BaseMemoryStore.create(input)
    → buildEntry(input)  ← only base MemoryEntry fields populated
    → store.set(entry.id, entry)
    → persist()  ← synchronous writeFileSync
  ← MemoryEntry (fully typed base)
```
**STATUS**: Works correctly. **CRITICAL GAP**: Bypasses domain-specific `record()` methods — domain-typed fields (runId, success, agentType, recurrence, errorType, rootCause, fix) are NOT set.

### memoryEngine.retrieve(category, id) — GET
```
memoryEngine.retrieve(category, id)
  → memoryRouter.get(category, id)
  → registry.get(category).get(id)
  → store.get(id) via Map<string, T>
  ← MemoryEntry | undefined
```
**STATUS**: Works. **USAGE**: ZERO callers outside memory/ itself.

### memoryEngine.search(query) — SEARCH ALL
```
memoryEngine.search(query)
  → memoryRouter.searchAll(query)
  → fans out to all categories (or query.categories subset)
  → each store.search(text, limit) — keyword tokenizer
  ← SearchResult with ranked RankedResult[]
```
**STATUS**: Works (keyword-only). **USAGE**: ZERO callers outside memory/.

### memoryEngine.searchCategory(category, text, limit) — SEARCH ONE
**STATUS**: Works. **USAGE**: ZERO callers outside memory/.

### memoryEngine.list(category, filter) — LIST
**STATUS**: Works. Supports filter by tags, score range, time range, TTL exclusion. **USAGE**: ZERO callers outside memory/.

---

## 6. Retrieval Engine Verification

`server/memory/retrieval/retrieval-engine.ts` provides:
- Semantic search (keyword TF-IDF style scoring)
- Vector search (cosine similarity over mock vectors)  
- Hybrid search (semantic + vector combined)
- Reranking

**STATUS**: Internally complete. **USAGE**: ZERO callers. `memoryEngine.search()` uses the basic `store.search()` keyword method instead of the full retrieval pipeline. The retrieval engine is idle infrastructure.

---

## 7. Critical Bugs Found

### Bug 1: Domain-typed fields not populated via generic create()
When agents call `memoryEngine.store({ category: 'execution', content: '...', ... })`, the resulting `ExecutionEntry` has:
- `entry.runId === undefined` — `executionStore.byRun(runId)` returns empty
- `entry.success === undefined` — `executionStore.recentFailures()` treats ALL entries as failures (`!undefined === true`)
- `entry.agentType === undefined` — `executionStore.byAgent()` returns empty

When verifier calls `memoryEngine.store({ category: 'bug', ... })`:
- `entry.recurrence === undefined` — `bugStore.topRecurring()` sorts by NaN → arbitrary order
- `entry.errorType === undefined`
- `entry.rootCause === undefined`
- `entry.resolved === undefined` — `bugStore.unresolved()` treats ALL as unresolved

**Impact**: Reflection engine's `bugStore.topRecurring()` and `executionStore.recentFailures()` return unreliable results.

### Bug 2: 'checkpoint' category in MemoryCategory type but not registered
Writing to category `checkpoint` via memoryEngine throws: `[memory-registry] No store registered for category: "checkpoint"`. No callers currently use it but it's a latent crash risk.

---

## 8. Summary

| Capability | Status |
|---|---|
| Store registration | ✓ WORKING — 11 stores |
| Routing | ✓ WORKING — category-based dispatch |
| Create / persist | ✓ WORKING — sync writeFileSync |
| Retrieval / get | ✓ WORKING — but ZERO users |
| Search | ✓ WORKING (basic) — but ZERO users |
| Retrieval engine | ✓ BUILT — but ZERO users |
| Domain-typed records | ✗ BYPASSED — generic create() used |
| Knowledge graph wiring | ✗ MISSING — graphBuilder.ingest() never called |
| Reflection trigger | ✗ MISSING — reflectionEngine never called |
| Memory reads by agents | ✗ ZERO — write-only from agent perspective |
