# server/memory/ — Folder Structure & Workflow Report

## Overview

`server/memory/` ek multi-layered memory platform hai jo Nura-X agent system ke liye
persistent storage, retrieval, reflection, aur knowledge graph manage karta hai.

---

## Folder Structure

```
server/memory/
├── index.ts                          # Public entry point — bootstrapMemory() export
├── bootstrap.ts                      # Startup: stores register karta hai, reflection schedule karta hai
├── core/
│   ├── memory-engine.ts              # Main public API: store(), recall(), search()
│   ├── memory-router.ts              # Category ke basis pe sahi store ko dispatch karta hai
│   ├── memory-registry.ts            # Sabhi domain stores ka central registry
│   ├── memory-manager.ts             # TTL eviction aur store lifecycle manage karta hai
│   └── memory-store.ts               # BaseMemoryStore — abstract base class (JSON file persistence)
│
├── architecture-memory/              # System components aur architectural patterns store karta hai
├── decision-memory/                  # Architectural/product decisions (context, rationale, outcome)
├── bug-memory/                       # Identified bugs aur failure patterns
├── learning-memory/                  # Agent capabilities aur learned behaviors
├── execution-memory/                 # Historical execution traces
├── conversation-memory/              # Chat history aur context
├── business-memory/                  # Business-level domain data
├── revenue-memory/                   # Revenue related entries
├── prediction-memory/                # Future state predictions
├── user-feedback-memory/             # User feedback entries
│
├── retrieval/
│   ├── retrieval-engine.ts           # Search pipeline orchestrator
│   ├── semantic-search.ts            # Semantic/embedding based search
│   ├── vector-search.ts              # Vector similarity search
│   ├── hybrid-search.ts              # Keyword + semantic combined search
│   └── reranker.ts                   # Results ko relevance score se refine karta hai
│
├── reflection/
│   └── reflection-engine.ts          # Har 5 min mein execution/bug data se lessons extract karta hai
│
├── knowledge-graph/
│   └── graph-builder.ts              # Memory entries se entities (nodes) aur relationships (edges) banata hai
│
├── checkpoints/                      # Memory state ke snapshots — rollback support
├── compression/                      # Memory entries ko summarize/cluster karta hai (context window ke liye)
└── bootstrap/                        # Server startup pe disk se in-memory state restore karta hai
```

---

## Har File Ka Kaam

| File / Folder | Kaam |
|---|---|
| `index.ts` | `bootstrapMemory()` export karta hai — `main.ts` yahi call karta hai |
| `bootstrap.ts` | Sabhi stores ko registry mein register karta hai, reflection engine schedule karta hai |
| `core/memory-engine.ts` | Top-level API: `store()`, `recall()`, `search()` — agents yahi use karte hain |
| `core/memory-router.ts` | `MemoryCategory` ke basis pe sahi domain store dhundta hai |
| `core/memory-registry.ts` | Sabhi registered stores ka map rakhta hai |
| `core/memory-manager.ts` | TTL-expired entries ko periodically delete karta hai |
| `core/memory-store.ts` | Base class — JSON file mein read/write, CRUD, keyword search, TTL |
| `*-memory/` folders | Domain-specific stores — BaseMemoryStore extend karte hain |
| `retrieval/` | Hybrid search pipeline — keyword + semantic + reranking |
| `reflection/` | Background LLM-based lesson extraction har 5 minute mein |
| `knowledge-graph/` | Concepts aur unke relationships ka graph banata hai |
| `checkpoints/` | Memory state ka snapshot lena aur restore karna |
| `compression/` | Purani entries summarize karna taaki context window na bhare |
| `bootstrap/` | Disk se memory hydrate karna startup pe |

---

## Workflow / Data Flow

### 1. Bootstrap (Server Start)
```
main.ts
  └── bootstrapMemory()
        └── bootstrap.ts
              ├── Sabhi domain stores register karo memoryRegistry mein
              ├── memoryManager start karo (TTL eviction loop)
              └── reflectionEngine schedule karo (har 5 min)
```

### 2. Data Store (Save Flow)
```
Agent / Orchestrator
  └── memoryEngine.store(input)
        ├── memoryRouter → sahi domain store dhundo
        ├── store.save(entry) → disk pe JSON file mein save
        └── graphBuilder.ingest(entry) → knowledge graph update [async]
```

### 3. Data Recall (Search Flow)
```
Agent / Orchestrator
  └── memoryEngine.recall(text)
        └── retrievalEngine.search(text)
              ├── Sabhi stores se candidates nikalo
              ├── hybridSearch (keyword + semantic scoring)
              └── reranker → top relevant entries return karo
```

### 4. Reflection (Background Flow)
```
Har 5 minute mein:
reflectionEngine.run()
  ├── executionStore se nayi traces lo
  ├── bugStore se nayi failures lo
  ├── LLM se lessons/patterns extract karo
  └── reflectionStore mein save karo
```

### 5. Knowledge Graph (Side Effect)
```
Har store() call ke baad:
graphBuilder.ingest(entry)
  ├── Entities (nodes) extract karo entry se
  └── Relationships (edges) link karo existing nodes se
```

---

## Summary

```
Agents
  │
  ▼
MemoryEngine  ──► MemoryRouter ──► Domain Store (e.g. DecisionStore)
  │                                      │
  │                                      ▼
  │                               FileSystem (.data/memory/*.json)
  │
  ├──► Knowledge Graph  (relational queries)
  └──► Reflection Engine (LLM-based pattern learning, every 5 min)
```

**Storage:** `.data/memory/*.json` files pe JSON format mein
**Search:** Hybrid (keyword + semantic) with reranking
**Learning:** Reflection engine automatically patterns extract karta hai
**Cleanup:** TTL-based eviction stale entries hataati hai
