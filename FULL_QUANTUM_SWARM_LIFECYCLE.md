# FULL QUANTUM SWARM ROUTING — LIFECYCLE TRACE

**Version:** 1.0.0  
**Date:** 2026-05-25

This document traces the complete lifecycle of a swarm-mode execution from user goal
to merged patches, including all telemetry events fired at each step.

---

## SAMPLE GOAL
> "Add a users table with Drizzle schema, create a POST /api/users endpoint,
>  add auth middleware, and build a React user list component"

---

## PHASE 1: ORCHESTRATION ENGINE INTAKE

```
executeOrchestration({ runId: "run-42", projectId: 1, goal: "...", mode: "swarm" })
  → transitionPhase("analyze")
  → transitionPhase("plan")
  → transitionPhase("route")
  → transitionPhase("execute")
  → routeExecution(ctx, state)          ← delegates to execution-router
```

**Events fired:** orchestration.runs.started

---

## PHASE 2: EXECUTION ROUTER

```
routeExecution(ctx, state)
  → switch(mode="swarm")
  → _routable(ctx, state, executeSwarm)  ← dynamic rerouter wraps handler
  → executeSwarm(ctx)
  → masterSwarmOrchestrator.run("run-42", 1, goal, {})
```

---

## PHASE 3: MASTER SWARM ORCHESTRATOR

```
masterSwarmOrchestrator.run("run-42", 1, goal)
```

### Step 3a: Fabric registration
```
parallelOrchestrationFabric.spawn("run-42", 1)  → { ok: true }
parallelOrchestrationFabric.transition("run-42", "observe")
parallelOrchestrationFabric.transition("run-42", "analyze")
```

### Step 3b: Intent analysis
```
analyzeIntent("run-42", goal)
  → splitGoalFragments(goal)
    → ["Add a users table with Drizzle schema",
       "create a POST /api/users endpoint",
       "add auth middleware",
       "build a React user list component"]
  → buildNodes([...])
    → IntentNode("intent-1") domain=database priority=critical parallel=false
    → IntentNode("intent-2") domain=backend priority=normal parallel=true
    → IntentNode("intent-3") domain=security priority=critical parallel=true
    → IntentNode("intent-4") domain=frontend priority=normal parallel=true
  → detectDomains(goal) → [database, backend, security, frontend]  (4 domains)
  → classifyIntent(goal) → strategy: "swarm" (confidence: 0.92)
  → inferDependencies(nodes)
    → database→backend (domain-order edge, weight=0.9)
    → database→security (domain-order edge, weight=0.9)
    → database→frontend (domain-order edge, weight=0.9)
    → backend→security (domain-order edge, weight=0.9)
    → backend→frontend (domain-order edge, weight=0.9)
    → security→frontend (domain-order edge, weight=0.9)
    → schema→endpoint (structural edge, weight=0.95)
  → buildExecutionWaves(nodes, edges)
    → waves = [["intent-1"], ["intent-2","intent-3"], ["intent-4"]]
```

### Step 3c: Telemetry
```
swarmTelemetryFabric.routeStart("run-42", 1, {
  strategy: "swarm", domainCount: 4, nodeCount: 4, waves: 3
})
```
**Event fired:** `swarm.route.start`

---

## PHASE 4: DYNAMIC SWARM ROUTER

```
dynamicSwarmRouter.route(graph, projectId=1)
```

### Wave 0 — database (sequential)
```
waveNodes = [intent-1 (database, sequential)]
  → dispatchWithFailover(intent-1, "run-42", 1, ac)
  → failoverChain("database") → ["database", "backend", "fullstack"]
  → _circuitOpen("run-42", "database") → false
  → buildTask(intent-1) → SpecialistTask { domain:"database", timeoutMs:30000 }
```
**Event fired:** `specialist.dispatch` (taskId=intent-1, domain=database)
```
  → specialistDispatcher.dispatch(task, ac.signal)
  → SpecialistResult { success: true, patches: [{ filePath: "shared/schema.ts" }] }
```
**Event fired:** `specialist.complete` (taskId=intent-1, patches=1)

### Wave 1 — backend + security (parallel)
```
waveNodes = [intent-2 (backend, parallel), intent-3 (security, parallel)]
  → Promise.all([
      dispatchWithFailover(intent-2),  ← backend specialist
      dispatchWithFailover(intent-3),  ← security specialist
    ])
```
**Events fired:** `specialist.dispatch` × 2, `specialist.complete` × 2

### Wave 2 — frontend (parallel)
```
waveNodes = [intent-4 (frontend, parallel)]
  → dispatchWithFailover(intent-4)
```
**Events fired:** `specialist.dispatch`, `specialist.complete`

### Aggregation
```
allPatches = [
  { filePath: "shared/schema.ts", operation: "create" },
  { filePath: "server/routes/users.ts", operation: "create" },
  { filePath: "server/middleware/auth.ts", operation: "create" },
  { filePath: "client/src/components/UserList.tsx", operation: "create" },
]
```

---

## PHASE 5: MASTER SWARM COMPLETION

```
parallelOrchestrationFabric.transition("run-42", "complete", { patchCount: 4 })
swarmTelemetryFabric.routeComplete("run-42", 1, { success: true, durationMs: 8240, patchCount: 4 })
swarmTelemetryFabric.clearRun("run-42")
```
**Event fired:** `swarm.route.complete`

---

## PHASE 6: ORCHESTRATION ENGINE — VERIFY/REFLECT/SCORE

```
runVerificationEngine(1, "run-42")     ← parallel 3-wave verification
runBrowserValidation(1, "run-42")      ← visual + hydration check
runReflectionEngine(...)               ← failure analysis
runScoringEngine(...)                  ← A–F quality grade
runLearningEngine(...)                 ← persist fixes
runCompletionGate(...)                 ← final policy gate
```

---

## FULL EVENT SEQUENCE

```
1.  orchestration.runs.started
2.  swarm.route.start
3.  specialist.dispatch  (database)
4.  specialist.complete  (database)
5.  specialist.dispatch  (backend)   ┐ parallel
6.  specialist.dispatch  (security)  ┘
7.  specialist.complete  (backend)   ┐ parallel
8.  specialist.complete  (security)  ┘
9.  specialist.dispatch  (frontend)
10. specialist.complete  (frontend)
11. swarm.route.complete
12. verification.start   (3-wave A/B/C)
13. verification.complete
14. orchestration.runs.completed
```

---

## FAILURE SCENARIO: Critical node fails

```
intent-1 (database, critical) → SpecialistResult { success: false }
  → _recordFailure("run-42", "database") → count=1
  → failoverChain: try "backend" domain
  → SpecialistResult { success: false }
  → _recordFailure("run-42", "backend") → count=1
  → failoverChain: try "fullstack" domain
  → SpecialistResult { success: false }
  → return { success: false, error: "..." }
  → node.priority === "critical" → ac.abort()
  → emitRoutingAbort("run-42", ..., "Critical node failed")
```
**Event fired:** `orchestration.abort`  
**Result:** Error propagated to orchestration-engine → recovery phase triggered
