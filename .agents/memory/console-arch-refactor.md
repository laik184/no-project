---
name: Console Architecture Refactor
description: 10-issue console architecture repair — shared types, persistence layer, circular dep break, layer violation fixes.
---

# Console Architecture Refactor

## Rule
The console domain follows a strict 5-layer hierarchy with no upward or layer-skipping imports:

```
Controller (console/api/)
    ↓
Service (services/console/)
    ↓
Repository (repositories/console/)
    ↓
Persistence (console/persistence/)
    ↓
Infrastructure (infrastructure/)
```

Shared state lives in `server/shared/console/` — zero application imports.

## Key Decisions

**Shared types moved to `server/shared/console/types.ts`.**
Why: Repositories needed console types but `Repository → Console` is forbidden. Shared is the correct layer for cross-cutting types with no app deps.

**In-memory stores in `server/shared/console/runtime-state.ts` and `session-state.ts`.**
Why: Both console runtime modules (crash-recovery, health-monitor, runtime-manager) and repositories (runtime-repository, session-repository) need the same mutable Maps. Sharing through `server/shared/` avoids the Console→Repository or Repository→Console violations that DI or store duplication would create.

**Persistence layer at `server/console/persistence/`.**
Why: Repositories must depend on persistence, not infrastructure directly. The postgres stores wrap `db` from `infrastructure/index.ts` (public API only). Redis and file stores are stubs ready for activation.

**Circular dependency broken: `console/index.ts` no longer re-exports services.**
Before: `console/index.ts → services/index.ts → console/index.ts` (circular)
After: `console/index.ts` exports only internal console APIs. Services import from `console/index.ts`. `main.ts` imports `consoleService` from `services/console/index.ts` directly.

**Infrastructure imports: always use `infrastructure/index.ts`, never sub-paths.**
Affects: `console/events/`, `console/runtime/` — all now import `bus` from `infrastructure/index.ts`.

**Redis and Queue added to `server/infrastructure/`.**
Both are stub/null implementations that activate when `REDIS_URL` is set. Exported from `infrastructure/index.ts`.

## Path depth rules for `server/shared/console/`
From `server/console/` (1 level deep): `../shared/console/`
From `server/console/events/`, `runtime/`, `streaming/` (2 levels): `../../shared/console/`
From `server/console/persistence/postgres/`, `redis/`, `file/` (3 levels): `../../../shared/console/`
From `server/repositories/console/`, `server/services/console/` (2 levels): `../../shared/console/`

## How to apply
Any new module in the console domain must:
1. Import types from `server/shared/console/types.ts`
2. Import state stores from `server/shared/console/runtime-state.ts` or `session-state.ts`
3. Import infrastructure only via `server/infrastructure/index.ts` (never sub-paths)
4. Never let console modules import from repositories
5. Never let repositories import from console domain files (shared/ is OK)
6. Services import console internals only through `server/console/index.ts`
