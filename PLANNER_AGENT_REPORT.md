# NURA-X Planner Agent — Deep Scan Report

**System:** `server/agents/planner/`
**Total Files:** 39 TypeScript files
**Total Lines:** ~2,365 lines
**Architecture:** Modular, single-responsibility, zero code duplication

---

## 📁 Complete Folder Structure

```
server/agents/planner/
│
├── planner-agent.ts                  ← PUBLIC API ENTRY POINT
│
├── types/                            ← Type contracts (shared across all layers)
│   ├── planner.types.ts
│   └── planning.types.ts
│
├── events/                           ← Event bus & handlers
│   ├── event-types.ts
│   ├── planner-events.ts
│   └── event-handlers.ts
│
├── telemetry/                        ← Logging & metrics
│   ├── planner-logger.ts
│   └── planner-metrics.ts
│
├── utils/                            ← Pure utility functions
│   ├── planning-helpers.ts
│   ├── graph-utils.ts
│   └── validators.ts
│
├── analysis/                         ← Goal understanding layer
│   ├── goal-analyzer.ts
│   ├── app-classifier.ts
│   ├── requirement-extractor.ts
│   └── complexity-estimator.ts
│
├── architecture/                     ← Architecture generation layer
│   ├── frontend-planner.ts
│   ├── backend-planner.ts
│   ├── database-planner.ts
│   ├── api-planner.ts
│   └── deployment-planner.ts
│
├── decomposition/                    ← Plan decomposition layer
│   ├── phase-builder.ts
│   ├── task-breakdown.ts
│   ├── dependency-graph.ts
│   └── milestone-generator.ts
│
├── sequencing/                       ← Execution ordering layer
│   ├── execution-order.ts
│   ├── task-prioritizer.ts
│   └── pipeline-sequencer.ts
│
├── validation/                       ← Plan validation & safety layer
│   ├── dependency-validator.ts
│   ├── circular-check.ts
│   └── plan-validator.ts
│
├── templates/                        ← App-type specific templates
│   ├── saas-template.ts
│   ├── crud-template.ts
│   ├── ai-app-template.ts
│   ├── auth-template.ts
│   └── dashboard-template.ts
│
└── core/                             ← Core orchestration layer
    ├── planning-state.ts
    ├── planning-context.ts
    ├── planning-session.ts
    └── planner-engine.ts
```

---

## 📄 File-by-File Breakdown

### `planner-agent.ts` — Public API Entry Point
**Role:** The single public interface for the entire planner system. All external callers use only this file.

**Exports:**
| Function | Purpose |
|---|---|
| `initializePlanner()` | Registers event handlers, boots the system |
| `createExecutionPlan(input)` | Full planning pipeline — returns `PlannerResult` |
| `shutdownPlanner()` | Graceful shutdown, clears all sessions |

**Flow:** Validates input → Creates session → Emits events → Runs engine → Returns plan or error

---

### `types/planner.types.ts` — Core Type Contracts
**Role:** Defines every primary type used by the planner system.

| Type | Description |
|---|---|
| `AppType` | `crud \| saas \| ai_app \| ecommerce \| dashboard \| auth_system \| backend_api` |
| `PlanComplexity` | `low \| medium \| high` |
| `PlanningStatus` | `pending \| running \| completed \| failed` |
| `PhaseType` | `setup \| backend \| frontend \| verification \| deployment` |
| `TaskCategory` | `setup \| schema \| api \| auth \| ui \| test \| deploy` |
| `TaskPriority` | `critical \| high \| normal \| low` |
| `PlanTask` | Single executable task with id, phase, deps, priority, estimated time |
| `PlanPhase` | Group of tasks sharing a phase type |
| `ExecutionPlan` | The complete output — all sub-plans, phases, tasks, graph, order, milestones |
| `PlannerInput` | Input to `createExecutionPlan()` |
| `PlannerResult` | Output: `{ ok, plan?, error?, durationMs }` |

---

### `types/planning.types.ts` — Sub-Plan Type Contracts
**Role:** Types for each architecture sub-plan and analysis results.

