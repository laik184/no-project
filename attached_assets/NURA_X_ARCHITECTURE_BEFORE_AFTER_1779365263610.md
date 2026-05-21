# NURA X — Architecture Refactor Report
## Before vs After: Production-Grade Hardening Plan

**Date:** 2026-05-21  
**Source:** Principal AI Systems Architect Audit  
**Scan Reference:** NURA_X_DEEP_SCAN_REPORT_1779363988542.md  

---

## CRITICAL RULES (Non-Negotiable)

| Rule | Status |
|---|---|
| High Cohesion | Required |
| Low Coupling | Required |
| Single Responsibility Per File | Required |
| No God Classes | Required |
| No Fake State Labels | **Currently Violated** |
| No Hidden Side Effects | Required |
| No Trusting LLM Claims Without Verification | **Currently Violated** |
| Max 250 Lines Per File | Required |
| Strict Module Boundaries | Required |
| All Execution Must Be Verifiable | **Currently Violated** |

---

## SECTION 1 — FAKE PHASES

### BEFORE (Current State)

```
orchestration-engine.ts lines 106–109:

transitionPhase(runId, "verify", "Verifying execution results");   ← LABEL ONLY
transitionPhase(runId, "reflect", "Reflecting on outcomes");       ← LABEL ONLY
transitionPhase(runId, "score",   "Scoring execution quality");    ← LABEL ONLY
transitionPhase(runId, "learn",   "Persisting learnings to memory"); ← LABEL ONLY
```

These 4 phases perform zero computation. They update a state label and nothing else.  
The post-execution lifecycle is a simulation.

### AFTER (Required)

Replace label transitions with real computation engines:

```
/server/engines/
  reflection/
    reflection-engine.ts         ← analyze failures, detect retry loops, recommend recovery
    failure-analyzer.ts          ← classify failure types
    retry-loop-detector.ts       ← detect repeated tool misuse
    recovery-recommender.ts      ← output structured recovery strategy

  verification/
    verification-engine.ts       ← orchestrate all verifiers
    import-validator.ts          ← validate all imports exist
    dependency-validator.ts      ← confirm packages installed
    runtime-health-validator.ts  ← check process liveness
    file-integrity-validator.ts  ← confirm expected files written

  scoring/
    scoring-engine.ts            ← compute execution quality score
    retry-efficiency-scorer.ts   ← penalize excessive retries
    hallucination-scorer.ts      ← likelihood score from patterns
    tool-correctness-scorer.ts   ← was the right tool used?

  learning/
    learning-engine.ts           ← persist reusable knowledge
    fix-persister.ts             ← save successful fix patterns
    failure-pattern-store.ts     ← save known failure signatures
    decision-persister.ts        ← save architecture decisions
    heuristic-generator.ts       ← generate recovery heuristics
```

**Each engine:** one responsibility, typed inputs/outputs, telemetry events, under 250 lines.

---

## SECTION 2 — LLM SELF-VALIDATION

### BEFORE (Current State — FORBIDDEN)

```
tool-loop.agent.ts:
  agent calls task_complete("I finished the task")
  → run completes
  → LLM claim accepted as truth
```

The agent self-reports completion. No independent system validates the claim.  
LLM says it's done → system believes it. **This is zero-trust violation.**

### AFTER (Required)

```
LLM
  → proposal
  → VerifierLayer (independent — never executes tools)
  → Executor
  → Observer
  → RuntimeValidation
  → BrowserValidation
  → CompletionGate
```

New verifier layer:

```
/server/verifiers/
  file-verifier.ts          ← did expected files actually get written?
  dependency-verifier.ts    ← are imported packages actually installed?
  runtime-verifier.ts       ← is the process actually running and healthy?
  tool-call-verifier.ts     ← were tool arguments valid before execution?
  build-verifier.ts         ← did the build actually succeed (exit code 0)?
  preview-verifier.ts       ← is the preview URL returning a valid response?
```

**Rules:**
- Verifiers NEVER execute tools
- Verifiers ONLY validate
- Verifiers return deterministic structured reports
- Failed verification BLOCKS execution — no exceptions

---

## SECTION 3 — BROWSER / UI VALIDATION

