# Memory Design Doc

> How NURAX remembers what it has learned — the architecture of the persistent, searchable long-term memory platform that keeps agents context-aware across sessions.

---

## Why Memory?

Without memory, every agent run starts from zero. The same mistakes get repeated, the same architecture decisions get re-litigated, and the same bugs get reintroduced. NURAX's memory platform gives agents access to:

- **Past architecture decisions** — "we chose Drizzle over Prisma because…"
- **Known failure patterns** — "React Query v5 requires object form"
- **Lessons learned mid-session** — mistakes made and corrected during a run
- **Project-specific context** — folder structure, conventions, recurring patterns

---

## Architecture at a Glance

```
Agent calls buildMemoryContext(projectId)
            │
            ▼
    Memory Repository
    ┌──────────────────────────────────────┐
    │  1. Embed query → 128-dim vector     │
    │  2. Cosine similarity search         │
    │  3. + Keyword scoring (TF-style)     │
    │  4. + Exact phrase boost             │
    │  5. Return top-K ranked chunks       │
    └──────────────────────────────────────┘
            │
            ▼
    Formatted context string
    injected into agent prompt


Agent saves a lesson via memoryRepository.save(input)
            │
            ▼
    Memory Repository
    ┌──────────────────────────────────────┐
    │  1. Chunk content by type            │
    │  2. Embed each chunk → vector        │
    │  3. Upsert into VectorStore (RAM)    │
    │  4. Persist to JSON file (disk)      │
    └──────────────────────────────────────┘
```

---

## Layers

### Layer 1 — Vector Store (in-memory)

**File:** `server/memory/vector/vector-store.ts`

An in-memory `Map<string, VectorRecord>`. This is the operational store — all reads and writes during a session hit here.

```typescript
interface VectorRecord {
  id: string;
  vector: Float32Array;   // 128 dimensions, L2-normalised
  metadata: {
    projectId: number;
    content: string;
    type: 'decision' | 'lesson' | 'pattern' | 'context';
    createdAt: string;
    tags: string[];
  };
}
```

Fast: lookups and similarity scans are pure JavaScript, sub-millisecond for thousands of records.

### Layer 2 — Persistent Store (disk)

**File:** `server/memory/persistence/vector-store-adapter.ts`

Serialises the in-memory `VectorRecord` map to JSON at:

```
{AGENT_PROJECT_ROOT}/.nurax-memory/vector-store.json
```

Every `save()` call triggers an immediate sync to disk — there is no async write-behind queue. This makes the persistence layer simple and crash-safe at the cost of slightly higher write latency (acceptable given write frequency).

### Layer 3 — Memory Repository (orchestrator)

**File:** `server/memory/repositories/memory-repository.ts`

The single public interface agents use. Coordinates chunking → embedding → store → persist.

### Layer 4 — Embedding Layer

**File:** `server/memory/embedding/`

Uses a **`HashEmbeddingProvider`** — a local, deterministic hash-based TF-IDF embedding that produces 128-dimensional L2-normalised vectors.

Why not an embedding API (OpenAI, Cohere, etc.)?
- No latency, no cost, no rate limits
- Fully offline — memory works even without an LLM key
- 128 dims is sufficient for the document scale NURAX operates at (hundreds, not millions, of records per project)

---

## Bootstrap

**File:** `server/memory/index.ts`

`bootstrapMemory()` is called during server startup (Phase 3 in `main.ts`). It calls `memoryRepository.init()` → `hydrateVectorStore()`:

```
Startup
  └── bootstrapMemory()
        └── memoryRepository.init()
              └── hydrateVectorStore()
                    └── Read .nurax-memory/vector-store.json
                          └── Load all records into VectorStore (RAM)
```

By the time the first HTTP request arrives, the full memory corpus is in RAM and searchable.

---

## Write Path (Save)

```typescript
await memoryRepository.save({
  projectId: 1,
  content: "Chose Drizzle ORM because it has better TypeScript inference than Prisma",
  type: "decision",
  tags: ["orm", "database", "architecture"]
});
```

Internally:

1. **Chunk** — splits `content` by type:
   - `code` → split on function/class boundaries
   - `markdown` → split on headings
   - `json` → split on top-level keys
   - `text` → split on paragraph breaks (default)
2. **Embed** — `HashEmbeddingProvider.embed(chunk)` → `Float32Array[128]`
3. **Upsert** — `vectorStore.upsert(id, vector, metadata)` (overwrites if same id)
4. **Persist** — serialise full map → write to `.nurax-memory/vector-store.json`

---

## Read Path (Search)

```typescript
const context = await memoryRepository.search({
  query: "database ORM choice",
  projectId: 1,
  topK: 5
});
```

Internally — **Hybrid Retrieval**:

1. **Embed query** — `HashEmbeddingProvider.embed(query)` → query vector
2. **Cosine similarity** — scan all records, compute `dot(queryVec, recordVec)` (vectors are pre-normalised, so dot product = cosine similarity)
3. **Keyword scoring** — add TF-style score: count of query terms appearing in `content`, weighted by inverse document frequency
4. **Phrase boost** — exact phrase matches in `content` receive a rank-boost multiplier
5. **Filter** — results filtered to `projectId` scope
6. **Top-K** — return the K highest-scored `VectorRecord` objects

### Why Hybrid?

Pure vector search can miss obvious keyword matches when the embedding model is weak (hash-based embeddings are not semantic). Pure keyword search misses paraphrase and related concepts. Combining both gives strong recall for NURAX's small-to-medium corpus size.

---

## Context Formatting

**File:** `server/memory/index.ts` → `buildMemoryContext(projectId)`

Converts search results into the string injected into agent prompts:

```
Past architecture decisions:
- [decision] Chose Drizzle ORM over Prisma (2024-06-10): better TypeScript inference

Known failure patterns:
- [pattern] React Query v5: useQuery requires object form { queryKey: [...] }

Recent lessons:
- [lesson] Always run `npx drizzle-kit push` before starting dev server after schema changes
```

This string is appended to the **user turn** of LLM messages (not the system prompt) so the model treats it as project-specific runtime context, not permanent instructions.

---

## Memory Record Types

| Type | When written | Example content |
|---|---|---|
| `decision` | After Planner/Supervisor resolves an architecture question | "Chose Tailwind over CSS Modules because…" |
| `lesson` | After Verifier detects and corrects an error | "tsc failed because of missing await — CoderX fixed by adding async" |
| `pattern` | After CoderX identifies a recurring code pattern | "All API routes use `{ ok, data, error }` envelope" |
| `context` | After Filesystem agent scans the project | "Project uses Vite + React + Drizzle, entry at client/src/main.tsx" |

---

## Storage Location

```
{AGENT_PROJECT_ROOT}/
└── .nurax-memory/
    └── vector-store.json     ← all VectorRecords, serialised
```

Default `AGENT_PROJECT_ROOT` is `/home/runner/workspace/.sandbox` (configurable via env var).

Each project's records are scoped by `projectId` inside the single JSON file. Future work could split into per-project files for isolation.

---

## Key Files Reference

| File | Role |
|---|---|
| `server/memory/index.ts` | Public API: `bootstrapMemory`, `buildMemoryContext` |
| `server/memory/repositories/memory-repository.ts` | Main controller — coordinates all layers |
| `server/memory/vector/vector-store.ts` | In-memory Map store |
| `server/memory/persistence/vector-store-adapter.ts` | JSON file I/O |
| `server/memory/embedding/` | `HashEmbeddingProvider` — 128-dim local embeddings |
| `server/memory/chunking/` | Content-type-aware text splitters |