| Type | Description |
|---|---|
| `FrontendPlan` | Framework, routing, state mgmt, UI library, pages, features |
| `BackendPlan` | Framework, language, services, middleware, modules |
| `DatabasePlan` | DB type, ORM, entities, relations, indexing |
| `ApiPlan` | Style (REST/GraphQL/tRPC), endpoints, auth strategy, rate limiting |
| `DeploymentPlan` | Platform, build/start commands, env vars, scaling |
| `GoalAnalysis` | 12 boolean feature flags extracted from the goal text |
| `Requirements` | Structured list of detected requirements (APIs, auth, search, etc.) |
| `DependencyGraph` | Nodes, directed edges, topological order |
| `Milestone` | Checkpoint marker per phase with estimated time |
| `ValidationResult` | valid flag, errors[], warnings[], checkedAt |

---

### `events/event-types.ts` — Event Type Contracts
**Role:** Defines the 4 planner events and their payload shapes.

| Event | Payload |
|---|---|
| `planning.started` | `{ runId, goal, timestamp }` |
| `planning.phase.generated` | `{ runId, phase, taskCount, timestamp }` |
| `planning.completed` | `{ runId, plan, durationMs, timestamp }` |
| `planning.failed` | `{ runId, error, durationMs, timestamp }` |

---

### `events/planner-events.ts` — Typed Event Bus
**Role:** Wraps Node.js `EventEmitter` with full TypeScript generics. Exports `plannerBus` singleton and 4 typed emit helpers.

**Reuses:** Same pattern as `orchestrationBus` from `server/orchestration/events/`.

---

### `events/event-handlers.ts` — Event Subscriptions
**Role:** Registers all listeners on `plannerBus`. Routes events to logger and metrics.

| Event Received | Action Taken |
|---|---|
| `planning.started` | Logs + records plan started metric |
| `planning.phase.generated` | Logs phase info |
| `planning.completed` | Logs + records duration metric |
| `planning.failed` | Error log + records failure metric |

---

### `telemetry/planner-logger.ts` — Structured Logger
**Role:** Thin wrapper around the existing `runLogger` from orchestration. Adds `[planner]` prefix to all messages.

**Reuses:** `server/orchestration/telemetry/run-logger.ts`

**Methods:** `info()`, `warn()`, `error()`, `debug()`, `getLogs()`

---

### `telemetry/planner-metrics.ts` — Metrics Collector
**Role:** Records 4 key metrics using the existing orchestration metrics infrastructure.

| Metric Key | Tracked When |
|---|---|
| `plans.created` | Plan starts |
| `plans.failed` | Plan fails |
| `planning.duration` | On complete or fail |
| `dependency.errors` | Invalid task dependency found |

**Reuses:** `metricsCollector`, `incrementCounter`, `recordDuration` from `server/orchestration/telemetry/metrics.ts`

---

### `utils/planning-helpers.ts` — Pure Planning Utilities
**Role:** Stateless helper functions used across the planner.

| Function | Purpose |
|---|---|
| `generatePlanId()` | `plan_<timestamp>_<uuid>` |
| `generatePhaseId(type)` | `phase_<type>_<uuid>` |
| `generateTaskId(category)` | `task_<cat>_<timestamp>_<uuid>` |
| `complexityToScore(c)` | `low→25, medium→55, high→85` |
| `scoreToComplexity(n)` | `≤35→low, ≤65→medium, else→high` |
| `appTypeLabel(t)` | Human-readable label for app type |
| `priorityForPhase(p)` | Phase → default task priority |
| `phaseOrder(p)` | Phase → sort order number |
| `containsKeyword(goal, kws)` | Case-insensitive keyword scan |

---

### `utils/graph-utils.ts` — Graph Algorithms
**Role:** Pure graph functions for dependency management.

| Function | Algorithm |
|---|---|
| `topologicalSort(nodes, edges)` | Kahn's algorithm (BFS-based) — returns `null` if cycle detected |
| `hasCycle(nodes, edges)` | Delegates to topological sort |
| `buildDependencyGraph(...)` | Builds `DependencyGraph` with topological order |
| `buildAdjacencyList(edges)` | Creates adjacency map for graph traversal |
| `getDirectDependencies(id, edges)` | Immediate dependencies of a node |
| `getTransitiveDependencies(id, edges)` | All ancestors via DFS |

---

### `utils/validators.ts` — Zod Input Validation
**Role:** Validates all external input to the planner using Zod schemas.