### BEFORE (Current State)

```
preview-verifier: HTTP 200 check only
```

HTTP 200 does NOT mean the UI is working.  
A blank screen returns 200. A hydration crash returns 200.  
React error boundaries return 200.

### AFTER (Required)

```
/server/browser/
  checks/
    blank-screen-detector.ts      ← screenshot pixel analysis
    button-visibility-checker.ts  ← key interactive elements present?
    hydration-failure-detector.ts ← React hydration errors in console?
    dom-stability-checker.ts      ← DOM stops changing after load?
    console-error-collector.ts    ← capture all browser console errors
    broken-asset-detector.ts      ← 404 images/scripts/styles?
    responsive-overflow-checker.ts← layout overflow at mobile viewport?
    interaction-tester.ts         ← can buttons be clicked?
    route-navigation-tester.ts    ← do page routes respond?

  runtime/
    playwright-runner.ts          ← launch/close browser sessions
    screenshot-capturer.ts        ← evidence screenshots per check
    dom-snapshot-capturer.ts      ← DOM state at validation time
    browser-console-reader.ts     ← extract console log stream
```

**Requirements:**
- Uses Playwright (already installed as dependency)
- Screenshot evidence required for every validation
- DOM snapshots required
- Browser console logs captured
- Results injected into agent loop context
- Browser layer NEVER touches planning or orchestration layer

---

## SECTION 4 — ZERO TRUST LLM ARCHITECTURE

### BEFORE (Current State — FORBIDDEN)

| LLM Claim | System Response (Before) |
|---|---|
| "task_complete" | ✅ Accepted — run ends |
| Generated import path | ✅ Trusted — executed directly |
| Dependency name | ✅ Trusted — installed without check |
| "Runtime is healthy" | ✅ Trusted — not verified |
| "UI looks correct" | ✅ Trusted — no browser check |

### AFTER (Required)

| LLM Claim | System Response (After) |
|---|---|
| "task_complete" | 🔍 Runtime proof required first |
| Generated import path | 🔍 FileVerifier checks existence |
| Dependency name | 🔍 DependencyVerifier confirms install |
| "Runtime is healthy" | 🔍 RuntimeVerifier probes process |
| "UI looks correct" | 🔍 Playwright browser validation |

**Rule:** LLM may PROPOSE. System must VERIFY. No exceptions.

Every completion requires:
- Runtime proof (process alive + responding)
- Build proof (exit code 0, no TypeScript errors)
- Browser proof (Playwright screenshot, no blank screen)
- Dependency proof (all imports resolvable)

---

## SECTION 5 — OBSERVABILITY

### BEFORE (Current State)

- Some events emitted via `bus.emit()`
- No structured telemetry directory
- No unified audit trail
- Events not fully replayable

### AFTER (Required)

```
/server/telemetry/
  execution-tracer.ts       ← span start/end per operation
  metrics-collector.ts      ← counters, durations, rates
  event-emitter.ts          ← typed structured events

/server/audit/
  audit-logger.ts           ← immutable append-only log
  audit-query.ts            ← query audit by runId/time
  audit-types.ts            ← typed audit event schema

/server/runtime-events/
  event-bus.ts              ← pub/sub backbone (already exists)
  event-schema.ts           ← strict typed schemas for all events
  event-replay.ts           ← replay execution graph from log
```

All events: timestamped, structured JSON, traceable by `runId`, replayable.

---

## SECTION 6 — HALLUCINATION RESISTANCE

### BEFORE (Current State)

No hallucination detection system exists.  
Agent can claim nonexistent files, fake packages, and invalid imports without challenge.

### AFTER (Required)

```
/server/hallucination/
  fake-dependency-detector.ts       ← is this npm package real?
  nonexistent-file-detector.ts      ← does this file path actually exist?
  invalid-import-detector.ts        ← does this import resolve?
  unverifiable-claim-detector.ts    ← claim has no observable proof
  fake-completion-detector.ts       ← task_complete without runtime proof
  repeated-strategy-detector.ts     ← same failing approach tried 3+ times?
```

**If hallucination confidence > threshold:**
1. Block execution
2. Trigger ReflectionEngine
3. Inject alternate strategy prompt
4. Do NOT let LLM proceed on unverified claim

