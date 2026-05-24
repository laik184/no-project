# BLUEPRINT — Parallel Specialist Swarm Architecture

Production architecture diagram for the specialist coordination subsystem.

---

## System Overview

```
OrchestrationEngine
  └── ExecutionRouter (execution-router.ts)
        ├── tool-loop  → runAgentLoop()
        ├── planned    → plannerBridge + builderBridge
        ├── dag        → DAG graph executor
        ├── swarm      → executeSwarm() ────────────────────┐
        ├── recovery   → supervisorBridge                   │
        └── quantum    → quantumEngine                      │
                                                            │
                         coordinateSpecialists()  ◄─────────┘
                           (coordination/index.ts)
                                │
                         ┌──────▼───────────────────────────┐
                         │  ParallelSpecialistCoordinator    │
                         │  ──────────────────────────────   │
                         │  1. taskDecomposer.decompose()    │
                         │  2. specialistWaveRunner.run()    │
                         │  3. specialistConflictDetector    │
                         │  4. resolutionStrategy.resolve()  │
                         │  5. specialistResultMerger.merge()│
                         │  6. verifyCoordinationResult()    │
                         └──────────────────────────────────┘
```

---

## Specialist Wave Execution

```
DecomposedPlan
  ├── Wave 1: [database, backend]  ← parallel (no file overlap)
  ├── Wave 2: [frontend, security] ← parallel (depends on wave 1)
  └── Wave 3: [verification]       ← serial gate

Each task in a wave:
  ContextRegistry.create(runId, taskId)
    └── acquireTaskLocks(exclusiveFiles[])
          └── centralWorkerPool.submit(fn)
                └── specialistDispatcher.dispatch(task, signal)
                      └── specialistExecutor.executeSpecialist(task, signal)
                            └── runAgentLoop({
                                  goal:         "[DOMAIN SPECIALIST] <task.goal>",
                                  systemPrompt: getDomainConfig(domain).systemPrompt,
                                  maxSteps:     getDomainConfig(domain).maxSteps,
                                  signal,
                                })
                                  └── OpenRouter LLM ← real calls
```

---

## Specialist Domains

| Domain | System Prompt Focus | Max Steps |
|--------|---------------------|-----------|
| `database` | Drizzle schema, migrations, SQL queries | 10 |
| `backend` | Express routes, service logic, middleware | 15 |
| `frontend` | React components, Tailwind, TanStack Query | 15 |
| `security` | Validation, XSS/CSRF, auth guards | 8 |
| `runtime` | Env vars, health checks, process lifecycle | 8 |
| `verification` | Type-check, tests, API contract validation | 10 |
| `fullstack` | Cross-cutting: shared/, middleware, config | 12 |

---

## Swarm Agent → Domain Routing

```
SwarmAgentRole          →  SpecialistDomain
──────────────────────────────────────────
planner                 →  fullstack
ui-agent                →  frontend
backend-agent           →  backend
database-agent          →  database
runtime-agent           →  runtime
verification-agent      →  verification
security-agent          →  security
recovery-agent          →  fullstack
browser-agent           →  frontend
reflection-agent        →  fullstack
merge-agent             →  fullstack
```

---

## Context & Memory Lifecycle

```
Coordination Context (per task):
  CREATE  → contextRegistry.create(runId, taskId)
  USE     → ctx.abortController.signal forwarded to executor
  MARK    → executionContextFactory.markCompleted(ctx, result)
  EVICT   → contextRegistry.startSweeper(60_000) ← NEW
             Sweeps every 60s, evicts completed + stale contexts
```

---

## Post-Coordination Verification Gate

```
CoordinationResult
  └── verifyCoordinationResult(result)
        ├── Check 1: specialistsRan > 0              (block if zero)
        ├── Check 2: no duplicate patch file paths   (warn)
        └── Check 3: avg patch confidence ≥ 0.60     (warn)

Verdict → pass | warn | block
  block  → coordination marked failed, error surfaced to router
  warn   → result returned with verification warnings in artifacts
  pass   → result forwarded to execution engine
```

---

## SSE Event Flow

```
bus.emit("agent.event", { phase: "coordination", eventType, ... })
  └── subscription-manager (existing infrastructure)
        └── connection-pool.fanOut()
              └── SSE client (runId-scoped)
                    └── Frontend specialist swarm visualization
```

28 coordination event types tracked (see `COORDINATION_SSE_EVENTS` set).
