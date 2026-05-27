# Nura-X Deployer

An autonomous "Agentic AI Vibe Coder" platform that builds, runs, and manages web applications based on natural language instructions. It provides a sandboxed environment where AI agents collaborate to plan, write, test, and deploy code, with a real-time monitoring interface.

## Architecture

- **Frontend** (`client/`): React + Vite + TypeScript + Tailwind CSS + Radix UI. IDE-like interface with file explorer, terminal, chat, and preview window.
- **Backend** (`server/`): Express + Node.js + TypeScript. Manages AI orchestration, project sandboxes, and runtime services.
- **Shared** (`shared/`): Drizzle ORM schema shared between frontend and backend.
- **AI Engine**: Multi-agent architecture (Planner, Executor, Browser, Security) via OpenRouter.

## Running the Project

The workflow `Start application` runs `npm run dev`, which starts:
- Backend API on port **3001** (`tsx watch main.ts`)
- Frontend on port **5000** (`vite`)

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | LLM API key for agent runs |
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit) |
| `LLM_MODEL` | Model to use (default: `openai/gpt-oss-120b:free`) |
| `LLM_BASE_URL` | OpenRouter base URL |
| `AGENT_PROJECT_ROOT` | Sandbox directory (default: `.sandbox`) |

## Database

PostgreSQL via Drizzle ORM. Schema in `shared/schema.ts`. Run migrations with:
```
npx drizzle-kit push
```

---

## Supervisor Agent System

Location: `server/agents/supervisor/`

The Supervisor Agent is the top-level orchestration brain. It wraps the existing orchestration pipeline with intelligent analysis, routing, monitoring, coordination, and fail-closed decision-making.

### Public API

```ts
import { initializeSupervisor, runSupervisorCycle, shutdownSupervisor } from 'server/agents/supervisor/supervisor-agent.ts';

initializeSupervisor();                       // Register event handlers (idempotent)
const result = await runSupervisorCycle(ctx); // Run a full supervised pipeline
shutdownSupervisor();                         // Tear down gracefully
```

### Folder Structure

```
server/agents/supervisor/
├── supervisor-agent.ts          ← Public entry point
├── types/
│   ├── supervisor.types.ts      ← Core types: SupervisorSession, RunResult, etc.
│   └── routing.types.ts         ← AGENT_REGISTRY, AgentDescriptor, RoutingDecision
├── events/
│   ├── event-types.ts           ← SupervisorEvent discriminated union
│   ├── supervisor-events.ts     ← Emit helpers (emitSupervisorStarted, etc.)
│   └── event-handlers.ts        ← Bus listeners (register/unregister)
├── utils/
│   ├── supervisor-helpers.ts    ← generateSessionId, elapsed, clampRetry
│   ├── execution-utils.ts       ← safeRun, withTimeout, batchRun
│   └── validators.ts            ← validateContext, validateGoal
├── telemetry/
│   ├── supervisor-logger.ts     ← Per-run structured logger (info/warn/error)
│   └── supervisor-metrics.ts    ← Counters and timings per runId
├── analysis/
│   ├── complexity-analyzer.ts   ← Score 0–100, estimate task count
│   ├── goal-classifier.ts       ← Classify goal into GoalCategory
│   └── execution-mode-detector.ts ← Map complexity → ExecutionMode + phase list
├── decisions/
│   ├── retry-decision.ts        ← Should retry? max attempts, backoff
│   ├── escalation-decision.ts   ← Should escalate? loop risk, timeout
│   └── failure-decision.ts      ← Abort | skip | escalate | retry
├── monitoring/
│   ├── loop-detector.ts         ← Detect repeated phase patterns
│   ├── execution-monitor.ts     ← Track active run health
│   ├── timeout-monitor.ts       ← Enforce per-phase deadlines
│   └── stuck-task-detector.ts   ← Detect stalled tasks
├── coordination/
│   ├── retry-coordinator.ts     ← executeWithRetry with backoff
│   ├── task-coordinator.ts      ← Reserve / release tasks
│   └── pipeline-coordinator.ts  ← startPhase / endPhase tracking
├── routing/
│   ├── agent-router.ts          ← Phase → agent mapping + timeout lookup
│   ├── task-router.ts           ← Route task by mode + category
│   └── priority-router.ts       ← Sort tasks by priority score
└── core/
    ├── supervisor-state.ts      ← Session state machine (idle→active→shutdown)
    ├── supervisor-context.ts    ← Immutable context derived from OrchestrationContext
    ├── execution-controller.ts  ← Run a single phase with retry + monitoring
    └── supervisor-engine.ts     ← Orchestrate full phase pipeline
```

### Execution Modes

| Mode | Phases |
|---|---|
| `minimal` | analyze → execution |
| `standard` | analyze → planning → execution → verification |
| `full` | analyze → planning → execution → verification → browser |
| `recovery` | analyze → execution → verification |

### Data Flow

```
runSupervisorCycle(ctx)
  └── complexityAnalyzer.analyze(goal)        → ComplexityResult
  └── goalClassifier.classify(goal)           → ClassificationResult
  └── executionModeDetector.detect(...)       → ExecutionMode + phases[]
  └── supervisorState.create(...)             → SupervisorSession
  └── supervisorContext.create(...)           → SupervisorContext
  └── [for each phase]
        agentRouter.route(phase)              → RoutingDecision
        pipelineCoordinator.startPhase(...)
        retryCoordinator.executeWithRetry()   → runs actual phase function
        executionMonitor.checkHealth()
        failureDecision / escalationDecision  → SupervisorDecision
        pipelineCoordinator.endPhase(...)
  └── supervisorState.transition('shutdown')
  └── SupervisorRunResult
```

### Extending the Supervisor

- **Add a new execution mode**: update `executionModeDetector.ts` and `ExecutionMode` union in `supervisor.types.ts`.
- **Register a new agent**: add an entry to `AGENT_REGISTRY` in `routing.types.ts`.
- **Add a monitoring check**: implement in `monitoring/` and wire into `execution-controller.ts`.
- **Custom retry logic**: update `retry-decision.ts` and `retry-coordinator.ts`.

---

## Orchestration Layer

Location: `server/orchestration/`

Simplified single-file architecture (post-refactor):

| File | Responsibility |
|---|---|
| `core/orchestrator.ts` | Entry point — wires all phases |
| `core/run-manager.ts` | Run lifecycle (create/start/complete/fail/cancel) |
| `pipeline/*-phase.ts` | One file per phase (analyze, planning, execution, verification, browser) |
| `retry/retry-manager.ts` | Retry logic with backoff |
| `queue/task-queue.ts` | Task enqueueing and dequeuing |
| `events/orchestration-events.ts` | `orchestrationBus` — typed event bus |
| `telemetry/` | `runLogger` + `metricsCollector` |

---

## Agents

| Agent | Location | Purpose |
|---|---|---|
| Supervisor | `server/agents/supervisor/` | Top-level orchestration brain |
| Planner | `server/agents/planner/planner-agent.ts` | `buildTaskGraph(goal)` — produces task dependency graph |

---

## User Preferences

- Keep files under 250 LOC — split intelligently
- High cohesion, low coupling — single responsibility per module
- Fail-closed: no silent failures, no swallowed errors
- Telemetry on all significant operations via the EventBus
- Typed contracts everywhere — no `any` unless unavoidable