| Export | Purpose |
|---|---|
| `plannerInputSchema` | Zod schema for `PlannerInput` |
| `validatePlannerInput(raw)` | Throws on invalid input |
| `safeValidatePlannerInput(raw)` | Returns `{ ok, data }` or `{ ok, error }` |
| `isValidTaskId / PhaseId / PlanId` | Type guards for generated IDs |

---

### `analysis/goal-analyzer.ts` — Goal Feature Extractor
**Role:** Scans the goal string for 11 feature dimensions using keyword matching.

| Flag Detected | Keywords Scanned |
|---|---|
| `hasFrontend` | ui, page, dashboard, react, component... |
| `hasBackend` | api, server, endpoint, handler... |
| `hasDatabase` | database, db, postgres, sqlite, schema... |
| `hasAuth` | auth, login, signup, jwt, oauth... |
| `hasPayments` | payment, stripe, billing, subscription... |
| `hasRealtime` | realtime, websocket, live, sse, socket... |
| `hasAI` | ai, llm, gpt, openai, embedding... |
| `hasFileUpload` | upload, file, attachment, storage... |
| `hasSearch` | search, filter, full-text... |
| `hasAnalytics` | analytics, metrics, chart, report... |
| `hasNotifications` | notification, email, sms, sendgrid... |

**Output:** `GoalAnalysis` object + human-readable summary string

---

### `analysis/app-classifier.ts` — App Type Detector
**Role:** Scores the goal against 7 app-type categories and picks the winner.

**Scoring:**
- Each keyword set contributes +30 points to its category
- Feature flags from `GoalAnalysis` add bonus points
- No frontend → `backend_api` gets +20
- Has AI → `ai_app` +20, Has payments → `saas/ecommerce` +15

**Output:** `{ appType: AppType, confidence: number, reasoning: string }`

---

### `analysis/requirement-extractor.ts` — Requirement Parser
**Role:** Converts `GoalAnalysis` into a structured `Requirements` object.

**Extracts:**
- API style: REST (default), GraphQL, or tRPC based on keywords
- Auth strategy: JWT (default), Session, or OAuth
- Feature booleans: search, analytics, uploads, payments, notifications, realtime, AI

---

### `analysis/complexity-estimator.ts` — Complexity Scorer
**Role:** Assigns a numeric score (0–100) to the plan and maps it to `low/medium/high`.

**Base scores per app type:** crud→20, backend\_api→25, auth→30, dashboard→35, saas/ecommerce→55, ai\_app→60

**Bonus points:** auth+10, payments+15, realtime+12, AI+10, uploads+5, search+5, analytics+8, notifications+5, OAuth+5, long goal+5–10

**Output:** `{ complexity, score, estimatedTaskCount, estimatedMinutes, factors[] }`

---

### `architecture/frontend-planner.ts` — Frontend Plan Generator
**Role:** Generates `FrontendPlan` with framework, pages, and features appropriate for the detected app type.

**Stack (always):** React + Wouter + TanStack Query + shadcn/ui + Tailwind CSS

**Pages per app type:** e.g., SaaS → `[Landing, Dashboard, Settings, Billing, Profile, Team]`

**Dynamic features added:** auth-guard, live-updates, notification-bell, file-dropzone, global-search based on `GoalAnalysis` flags.

---

### `architecture/backend-planner.ts` — Backend Plan Generator
**Role:** Generates `BackendPlan` with services, middleware, and modules for the app type.

**Stack (always):** Express + TypeScript

**Dynamic additions:** AuthService/auth module if `hasAuth`, NotificationService if `hasNotifications`, StorageService if `hasFileUpload`, SearchService if `hasSearch`.

---

### `architecture/database-planner.ts` — Database Plan Generator
**Role:** Generates `DatabasePlan` with entity list, relations, and index recommendations.

**Engine:** PostgreSQL + Drizzle ORM (always, unless no DB needed)

**Entities per type:** e.g., SaaS → `[User, Workspace, Subscription, Plan, AuditLog, ApiKey]`

**Dynamic entities:** FileAttachment, Notification, AnalyticsEvent added from feature flags.

---

### `architecture/api-planner.ts` — API Plan Generator
**Role:** Generates `ApiPlan` with endpoint list, auth strategy, and API style.