---

## SECTION 7 — EXECUTION GRAPH

### BEFORE (Current State)

Linear message history only. No causal linking.  
Cannot replay a run. Cannot visualize what caused what.

### AFTER (Required)

```
/server/execution-graph/
  graph-builder.ts          ← build DAG from execution events
  graph-store.ts            ← persist graph per runId
  graph-query.ts            ← query causal chains
  graph-visualizer.ts       ← export to renderable format
  graph-types.ts            ← typed nodes: task/tool/retry/failure/recovery
  graph-replay.ts           ← replay execution deterministically
```

Tracks: task → tool → dependency → retry → failure → recovery → verification  
Properties: causal linking, rollback-safe, replayable, visualizable.

---

## SECTION 8 — MODULE BOUNDARY ENFORCEMENT

### BEFORE (Current State — Violations Found)

| Violation | Location |
|---|---|
| Orchestration contains business logic | `orchestration-engine.ts` |
| Verification runs inside tool-loop (not isolated) | `tool-loop.agent.ts` |
| Memory writes inside executor | `tool-loop.executor.ts` |

### AFTER (Required — Strict Boundaries)

```
Layer                    Can Access               Cannot Access
─────────────────────────────────────────────────────────────────
Orchestration Layer   → Router, Planner only    → No business logic
Verification Layer    → Read-only filesystem    → Never executes tools
Browser Layer         → Playwright only         → Not planning/orchestration
Memory Layer          → DB + filesystem         → Not runtime processes
Runtime Layer         → Process management      → Not LLM/tools
LLM/Tool Layer        → Tools only              → Not DB directly
```

---

## SECTION 9 — REQUIRED FINAL EXECUTION FLOW

### BEFORE (Current Flow)

```
User Goal
  → ChatOrchestrator
  → ExecutorRouter (mode selection)
  → runAgentLoop (LLM tool-use)
  → task_complete accepted
  → Memory saved
  → Done
```

### AFTER (Required Flow)

```
USER
  ↓
IntentRouter          ← classify goal type and complexity
  ↓
Planner               ← generate execution strategy
  ↓
TaskGraph             ← decompose into verifiable subtasks
  ↓
VerifierLayer         ← pre-execution validation (BLOCKS if invalid)
  ↓
Executor              ← LLM tool-use loop (max 25 steps)
  ↓
Observer              ← execution observation + console capture
  ↓
RuntimeValidation     ← process health + build status check
  ↓
BrowserValidation     ← Playwright UI checks + screenshots
  ↓
ReflectionEngine      ← analyze failures, detect loops
  ↓
LearningEngine        ← persist fixes and patterns
  ↓
ScoringEngine         ← compute quality score
  ↓
CompletionGate        ← ALL validations must pass to complete
```

No phase is a label. Every phase produces structured typed output.

---

## IMPLEMENTATION PRIORITY

| Priority | Module | Reason |
|---|---|---|
| P0 (Immediate) | Add `OPENROUTER_API_KEY` | Nothing works without this |
| P1 (Critical) | `VerifierLayer` — 6 verifiers | Blocks fake completions now |
| P1 (Critical) | `ReflectionEngine` | Replaces fake reflect phase |
| P2 (High) | `HallucinationDetectors` | Prevents bad code generation |
| P2 (High) | `BrowserValidation` with Playwright | Replaces HTTP 200 check |
| P3 (Medium) | `ScoringEngine` | Quality metrics |
| P3 (Medium) | `LearningEngine` | Better over time |
| P4 (Low) | `ExecutionGraph` | Debugging and visualization |

---

## SUMMARY

| Area | Before | After |
|---|---|---|
| Post-execution phases | 4 fake label transitions | 4 real computation engines |
| LLM completion trust | Accepted immediately | Blocked until 4-proof verification |
| UI validation | HTTP 200 only | Full Playwright browser checks |
| Hallucination handling | None | 6 dedicated detectors |
| Module boundaries | Partially enforced | Strictly enforced per layer |
| Observability | Partial event bus | Full telemetry + audit + replay |
| Execution history | Linear message array | Causal execution graph |
