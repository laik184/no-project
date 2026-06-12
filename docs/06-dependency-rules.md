# Dependency Rules

## Current intended dependency direction

**INFERRED from module comments and implementation**:

```text
Frontend components/pages
  → frontend services/hooks/state
  → HTTP/SSE/WS contracts
  → Express routes/controllers
  → services/orchestrators
  → repositories/runtime managers
  → infrastructure/db/filesystem/process/bus
```

For agent execution:

```text
Chat controller
  → chat orchestrator
  → orchestration layer
  → agents/workflow runners
  → tool dispatcher
  → tool implementations
  → infrastructure/filesystem/process/browser/git/db
```

## Allowed dependencies

### Frontend

- **Allowed**: pages/components may import UI components, hooks, contexts, client services, and shared frontend types.
- **Allowed**: frontend may communicate with backend through HTTP/SSE/WS endpoints only.
- **Forbidden**: frontend must not import server modules or shared database schema directly unless transformed into API DTOs.

### Route/controller layer

- **Allowed**: import validation schemas, services, orchestrators, repositories through public module surfaces, and Express types.
- **Allowed**: translate HTTP request/response shapes.
- **Forbidden**: direct process spawning, direct tool execution, direct sandbox mutation, or complex business logic in controllers.

### Service/orchestrator layer

- **Allowed**: coordinate repositories, domain services, memory, event publishers, and orchestration/tool abstractions.
- **Allowed**: own transaction-like workflows and failure policies.
- **Forbidden**: bypassing tool dispatch for agent side effects unless the service explicitly owns that domain.

### Repository layer

- **Allowed**: import DB infrastructure and schema.
- **Allowed**: map DB rows to domain models.
- **Forbidden**: import controllers, frontend, or high-level orchestrators.

### Infrastructure layer

- **Allowed**: low-level libraries such as `pg`, process/runtime utilities, event emitters, Redis, queues, filesystem helpers.
- **Forbidden**: import feature controllers or UI modules.

### Tool layer

- **Allowed**: tool implementations may use infrastructure required for their side effect.
- **Allowed**: dispatcher may emit events, record metrics, enforce permissions, and reality-check outputs.
- **Forbidden**: registering tools outside the boot-time tool loader after the registry is sealed.

### Orchestration layer

- **Allowed**: validate, plan, coordinate workflow runners, call agent/dispatcher abstractions, record metrics/memory.
- **Forbidden**: direct shell/file/browser side effects in the top-level orchestrator. Its own comment says it should be orchestration-only.

## Existing violations or weak boundaries

### Direct DB in `main.ts`

**FACT**: `main.ts` directly imports `db`, `projects`, `desc`, and `eq` and implements project CRUD inside route mounting.

**Impact**: Project business rules and validation are not reusable by agents/services and cannot be tested independently.

**Rule**: Move project CRUD to a project controller/service/repository module.

### In-memory folders in `main.ts`

**FACT**: Folders are process-local variables inside `registerRoutes()`.

**Impact**: Data is lost on restart and cannot scale horizontally.

**Rule**: Folder state must be persisted through schema/repository or removed until implemented.

### UI-to-missing-API coupling

**FACT**: Import and metrics UI calls unmounted API endpoints.

**Impact**: Visible product flows fail at runtime.

**Rule**: A route used by UI must be mounted, feature-flagged, or replaced with an explicit unavailable state.

### Multiple DB entrypoints

**FACT**: `server/infrastructure/db/index.ts` is non-throwing at import time, while `server/db.ts` throws if `DATABASE_URL` is absent.

**Impact**: Importing the wrong DB module can crash at module evaluation and violates the newer infrastructure startup rule.

**Rule**: Use the infrastructure DB barrel consistently; deprecate or remove legacy `server/db.ts` after migration.

## Public API/barrel rules

- **FACT**: Several modules expose public barrels: infrastructure, terminal, preview, memory, tools, chat.
- **Rule**: Consumers should import from public barrels unless a module explicitly marks an internal path as safe.
- **Rule**: Do not create new `index.ts` files blindly; only expose stable public APIs.
- **Rule**: Tool registrations should stay centralized in `server/tools/registry/tool-loader.ts`.

## Circular dependency risk areas

**INFERRED**: High-risk areas are event bus ↔ chat realtime ↔ infrastructure, preview runtime ↔ infrastructure runtime manager, and orchestration ↔ agents ↔ tools ↔ memory.

**Required checks**:

- Run TypeScript compile checks.
- Add an import graph/circular dependency audit to CI.
- Enforce dependency direction with lint rules or an architecture test.