**Style detection:** GraphQL/tRPC keywords → respective style, default REST

**Auth strategy:** OAuth2+JWT, session-cookie, jwt-bearer, or none

**Endpoints:** Pre-defined realistic sets per app type (5–9 endpoints each)

---

### `architecture/deployment-planner.ts` — Deployment Plan Generator
**Role:** Generates `DeploymentPlan` with platform, build/start commands, and required env vars.

**Platform selection:**
- Has realtime or AI → Replit Autoscale (sticky sessions)
- High complexity or SaaS → Replit Autoscale (horizontal)
- Otherwise → Replit Reserved VM

**Env vars:** Always includes `DATABASE_URL, NODE_ENV, PORT` + feature-specific vars

---

### `decomposition/phase-builder.ts` — Phase Creator
**Role:** Creates `PlanPhase[]` with correct ordering based on what the app needs.

**Phase sequence:** `setup` → `backend` (if needed) → `frontend` (if needed) → `verification` → `deployment`

**Emits:** `planning.phase.generated` event per phase via `plannerBus`

---

### `decomposition/task-breakdown.ts` — Task Factory
**Role:** Generates concrete `PlanTask[]` for each phase.

| Phase | Tasks Generated |
|---|---|
| setup | Init repo, install deps, configure TS, set up DB |
| backend | Define schema, run migrations, implement routes, add validation, error handling |
| backend+auth | + auth endpoints, auth middleware, route protection |
| frontend | Layout/nav, core pages, API connection, forms, loading/error states |
| verification | Build check, user flow test, API response check |
| deployment | Configure env vars, production build, deploy |

---

### `decomposition/dependency-graph.ts` — Graph Builder
**Role:** Wires task dependencies automatically.

**Rules:**
1. Last task of phase N → first task of phase N+1 (inter-phase edges)
2. Task[i] → Task[i+1] within same phase (sequential intra-phase edges)
3. Applies edges back to `task.dependencies[]` array

**Output:** `DependencyGraph { nodes, edges, topologicalOrder }`

---

### `decomposition/milestone-generator.ts` — Milestone Creator
**Role:** Creates one `Milestone` per phase as a progress checkpoint.

| Phase | Milestone Title |
|---|---|
| setup | Project Foundation Ready |
| backend | Backend API Operational |
| frontend | UI Fully Rendered |
| verification | All Tests Passing |
| deployment | Application Live |

---

### `sequencing/execution-order.ts` — Topological Orderer
**Role:** Produces a deterministic, dependency-safe execution order for all tasks.

