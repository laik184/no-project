---
name: Memory platform design
description: server/memory/ — 62-file production memory system; key patterns and non-obvious constraints.
---

## The record() vs create() pattern (critical)

Domain stores CANNOT override `create(input: CreateEntryInput)` from BaseMemoryStore with a narrower
type like `create(input: CreateDecisionInput)` — TypeScript's method contravariance blocks this.

**Fix applied**: All domain stores use `record(input: DomainInput)` for their typed creation method.
The inherited `create(CreateEntryInput)` from BaseMemoryStore remains for registry-level generic creation.

**Why**: TypeScript requires overrides to accept at least as broad a type as the base. Narrowing
parameter types in a subclass override is a type error (TS2416).

**How to apply**: Any new domain store added must follow the same pattern: use `record()` for its
typed domain-specific input, never override `create()`.

## No external dependencies

The entire system uses only Node.js built-ins (fs, crypto, events, path). No LLM calls, no Drizzle,
no external packages. Persistence = JSON files to `.data/memory/{category}/store.json`.

**Why**: Forbidden from touching server/database/, shared/schema.ts, or any other module. File-based
JSON is non-fatal on failure (persistence errors are caught and swallowed).

## Bootstrap is a one-call setup

`bootstrapMemory()` in `server/memory/bootstrap.ts` must be called once at application startup.
It registers all 11 domain stores with the MemoryRegistry and starts the TTL eviction timer.

Calling it twice is safe (idempotent guard via `booted` flag), but the MemoryRegistry will throw
on duplicate registrations — so the guard is critical.

## Architecture constraint: memory never calls agents

No file in server/memory/ imports from server/agents/, server/tools/, server/orchestration/, or
server/chat/. This is a hard constraint — enforced by the dependency audit in the report.

Correct flow: Agent → memoryEngine.search/store/retrieve → data returned to agent.

## File persistence layout

```
.data/memory/
  {category}/store.json          ← active entries for each domain store
  knowledge-graph/
    entities.json
    relationships.json
  archive/
    {category}.json               ← archived entries from compression passes
  checkpoints/
    {snap-id}.json                ← full memory snapshots
```