**Algorithm:** Topological sort (Kahn's) → then sorts within same level by priority weight (reuses `priorityWeight()` from orchestration helpers)

**Fallback:** Phase-order + priority sort if graph has cycles

---

### `sequencing/task-prioritizer.ts` — Priority Adjuster
**Role:** Upgrades task priorities based on phase context and category.

**Boosts:** `schema` and `auth` categories get +1 priority level. `setup` category gets +2. Critical phase overrides always win.

**Exports:** `prioritizeTasks()`, `sortByPriority()`, `filterByPriority()`

---

### `sequencing/pipeline-sequencer.ts` — Pipeline Coordinator
**Role:** Combines prioritization + ordering into one atomic operation.

**Steps:** Prioritize tasks → sort by priority → build execution order → update phase.tasks to match final order

**Output:** `SequencedPipeline { phases, tasks, executionOrder }`

---

### `validation/dependency-validator.ts` — Dependency Checker
**Role:** Validates that all `task.dependencies[]` reference real task IDs and that phases are ordered correctly.

**Detects:**
- Unknown dependency references (missing task IDs)
- A task depending on another task from a later phase

**Side effect:** Records `dependency.errors` metric for each violation

---

### `validation/circular-check.ts` — Cycle Detector
**Role:** Runs DFS-based cycle detection on the dependency graph and identifies which specific nodes are part of cycles.

**Algorithm:** Three-color DFS (WHITE/GRAY/BLACK) — GRAY node re-visit = cycle

**Output:** `{ hasCycles, cyclicNodeIds[], description }`

---

### `validation/plan-validator.ts` — Final Plan Validator
**Role:** Runs all validation checks on the completed plan before it is returned.

**Checks:**
1. Required fields present (planId, runId, appType, complexity)
2. Tasks and phases are non-empty
3. Dependency validity (delegates to `dependency-validator`)
4. Phase ordering validity
5. Circular dependency check
6. Orphaned tasks (in tasks[] but missing from executionOrder[])
7. Framework presence warnings
8. Database type warnings

**Output:** `ValidationResult { valid, errors[], warnings[], checkedAt }`

---

### `templates/saas-template.ts` — SaaS Defaults
**Role:** Pre-configured realistic defaults for SaaS apps.
- Pages: Landing, Dashboard, Settings, Billing, Profile, Team
- Services: AuthService, BillingService, SubscriptionService, WorkspaceService
- Entities: User, Workspace, Subscription, Plan, AuditLog, ApiKey
- Platform: Replit Autoscale, horizontal scaling
- Env vars: DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

---

### `templates/crud-template.ts` — CRUD Defaults
**Role:** Minimal, no-auth defaults for simple CRUD apps.
- Pages: Home, List, Detail, Create, Edit
- No auth strategy, no rate limiting
- Platform: Replit Reserved VM, single instance

---

### `templates/ai-app-template.ts` — AI App Defaults
**Role:** Defaults for LLM-powered chat/assistant apps.
- Pages: Home, Chat, History, Settings
- Services: LLMService, EmbeddingService, ChatService, StreamService
- Entities: User, Conversation, Message, Embedding, ApiUsage
- Env vars: OPENROUTER_API_KEY, JWT_SECRET

---

### `templates/auth-template.ts` — Auth System Defaults
**Role:** Complete auth-focused app defaults including MFA.
- Pages: Login, Register, ForgotPassword, ResetPassword, MFA
- Services: AuthService, TokenService, MfaService, SessionService
- Entities: User, Session, Token, Permission, Role, MfaDevice, AuditLog
- CSRF protection middleware included

---

### `templates/dashboard-template.ts` — Dashboard Defaults
**Role:** Analytics/reporting app defaults.
- Pages: Overview, Reports, Analytics, Settings, Export
- Features: chart-widgets, kpi-cards, filter-panel, export-csv
- Stack includes Recharts
- Cache middleware included in backend

---

### `core/planning-state.ts` — State Machine
**Role:** Immutable state transitions for a planning session lifecycle.

```
pending → running → completed
                 → failed
```

**Functions:** `createInitialState()`, `transitionToRunning()`, `transitionToCompleted()`, `transitionToFailed()`, `isTerminal()`

---

### `core/planning-context.ts` — Planning Context
**Role:** Carries all enriched data about a planning run through the engine pipeline.

**Fields:** runId, projectId, goal, timeoutMs, metadata, analysis, appType, complexity, requirements, createdAt

**Immutable updates:** `withAnalysis()` creates a new context with analysis results; `isContextReady()` checks all fields are populated.

---

### `core/planning-session.ts` — Session Registry
**Role:** In-memory registry of active planning sessions with full CRUD.

**Storage:** `Map<sessionId, PlanningSession>` (in-process, no Redis needed for planning)

**Functions:** `createSession()`, `startSession()`, `completeSession()`, `failSession()`, `getSession()`, `removeSession()`, `listActiveSessions()`

---

### `core/planner-engine.ts` — Core Orchestrator
**Role:** Runs the full planning pipeline in sequence. The brain of the system.

**Pipeline (10 steps):**
1. `analyzeGoal()` — Feature extraction
2. `classifyApp()` — App type detection
3. `extractRequirements()` — Requirement parsing
4. `estimateComplexity()` — Complexity scoring
5. `planFrontend/Backend/Database/Api/Deployment()` — 5 architecture plans
6. `buildPhases()` — Phase creation
7. `buildTasksForPhases()` — Task generation
8. `buildTaskDependencyGraph()` — Dependency wiring
9. `generateMilestones()` — Milestone creation
10. `sequencePipeline()` — Topological ordering + prioritization
11. `validatePlan()` — Final validation

---

## 🔄 Lifecycle Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                    PLANNER AGENT LIFECYCLE                          ║
╚══════════════════════════════════════════════════════════════════════╝

  CALLER (Supervisor / API / Chat Orchestrator)
       │
       │  createExecutionPlan({ runId, projectId, goal })
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      planner-agent.ts                           │
│                                                                 │
│  1. safeValidatePlannerInput()   ──► [FAIL] → PlannerResult     │
│  2. createSession()              ──► PlanningSession            │
│  3. emitPlanningStarted()        ──► plannerBus                 │
│  4. startSession()               ──► state: pending→running     │
│  5. runPlannerEngine()           ──► [see engine below]         │
│  6. completeSession() / failSession()                           │
│  7. emitPlanningCompleted/Failed()                              │
│  8. removeSession()                                             │
│  9. return PlannerResult { ok, plan, durationMs }               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     planner-engine.ts                           │
│                   (10-STEP PIPELINE)                            │
│                                                                 │
│  STEP 1 ──► goal-analyzer.ts                                    │
│             Keyword scan → GoalAnalysis (11 feature flags)      │
│                              │                                  │
│  STEP 2 ──► app-classifier.ts                                   │
│             Score 7 categories → AppType + confidence           │
│                              │                                  │
│  STEP 3 ──► requirement-extractor.ts                            │
│             Parse → Requirements (apis, auth, features)         │
│                              │                                  │
│  STEP 4 ──► complexity-estimator.ts                             │
│             Score 0-100 → PlanComplexity (low/medium/high)      │
│                              │                                  │
│  STEP 5 ──► Architecture Layer (5 parallel plans)               │
│             ├── frontend-planner.ts  → FrontendPlan             │
│             ├── backend-planner.ts   → BackendPlan              │
│             ├── database-planner.ts  → DatabasePlan             │
│             ├── api-planner.ts       → ApiPlan                  │
│             └── deployment-planner.ts→ DeploymentPlan           │
│                              │                                  │
│  STEP 6 ──► phase-builder.ts                                    │
│             Create PlanPhase[] + emit phase.generated events    │
│                              │                                  │
│  STEP 7 ──► task-breakdown.ts                                   │
│             Generate PlanTask[] per phase                       │
│                              │                                  │
│  STEP 8 ──► dependency-graph.ts                                 │
│             Wire inter+intra-phase edges → DependencyGraph      │
│                              │                                  │
│  STEP 9 ──► milestone-generator.ts                              │
│             One Milestone per phase → Milestone[]               │
│                              │                                  │
│  STEP 10──► pipeline-sequencer.ts                               │
│             ├── task-prioritizer.ts → Re-prioritize tasks       │
│             └── execution-order.ts  → Topological sort          │
│                              │                                  │
│  STEP 11──► plan-validator.ts                                   │
│             ├── dependency-validator.ts → Check refs            │
│             └── circular-check.ts      → DFS cycle detect       │
│                              │                                  │
│  RETURN ──► ExecutionPlan { planId, appType, complexity,        │
│             frontendPlan, backendPlan, databasePlan, apiPlan,   │
│             deploymentPlan, phases[], tasks[], dependencyGraph, │
│             executionOrder[], milestones[], validationResults } │
└─────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  EVENT BUS FLOW  (plannerBus — TypedEventEmitter)

  planner-agent.ts ──emit──► plannerBus ──listen──► event-handlers.ts
                                                         │
                                              ┌──────────┴──────────┐
                                              │                     │
                                        planner-logger.ts   planner-metrics.ts
                                              │                     │
                                        runLogger           metricsCollector
                                        (orchestration)     (orchestration)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  SESSION STATE MACHINE

  [createSession]
       │
       ▼
   ┌─────────┐
   │ PENDING │
   └────┬────┘
        │ startSession()
        ▼
   ┌─────────┐
   │ RUNNING │
   └────┬────┘
        │
   ┌────┴─────────────────┐
   │                      │
   ▼                      ▼
┌──────────┐         ┌────────┐
│COMPLETED │         │ FAILED │
└──────────┘         └────────┘
        │                  │
        └────────┬──────────┘
                 │ removeSession()
                 ▼
            [CLEANED UP]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  DEPENDENCY GRAPH CONSTRUCTION

  Phase: setup    tasks: [T1, T2, T3, T4]
  Phase: backend  tasks: [T5, T6, T7, T8, T9]
  Phase: frontend tasks: [T10, T11, T12, T13, T14]

  Intra-phase edges (sequential):
    T1→T2→T3→T4    T5→T6→T7→T8→T9    T10→T11→T12→T13→T14

  Inter-phase edges (phase boundary):
    T4→T5   T9→T10

  Topological sort result:
    [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14]

  Within same topo-level → sorted by priority weight (critical=4 > low=1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  APP TYPE → COMPLEXITY SCORING

  Base:     crud=20  backend_api=25  auth_system=30
            dashboard=35  saas=55  ecommerce=55  ai_app=60

  Bonuses:  +auth=10  +payments=15  +realtime=12  +AI=10
            +uploads=5  +search=5  +analytics=8  +notifications=5
            +oauth=5  +long_goal=5-10

  Score→Complexity:  0-35=LOW  36-65=MEDIUM  66-100=HIGH

  TaskCount:  LOW=8  MEDIUM=16  HIGH=28

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ORCHESTRATION REUSE MAP

  ┌──────────────────────┬─────────────────────────────────────────┐
  │ Planner Module       │ Reused From Orchestration               │
  ├──────────────────────┼─────────────────────────────────────────┤
  │ planner-logger.ts    │ server/orchestration/telemetry/         │
  │                      │   run-logger.ts → runLogger             │
  ├──────────────────────┼─────────────────────────────────────────┤
  │ planner-metrics.ts   │ server/orchestration/telemetry/         │
  │                      │   metrics.ts → metricsCollector,        │
  │                      │   incrementCounter, recordDuration       │
  ├──────────────────────┼─────────────────────────────────────────┤
  │ execution-order.ts   │ server/orchestration/utils/             │
  │                      │   orchestration-helpers.ts → priorityWeight│
  ├──────────────────────┼─────────────────────────────────────────┤
  │ planner-agent.ts     │ server/orchestration/utils/             │
  │                      │   orchestration-helpers.ts → elapsed()  │
  ├──────────────────────┼─────────────────────────────────────────┤
  │ utils/validators.ts  │ zod (same library used by supervisor)   │
  ├──────────────────────┼─────────────────────────────────────────┤
  │ events/planner-      │ Same TypedEventEmitter pattern as       │
  │   events.ts          │   orchestrationBus + supervisorBus      │
  └──────────────────────┴─────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  EXECUTION PLAN OUTPUT SHAPE

  ExecutionPlan {
    planId          → "plan_1779865851843_01ee532a"
    runId           → "run_abc123"
    appType         → "saas" | "ai_app" | "crud" | ...
    complexity      → "low" | "medium" | "high"

    frontendPlan  { framework, routing, stateManagement, pages[], features[] }
    backendPlan   { framework, language, services[], middleware[], modules[] }
    databasePlan  { type, orm, entities[], relations[], indexing[] }
    apiPlan       { style, endpoints[], authStrategy, rateLimiting, versioning }
    deploymentPlan{ platform, buildCommand, startCommand, envVars[], scaling }

    phases[]      → PlanPhase[] ordered: setup→backend→frontend→verify→deploy
    tasks[]       → PlanTask[]  each with id, phase, category, deps[], priority
    dependencyGraph→ { nodes[], edges[], topologicalOrder[] }
    executionOrder → string[] (task IDs in dependency-safe execution order)
    milestones[]  → Milestone[] (one per phase, with time estimates)
    validationResults→ { valid, errors[], warnings[], checkedAt }

    createdAt     → Date
  }
```

---

## 📊 System Statistics

| Metric | Value |
|---|---|
| Total Files | 39 |
| Total Lines | ~2,365 |
| Largest File | `task-breakdown.ts` (~120 lines) |
| Smallest File | `planner-logger.ts` (~30 lines) |
| Max file size rule | 250 lines (all compliant ✓) |
| External deps introduced | None (reuses existing) |
| Circular imports | None ✓ |
| Placeholder / TODO code | None ✓ |
| Type safety | Strict throughout ✓ |
| Event types defined | 4 (started, phase.generated, completed, failed) |
| Metrics tracked | 4 (plans.created, plans.failed, planning.duration, dependency.errors) |
| App types supported | 7 (crud, saas, ai_app, ecommerce, dashboard, auth_system, backend_api) |
| Complexity levels | 3 (low, medium, high) |
| Phase types | 5 (setup, backend, frontend, verification, deployment) |

---

*Report generated by deep scan of `server/agents/planner/` — NURA-X Planner Agent v1.0*
