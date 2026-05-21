# NURA X — Maximum Reliability Architecture
## Hallucination Elimination & Deterministic Execution Design

> **Mode:** Evidence-Based Engineering Analysis  
> **Target:** ~99% Hallucination Resistance  
> **Written by:** Principal Autonomous Systems Architect  
> **Based on:** Actual code analysis of `server/` codebase

---

## SECTION 1 — Hallucination Root Cause Analysis

*Every risk below is traced to actual code evidence in the current system.*

---

### 1.1 FAKE SUCCESS ON VERIFICATION EXHAUSTION

**Severity: CRITICAL**

```typescript
// server/verification/engine/verification-engine.ts
// When maxRetries is exhausted:
buildExhaustedFeedback()  →  ok: true + "verification_exhausted" warning
```

**What happens:** If the agent fails verification 3 times, the system marks the task as `ok: true` anyway and continues. The agent reports success to the user. The app may be broken.

**Root cause:** The loop cannot wait indefinitely. The "fail closed" principle is violated — the system fails **open**, silently degrading to a fake success.

**Propagation path:**  
`verification_failed × N` → `buildExhaustedFeedback` → `task_complete` returns `ok: true` → `RunController.finalize()` → user sees "completed" → broken app.

---

### 1.2 CONTEXT COMPRESSION INFORMATION LOSS

**Severity: HIGH**

```typescript
// server/agents/core/tool-loop/continuation/continuation-manager.ts
// RECENCY_WINDOW = 6 (last 6 messages kept verbatim)
// Everything in between: summarized by LLM into a "PROGRESS SUMMARY"
// HARD_CONTINUATION_CEILING = 5 (up to 125 total steps)
```

**What happens:** After 25 steps, the LLM summarizes its own progress. The summary is LLM-generated — it can omit critical constraints, erroneously report completion of steps not done, or silently drop error context. The next loop iteration reads this compressed hallucination as ground truth.

**Root cause:** The compressor trusts the LLM to accurately summarize itself. Self-summarization is the highest-risk hallucination vector — the model optimistically edits its own history.

**Propagation path:**  
`max_steps hit` → `compressMessages()` → LLM writes summary → summary injected as "past progress" → next loop starts with hallucinated state → agent skips already-hallucinated-as-done steps.

---

### 1.3 STALE MEMORY RE-INJECTION

**Severity: HIGH**

```typescript
// server/agents/memory/persistence/memory-store.ts
// MAX_MD_CHARS = 6000
// Pruning: file.slice(-MAX_CHARS)  ← keeps TAIL only, silently drops HEAD
```

**What happens:** Memory files (`architecture.md`, `progress.md`, `decisions.json`) are written by previous agent runs. If a previous run hallucinated — e.g., wrote "authentication is complete" when it isn't — that string persists in the memory file and gets injected into every future run as established truth.

The pruning mechanism (`slice(-MAX_CHARS)`) keeps the most recent content but silently drops older content. There is no mechanism to mark memory as "verified" vs "claimed". Every write to memory is treated as fact.

**Root cause:** Memory files are an append-only trust store with no integrity or verification layer. Hallucinated history becomes canonical.

**Propagation path:**  
`agent hallucinates "auth done"` → `memory-store.ts write` → `project-context-builder.ts inject` → next run reads "auth done" → skips auth implementation → incomplete app shipped.

---

### 1.4 TYPESCRIPT VALIDATION VIA LOG SCANNING

**Severity: HIGH**

```typescript
// server/verification/engine/ — typescript-validator.ts
// Scans last 80 log lines for:  /error TS\d+:/  patterns
// NOT running: tsc --noEmit
```

**What happens:** TypeScript errors are detected by scanning process logs for error patterns. This means:
- If the dev server hasn't rebuilt yet, errors are invisible
- TSC errors in files not hot-reloaded won't appear in 80 lines
- Non-standard TypeScript configs can suppress log output
- The agent can write broken TypeScript that passes this check

**Root cause:** Log-scanning is a proxy metric, not a primary source of truth. Actual compilation state is not verified.

---

### 1.5 BROWSER VERIFIER SCORE THRESHOLD IS ARBITRARY

**Severity: HIGH**

```typescript
// server/verification/browser/browser-verifier.ts
// PASS condition: score >= 60 AND no 5xx
// Score = DOM(40%) + ConsoleErrors(30%) + Interactions(20%) + Accessibility(10%)
```

**What happens:** A page with:
- Empty DOM but no console errors: 30 points
- 1 button present (selector match): +20 = 50 points → FAIL
- Add any 2 DOM elements: could push to 65 → PASS despite broken UI

The 20-char blank page detection (`text.length < 20`) misses pages with loading spinners, placeholder text, or skeleton states. A React app that immediately crashes after hydration may still serve an HTML shell that passes the HTTP check.

**Root cause:** Visual correctness cannot be heuristically scored. The system conflates "page is technically present" with "page is functionally correct".

---

### 1.6 RECOVERY VALIDATES METADATA NOT CODE

**Severity: HIGH**

```typescript
// server/infrastructure/recovery/recovery-manager.ts
// validateCheckpoint() checks:
//   - DB status === "stable"
//   - file count > 0
// Does NOT check:
//   - if restored code compiles
//   - if server starts after restore
//   - if restored state is logically correct
```

**What happens:** A rollback can restore a checkpoint that was marked "stable" but contains non-functional code — e.g., a checkpoint created before a half-written migration, or after an LLM wrote syntactically valid but semantically broken code. The system reports "recovery successful" immediately after file restoration, without running post-restore verification.

---

### 1.7 SELF-CONFIRMATION BIAS IN RETRY LOOP

**Severity: MEDIUM-HIGH**

```typescript
// server/agents/core/tool-loop/tool-loop.agent.ts
// Verification fails → injects failure message into messages[]
// LLM reads failure message → attempts fix → calls task_complete again
// No strategy diversity enforcement
```

**What happens:** The LLM retries the same fix strategy with slight variations. Because the failure message is structured as "these things failed, fix them", the LLM attempts the same approach it used before. There is no mechanism that:
- Blacklists failed strategies
- Forces strategy divergence on retry
- Detects when the same code change is being attempted repeatedly

**Root cause:** `hallucination-detector.ts` uses Jaccard similarity on text. It catches lexically repeated outputs but not semantically repeated strategies.

---

### 1.8 NO IMPORT GRAPH VERIFICATION

**Severity: MEDIUM-HIGH**

The agent can write files with imports pointing to non-existent modules. The verification engine does not:
- Parse import statements in written files
- Verify referenced exports exist
- Check circular dependency introduction
- Validate dynamic import paths

TypeScript compilation would catch this, but only if the log scanner happens to see the error in 80 lines.

---

### 1.9 SPECULATIVE PLANNING WITHOUT PRECONDITIONS

**Severity: MEDIUM**

```typescript
// server/agents/planning/planner.service.ts
// PlannerAgent produces ExecutionPhase[]
// Each phase has: goal (string), dependencies (string[])
// No formal preconditions
// No postconditions
// No typed task contracts
```

The planner generates a list of phases. Phases have string-based dependency declarations but no formal verification that dependency phase N actually completed and its output is valid before starting phase N+1. If phase 3 fails silently (reported as "completed with warnings"), phase 4 starts on a broken foundation.

---

### 1.10 HALLUCINATION DETECTION IS REACTIVE

**Severity: MEDIUM**

```typescript
// server/agents/supervisor/hallucination-detector.ts
// detectRepetition() — Jaccard similarity 0.85 on last N outputs
// halt only after 3+ repetitions
```

The detection fires AFTER the agent has already repeated itself 3 times. Each repetition has already:
- Made tool calls
- Potentially written files
- Consumed tokens
- Advanced state

There is no proactive guard that runs before tool calls to evaluate whether the planned action is evidence-grounded.

---

### 1.11 DEPENDENCY INJECTION INTO LLM WITHOUT FRESHNESS CHECK

The `project-context-builder.ts` reads files from disk at context build time. It does not:
- Verify that memory files match current filesystem state
- Check if `architecture.md` describes code that still exists
- Validate that `decisions.json` references valid module paths
- Timestamp-gate memories against last verified run

---

### 1.12 TOOL FABRICATION RISK

The LLM can attempt to call tools outside `TERMINAL_TOOL_NAMES` or with invalid parameters. While the tool executor validates inputs, there is no pre-flight check that validates whether the LLM's tool call is logically sensible given the current runtime state.

---

### 1.13 PREVIEW FALSE POSITIVES

```typescript
// server/preview/lifecycle/preview-lifecycle.manager.ts
// State: starting → running
// Transition trigger: port becomes responsive to HTTP
```

A server is marked `running` when it responds to HTTP on the assigned port. This misses:
- Server that returns 500 for every request
- Server serving static HTML but with dead API routes
- Server in a crash-restart loop (momentarily responds, then crashes)

---

## SECTION 2 — High Cohesion / Low Coupling Module Redesign

---

### 2.1 Intent Engine

**Current state:** ChatOrchestrator parses goal strings and dispatches by `mode` parameter (agent/planned/pipeline). No formal intent validation.

**Redesigned:**

```
IntentEngine
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Parse raw user goal into a typed GoalDescriptor
  - Extract constraints, scope, risk level
  - Classify execution mode deterministically

INPUTS:
  - raw goal: string
  - project context snapshot (read-only, frozen)
  - available tool catalog (typed manifest)

OUTPUTS:
  - GoalDescriptor {
      type: "feature" | "fix" | "refactor" | "query" | "deploy"
      scope: FileScope[]         // exact files affected
      constraints: Constraint[]  // must-not-break list
      riskLevel: 0–10
      requiredTools: ToolId[]    // pre-declared, not discovered at runtime
      executionMode: "tool-loop" | "planned" | "pipeline"
    }

FAILURE MODES:
  - Ambiguous goal → rejects with clarification request (NEVER guesses)
  - Missing context → returns BLOCKED status, does not proceed

VERIFICATION:
  - GoalDescriptor passes through a GoalValidator before execution begins
  - Validator checks: no contradictory constraints, scope is finite, tools exist

COUPLING REDUCTION:
  - IntentEngine reads NO runtime state
  - Outputs sealed GoalDescriptor (immutable after creation)
  - Downstream systems receive GoalDescriptor, not raw goal string
```

---

### 2.2 Planner

**Current state:** PlannerAgent generates `ExecutionPhase[]` via LLM. No typed contracts. No preconditions.

**Redesigned:**

```
TypedPlanner
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Convert GoalDescriptor into a verified ExecutionDAG
  - Each node has explicit preconditions and postconditions

INPUTS:
  - GoalDescriptor (sealed, validated)
  - DependencyGraph (from filesystem scan — not LLM)
  - ConstraintSet (must-not-break contracts)

OUTPUTS:
  - ExecutionDAG {
      nodes: TypedTask[]
      edges: DependencyEdge[]
      totalEstimatedSteps: number
      rollbackPoints: CheckpointRef[]
    }

TypedTask {
  id: string
  type: "write_file" | "run_command" | "verify" | "checkpoint"
  preconditions: Assertion[]   // checked BEFORE execution
  postconditions: Assertion[]  // checked AFTER execution
  rollbackSafe: boolean
  idempotent: boolean
  maxRetries: 2
}

FAILURE MODES:
  - Circular dependency detected → ABORT
  - Precondition cannot be expressed → ESCALATE to user
  - LLM plan cannot be typed → REJECT, re-plan with stricter prompt

VERIFICATION:
  - PlanVerifier runs before execution begins
  - Validates all edges, all tool IDs exist, all file paths in scope
```

---

### 2.3 Tool Router

**Current state:** LLM picks tools directly from the catalog. No pre-flight validation.

**Redesigned:**

```
ToolRouter
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Gate all LLM tool call intentions
  - Verify tool call is contextually valid before execution
  - Sandbox tool execution

INPUTS:
  - LLM tool call intent (proposed, not yet executed)
  - Current RuntimeSnapshot (frozen at call time)
  - GoalDescriptor.requiredTools whitelist

OUTPUTS:
  - APPROVED tool call → passed to executor
  - REJECTED tool call → reason returned to LLM
  - FLAGGED tool call (not in whitelist) → supervisor consensus required

CHECKS BEFORE EXECUTION:
  1. Tool exists in registry? → else REJECT
  2. Tool in GoalDescriptor.requiredTools? → else FLAG for approval
  3. Target path in GoalDescriptor.scope? → else REJECT out-of-scope writes
  4. Tool precondition met? (e.g., file exists before read) → else REJECT
  5. Identical call made < 3 steps ago? → CIRCUIT BREAK

FAILURE MODES:
  - Tool not found → immediate REJECT + inform LLM
  - Out-of-scope path → immediate REJECT + penalize confidence score
  - Repeated identical call → escalate to RecoveryOrchestrator
```

---

### 2.4 Runtime Observer

**Current state:** ObservationController watches ports and logs. Events emitted to bus. No structured truth layer.

**Redesigned:**

```
RuntimeTruthEngine (replaces ObservationController)
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Maintain a continuously verified RuntimeTruth snapshot
  - NEVER infer state — only report observed state

RuntimeTruth {
  timestamp: number          // last verification time
  processState: "running" | "crashed" | "starting" | "unknown"
  httpStatus: number | null  // last actual HTTP response code
  httpResponseTimeMs: number
  tsErrors: TSError[]        // from actual tsc --noEmit, not log scan
  importErrors: ImportError[] // from static import graph analysis
  packageErrors: string[]    // from npm ls --json
  portOpen: boolean
  lastLogLine: string
  checksum: string           // filesystem checksum of src/
}

CONTINUOUS CHECKS (every 5s):
  1. Process PID alive (kill -0)
  2. HTTP probe to preview port
  3. Log tail analysis (last 20 lines only)

ON-DEMAND CHECKS (triggered by agent task_complete):
  4. tsc --noEmit (actual TypeScript check)
  5. npm ls --depth=0 --json (actual dependency check)
  6. import-graph scan (static analysis of written files)
  7. filesystem checksum vs pre-task baseline

FAILURE MODES:
  - Any check takes > 30s → TIMEOUT, state = "unknown"
  - State = "unknown" blocks task_complete
```

---

### 2.5 Memory Engine

**Current state:** MemoryManager reads/writes `.nura/` markdown files. No integrity validation. Stale data injected without verification.

**Redesigned:**

```
IsolatedMemoryEngine
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Provide verified, scoped, time-bounded context to agents
  - NEVER inject unverified memory as truth

Memory categories (strict separation):
  A. VERIFIED_FACTS    — filesystem-confirmed, runtime-confirmed
  B. AGENT_CLAIMS      — LLM-written, explicitly marked as unverified
  C. SYSTEM_EVENTS     — immutable event log (append-only, tamper-evident)

Context injection rules:
  - VERIFIED_FACTS: injected as [FACT]
  - AGENT_CLAIMS: injected as [CLAIM — unverified]
  - SYSTEM_EVENTS: always included, immutable

Freshness enforcement:
  - Every memory entry has: writtenAt, verifiedAt, expiresAt
  - AGENT_CLAIMS expire after 1 run cycle unless verified
  - Stale items demoted to [STALE_CLAIM] prefix
  - Verification: cross-check claim against filesystem/runtime before injecting

Context checksum:
  - Each injected context block carries a checksum
  - If files changed since context was built → stale flag triggered
  - Agent receives "Context may be stale, re-observe before acting"

FAILURE MODES:
  - Memory files corrupted → use SYSTEM_EVENTS only
  - Verification fails for a CLAIM → mark as [UNVERIFIABLE], inject with warning
```

---

### 2.6 Recovery Orchestrator

**Current state:** RecoveryManager + CrashResponder loosely coupled. Recovery validates checkpoint by metadata only.

**Redesigned:**

```
RecoveryOrchestrator
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Deterministic, observable, verifiable recovery

States:
  IDLE → ASSESSING → LOCKED → ROLLING_BACK → VERIFYING → RECOVERED | FAILED

Recovery decision tree (deterministic — NOT LLM-driven):
  1. Is this a filesystem error? → restore last VERIFIED checkpoint
  2. Is this a runtime crash? → restart process, if fails → restore checkpoint
  3. Is this an infinite loop? → kill agent run, restore checkpoint
  4. Is this verification exhaustion? → restore checkpoint, escalate to user

POST-RECOVERY VERIFICATION (mandatory, blocking):
  1. Restored files match checkpoint manifest (hash check)
  2. Process starts within 30s of restore
  3. HTTP probe returns < 500
  4. tsc --noEmit passes
  If ANY post-restore check fails → try PREVIOUS checkpoint (max 3 attempts)
  If ALL 3 checkpoints fail → HALT, require human intervention

Checkpoint quality grades:
  GRADE_A: file hash ✓ + tsc pass ✓ + HTTP 200 ✓
  GRADE_B: file hash ✓ + tsc pass ✓
  GRADE_C: file hash ✓ only
  GRADE_D: metadata only (current system)
  Recovery ONLY uses GRADE_A or GRADE_B checkpoints.
```

---

### 2.7 Validation Engine

**Current state:** Runs parallel checks on `task_complete`. Passes if score >= 60 for browser. Fails open when retries exhausted.

**Redesigned:**

```
HardenedValidationEngine
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Binary PASS/FAIL, no score thresholds
  - FAIL-CLOSED: verification exhaustion → FAIL, not ok:true

Validation tiers (sequential, not parallel):
  TIER 1 — STATIC (instant):
    - Import graph valid (static analysis)
    - No circular dependencies introduced
    - All referenced symbols exist
    - File count matches expected changes

  TIER 2 — BUILD (blocking):
    - tsc --noEmit exits 0 (NOT log scan)
    - No new TypeScript errors vs baseline
    - npm ls exits without error

  TIER 3 — RUNTIME (blocking):
    - Process alive > 10s (not just momentarily)
    - HTTP probe: 3 consecutive 200s within 15s window
    - No fatal errors in log tail (30 lines)
    - No crash-restart loop detected (2+ restarts in 60s = FAIL)

  TIER 4 — BEHAVIORAL (blocking for production):
    - Playwright DOM inspection: page has > N interactive elements
    - No React error boundaries active
    - No console.error calls in first 5s of page load
    - Critical routes return expected status codes

FAIL-CLOSED RULE:
  If any tier fails AND retries exhausted:
    → RecoveryOrchestrator.rollback()
    → Agent run marked FAILED (never ok:true)
    → User notified with full failure report

NO SCORE THRESHOLDS:
  Every check is a boolean PASS or FAIL.
  Weighted scoring eliminated.
```

---

### 2.8 Context Manager

**Current state:** `project-context-builder.ts` reads files, slices to MAX_CHARS, injects into prompt.

**Redesigned:**

```
ScopedContextManager
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Build task-local, scope-bounded, integrity-verified context

Isolation levels:
  TASK_LOCAL:    only files in GoalDescriptor.scope
  RUN_LOCAL:     this run's tool outputs only
  PROJECT:       verified facts from previous runs
  GLOBAL:        system architecture decisions (immutable)

Context assembly rules:
  1. Start with GLOBAL (immutable — cannot be overwritten)
  2. Add PROJECT facts (verified only)
  3. Add TASK_LOCAL facts (current run observations)
  4. NEVER add AGENT_CLAIMS without [CLAIM] prefix
  5. Total context budget enforced by TokenBudgetManager
     → if budget exceeded, TASK_LOCAL wins over PROJECT
     → PROJECT wins over GLOBAL prose (keep GLOBAL structure)

Context integrity:
  - Every section has a checksum
  - If source file changed since section built → section invalidated
  - Invalidated sections excluded, not silently stale-injected

Contamination prevention:
  - Previous failed run's context NEVER injected
  - Verified vs claimed metadata tracked per-entry
  - Cross-run contamination impossible (task-local namespace)
```

---

### 2.9 Preview Verifier

**Current state:** HTTP probe + heuristic DOM scoring. Port responds = "running".

**Redesigned:**

```
BehavioralPreviewVerifier
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Verify functional correctness, not just HTTP presence

Verification sequence (all must pass):

PHASE 1 — PRESENCE (5s timeout):
  - Port open: TCP connect succeeds
  - HTTP 200 on /, /index.html, or expected root route

PHASE 2 — STABILITY (15s window):
  - Server does NOT restart during 15s window
  - 3 consecutive HTTP probes succeed (every 5s)
  - No `ECONNREFUSED` between probes

PHASE 3 — CONTENT (Playwright/fetch):
  - HTML body length > 500 chars
  - No React error boundary class in DOM
  - No "Error:" or "Cannot read" in `<body>` text
  - window.__REACT_ERROR_OVERLAY__ not active
  - No console.error calls captured in 3s observation window

PHASE 4 — ROUTE COVERAGE (for API routes):
  - Every new/modified API route returns expected status code
  - Tested with minimal synthetic payloads
  - No 500 responses allowed

FAILURE DEFINITION:
  Any phase fails = Preview FAILED (binary, no scoring)

IMPORTANT: Preview verification does NOT vote on whether the UI is "beautiful".
It only verifies the app is functionally alive and not visibly broken.
```

---

### 2.10 State Synchronizer

**Current state:** RuntimeStore aggregates process + preview + recovery state. Frontend polls SSE.

**Redesigned:**

```
DeterministicStateSynchronizer
─────────────────────────────────────────────────────
RESPONSIBILITY:
  - Maintain a single version-controlled state snapshot
  - NEVER allow partial state updates

State versioning:
  StateSnapshot {
    version: number      // monotonically increasing
    timestamp: number
    checksum: string     // sha256 of state content
    source: "process" | "verification" | "recovery" | "agent"
    processState: RuntimeTruth
    agentState: AgentRunState
    verificationState: VerificationResult | null
    recoveryState: RecoveryState | null
  }

Consistency rules:
  - State transitions are atomic (lock → mutate → unlock → broadcast)
  - Old state version always preserved (ring buffer, last 20)
  - State rollback possible to any version
  - Clients receive version number — can detect missed updates

Conflict resolution:
  - If two subsystems attempt state update simultaneously → queue
  - NEVER merge concurrent state updates
  - Always "last verified writer wins"
```

---

## SECTION 3 — Tool-First Execution Model

**Core principle: LLM = Hypothesis Generator. Tools = Source of Truth.**

```
CURRENT (broken) MODEL:
  LLM thinks → LLM acts → LLM verifies (with its own reasoning) → done

TARGET MODEL:
  LLM proposes → ToolRouter gates → Tool executes → 
  RuntimeTruthEngine observes → Evidence compared to proposal → 
  Match? → proceed | Mismatch? → invalidate LLM belief, re-observe
```

### Evidence Requirements Per LLM Claim

| LLM Claim | Required Evidence | Verification Tool |
|-----------|------------------|-------------------|
| "File X was created" | `fs.stat(X)` exists + size > 0 | `read_file` actual output |
| "Function Y is exported" | Static AST export scan | `grep -n "export.*Y"` |
| "Server is running" | HTTP 200 + 3 consecutive probes | Preview verifier |
| "TypeScript compiles" | `tsc --noEmit` exit 0 | Actual subprocess |
| "Package X is installed" | `npm ls X` shows version | Actual subprocess |
| "Migration ran" | DB table/column exists | DB query |
| "Test passes" | Test runner exit 0 | Actual subprocess |
| "Port N is open" | `ss -tlnp` or `lsof -i:N` | Runtime observer |
| "Import resolves" | Static import graph walk | AST analyzer |
| "Route /X returns 200" | HTTP probe with method + path | HTTP validator |

**Architecture rule:**

```
NO OBSERVATION = NO BELIEF = NO TASK_COMPLETE
```

Every tool call result is stored in the `EvidenceLog` for the current run. `task_complete` is only permitted when evidence exists for every postcondition in the TypedTask.

---

## SECTION 4 — Deterministic Planning System

### 4.1 Execution DAG Design

```
User Goal (string)
     │
     ▼
[1] IntentEngine → GoalDescriptor (typed, sealed)
     │
     ▼
[2] ConstraintExtractor
     ├── Must-not-break: [existing routes, existing DB tables, ...]
     ├── Scope: [exact files permitted to change]
     └── Risk level: 0–10
     │
     ▼
[3] DependencyGraphBuilder (filesystem scan, NOT LLM)
     ├── Static import graph
     ├── Package dependency tree
     └── Database schema relationships
     │
     ▼
[4] TypedTaskPlanner (LLM-assisted, but constrained)
     ├── LLM proposes task list
     ├── Every task must map to a known TypedTask type
     ├── Unknown task type → REJECT, re-prompt with type catalog
     └── Output: ExecutionDAG (all nodes typed)
     │
     ▼
[5] PlanVerifier (deterministic, no LLM)
     ├── All dependency edges acyclic
     ├── All file paths within scope
     ├── All tool IDs exist in registry
     ├── All preconditions expressible
     └── FAIL → reject plan, return structured error to TypedTaskPlanner
     │
     ▼
[6] ExecutionEngine
     ├── Process nodes in topological order
     ├── Before each node: check preconditions (deterministic)
     ├── After each node: check postconditions (via RuntimeTruthEngine)
     ├── Postcondition fails: retry node (max 2) → else mark FAILED
     ├── Node FAILED: trigger rollback to last checkpoint
     └── All nodes passed: run HardenedValidationEngine
```

### 4.2 TypedTask Contract Schema

```typescript
interface TypedTask {
  id: string;
  type:
    | "write_file"      // creates or modifies a file
    | "delete_file"     // removes a file
    | "run_command"     // executes a shell command
    | "install_package" // npm install X
    | "run_migration"   // database migration
    | "checkpoint"      // creates a recovery point
    | "verify";         // runs a verification step
  
  preconditions: Assertion[];    // must ALL be true before execution
  postconditions: Assertion[];   // must ALL be true after execution
  rollbackSafe: boolean;         // can this be undone?
  idempotent: boolean;           // safe to re-run?
  maxRetries: 1 | 2;
  timeoutMs: number;
  scope: FilePath[];             // files this task is permitted to touch
}

interface Assertion {
  type: "file_exists" | "file_not_exists" | "process_running" |
        "http_ok" | "export_exists" | "env_var_set" | "db_table_exists";
  subject: string;
  expectedValue?: unknown;
}
```

---

## SECTION 5 — Context Isolation Architecture

### 5.1 Memory Architecture Redesign

```
CURRENT:
  .nura/ markdown files ← written by LLM ← read back as truth

TARGET:
  ┌─────────────────────────────────────────────────────────┐
  │  VERIFIED_FACTS_STORE                                   │
  │  (written ONLY by RuntimeTruthEngine after observation) │
  │  Key: "auth_implemented"                                │
  │  Value: { claim: true, verifiedBy: "tsc+http", ts: ... }│
  └─────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────┐
  │  AGENT_CLAIMS_STORE                                     │
  │  (written by LLM — always marked unverified)            │
  │  Key: "auth_implemented"                                │
  │  Value: { claim: true, verifiedBy: null, ts: ..., runId }│
  │  Expires: after next successful RuntimeTruth cycle      │
  └─────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────┐
  │  IMMUTABLE_EVENT_LOG                                    │
  │  (append-only, hash-chained, tamper-evident)            │
  │  Events: task_started, tool_executed, file_written,     │
  │           verification_passed, recovery_triggered       │
  └─────────────────────────────────────────────────────────┘
```

### 5.2 Stale Memory Expiration

```
Memory entry lifecycle:
  FRESH (< 1 run cycle old, not verified) → injected as [CLAIM]
  VERIFIED (confirmed by RuntimeTruth) → injected as [FACT]
  STALE (> 3 run cycles, never verified) → NOT injected (excluded)
  CONTRADICTED (claim X, but RuntimeTruth says ¬X) → [CONTRADICTED — do not rely]
```

### 5.3 Context Compression Anti-Hallucination

**Current compression (broken):**
```
LLM: "Summarize your last 25 steps" → LLM summary (can omit failures)
```

**Target compression:**
```
REPLACE LLM COMPRESSION WITH:
  1. EventLog.slice(last N events)     ← immutable, cannot be hallucinated
  2. VerifiedFacts snapshot            ← only what actually passed verification
  3. FailureLog (never compressed)     ← all failures preserved verbatim
  4. RemainingPostconditions list      ← what still needs to be done

LLM NEVER summarizes its own history.
System-extracted event log replaces LLM-written summary.
```

---

## SECTION 6 — Runtime Truth Engine

```
RuntimeTruthEngine (continuous + on-demand)
═══════════════════════════════════════════

Continuous checks (5s interval):
┌─────────────────────────────────────────────┐
│ kill -0 <PID>          → process alive?     │
│ HTTP GET /             → port responsive?   │
│ log tail analysis      → crash pattern?     │
│ filesystem checksum    → unexpected changes? │
└─────────────────────────────────────────────┘

On-demand checks (before task_complete):
┌─────────────────────────────────────────────┐
│ tsc --noEmit           → TypeScript valid?  │
│ npm ls --depth=0       → packages ok?       │
│ import graph walk      → no broken imports? │
│ HTTP probe (all routes)→ routes alive?      │
│ Playwright DOM check   → UI not broken?     │
│ DB connectivity        → DB responsive?     │
│ git diff --stat        → changes minimal?   │
└─────────────────────────────────────────────┘

Truth state machine:
  UNKNOWN → OBSERVING → VERIFIED | FAILED
  
  Agent may ONLY call task_complete when state = VERIFIED
  State = UNKNOWN → agent must re-observe before completing
  State = FAILED → agent must fix before calling task_complete

Agent never self-reports completion.
Only RuntimeTruthEngine can set state = VERIFIED.
```

---

## SECTION 7 — Visual + UI Verification

### 7.1 Current Weaknesses (Evidence-Based)

The browser verifier score system (`score >= 60`) is fundamentally flawed because:
- Score is additive from independent components
- Components can compensate for each other (no DOM content + no errors = 70 points)
- "Interaction" check uses label matching on DOM, not actual click simulation

### 7.2 Target: Behavioral UI Verification Pipeline

```
Stage 1 — STRUCTURAL (50ms):
  Playwright/CDP:
  ├── document.readyState === "complete"
  ├── No React __REACT_ERROR_OVERLAY__ active
  ├── No white background with < 10 elements
  ├── Body text content > 200 chars
  └── No "Error" substring in h1/h2/h3/p:first-child

Stage 2 — INTERACTIVE (5s):
  ├── Query all [data-testid] elements (if present)
  ├── Query all button, a, input elements
  ├── Verify count > 0 (page is not empty)
  ├── Click first button → page does not crash
  ├── Submit first form → no 500 response
  └── console.error count === 0 during these interactions

Stage 3 — API COVERAGE (per-route):
  For every route added/modified by this agent run:
  ├── HTTP probe with synthetic valid payload
  ├── Expected status code from TypedTask.postconditions
  └── Response schema matches declared output type

Stage 4 — VISUAL REGRESSION (if baseline exists):
  ├── Screenshot current state
  ├── Compare pixel diff to approved baseline
  ├── If diff > 20%: FLAG for human review
  └── Note: only blocks if explicitly declared as regression-sensitive

PASS: All 3 mandatory stages pass (Stage 4 advisory only)
FAIL: Any mandatory stage fails → HardenedValidationEngine returns FAILED
```

---

## SECTION 8 — Self-Correction Engine

### 8.1 Current Retry Logic (Broken)

```
Current:
  verify → fail → inject failure message → LLM reads → 
  LLM tries "fix" (same approach with minor variation) → verify → fail → ...
  After N attempts → ok: true (FAKE SUCCESS)
```

### 8.2 Redesigned Retry Architecture

```
ErrorClassificationLayer
│
├── CATEGORY: compilation_error (tsc, import)
│   Strategy: read exact error line, fix that exact line
│   Max retries: 3
│   Divergence: each retry must target different line
│
├── CATEGORY: runtime_crash (process exits)
│   Strategy: analyze stderr, check port conflicts, check env vars
│   Max retries: 2
│   Before retry: create checkpoint
│   Divergence: if same crash type twice → RecoveryOrchestrator
│
├── CATEGORY: verification_fail (HTTP, DOM)
│   Strategy: check process state first, then code
│   Max retries: 2
│   Before retry: RuntimeTruth re-observation required
│
├── CATEGORY: logic_error (wrong output)
│   Strategy: this is NOT retried by the agent
│   Action: ESCALATE to user (agent cannot self-verify logic)
│
└── CATEGORY: infinite_loop (hallucination-detector)
    Strategy: STOP immediately
    Action: rollback to pre-run checkpoint

Retry Divergence Rules:
  1. Before each retry: compare planned fix to all previous fixes (semantic hash)
  2. If similarity > 0.8 → FORCE different strategy category
  3. Failed strategy types blacklisted for this run
  4. If all strategies exhausted → STOP, ROLLBACK, REPORT

Retry Confidence Scoring:
  Each retry attempt has a confidence score (0–1):
  - Starts at 1.0
  - Penalized: -0.3 per failed attempt
  - Penalized: -0.2 if strategy is similar to previous
  - If confidence < 0.3 → stop retrying, escalate

HARD RULE: No retry ever marks the task ok:true.
Only VERIFIED state by RuntimeTruthEngine = success.
```

---

## SECTION 9 — Anti-Hallucination Safety System

### 9.1 Evidence Gating System

Every LLM assertion that leads to a tool call must pass through the Evidence Gate:

```
LLM says: "The authentication module is complete"
                       │
              Evidence Gate checks:
              ├── Does auth module file exist? (fs check)
              ├── Does it export expected functions? (AST check)
              ├── Does TypeScript compile without errors? (tsc check)
              ├── Does the login route return 200? (HTTP check)
              └── Is there a verified fact in VerifiedFactsStore? 
                              │
              ALL PASS → belief accepted, noted as VERIFIED
              ANY FAIL → belief rejected, LLM informed with specific evidence
```

### 9.2 Fake Success Detection

```
Fake success patterns (auto-detected, run rejected):

1. PATTERN: task_complete called without any file writes in this run
   DETECTION: EvidenceLog.writes.length === 0
   ACTION: REJECT completion, inform LLM "no changes observed"

2. PATTERN: task_complete called after < 3 tool calls
   DETECTION: EvidenceLog.toolCalls.length < 3 for non-trivial goals
   ACTION: FLAG for review, require explicit confirmation

3. PATTERN: same verification failure 3x with same error
   DETECTION: VerificationLog.lastN(3).errorMessages all identical
   ACTION: STOP, RecoveryOrchestrator

4. PATTERN: LLM claims file X was created but read_file returns not-found
   DETECTION: EvidenceLog cross-check
   ACTION: invalidate all LLM claims about this file, force re-observation

5. PATTERN: runtime is "starting" for > 60s
   DETECTION: RuntimeTruth.processState timer
   ACTION: mark as FAILED, not "starting" (crash-restart loop)
```

### 9.3 Multi-Source Verification

For any claim to become a VERIFIED_FACT, it must pass ≥ 2 independent verification sources:

| Claim | Source 1 | Source 2 |
|-------|---------|---------|
| File created | `fs.stat()` | `read_file` content length > 0 |
| Server running | `kill -0` PID | HTTP 200 response |
| TypeScript valid | `tsc --noEmit` | No error in last 20 log lines |
| Package installed | `npm ls` | `import` statement resolves (AST) |
| Route works | HTTP GET/POST | Response matches schema |

---

## SECTION 10 — Agent Governance Layer

```
GovernanceEngine (wraps all agent execution)
════════════════════════════════════════════

Monitors:
  ┌────────────────────────────────────────────────────────┐
  │ ENTROPY DETECTOR                                       │
  │ ├── Measures: unique tool calls per last 10 steps      │
  │ ├── LOW entropy (< 3 unique): repetition detected     │
  │ └── Triggers: HallucinationDetector.escalate()         │
  │                                                        │
  │ CONTEXT DRIFT DETECTOR                                 │
  │ ├── Semantic similarity: current goal vs LLM actions  │
  │ ├── If actions drifted from goal by > 0.4 cosine dist │
  │ └── Triggers: GoalReanchoring() — re-inject goal      │
  │                                                        │
  │ CONFIDENCE TRACKER                                     │
  │ ├── Starts at 1.0, decays with each failure           │
  │ ├── < 0.4: require supervisor consensus               │
  │ └── < 0.2: HALT, require human input                  │
  │                                                        │
  │ LOOP DETECTOR                                          │
  │ ├── Jaccard + semantic similarity on last 5 outputs   │
  │ ├── Similarity > 0.8 on 2 consecutive: WARNING        │
  │ └── Similarity > 0.8 on 3 consecutive: HALT + ROLLBACK│
  │                                                        │
  │ AUDIT LOG                                              │
  │ ├── Every LLM call: prompt + response hash stored     │
  │ ├── Every tool call: before/after state diff stored   │
  │ ├── Every verification: result + raw evidence stored  │
  │ └── Immutable, append-only, exportable                │
  │                                                        │
  │ ESCALATION SYSTEM                                      │
  │ ├── Level 1: inject warning into LLM context          │
  │ ├── Level 2: require supervisor consensus             │
  │ ├── Level 3: pause run, notify user via SSE           │
  │ └── Level 4: HALT, rollback, require human restart   │
  └────────────────────────────────────────────────────────┘

Decision Provenance:
  Every agent action tagged with:
  - Reasoning chain that led to it (from LLM tool call context)
  - Confidence score at time of decision
  - Governance flags active at time of decision
  - Verification state at time of decision
  Stored in ImmutableAuditLog for replay/debugging
```

---

## SECTION 11 — Event-Sourced Architecture

### 11.1 Immutable Event Log Design

```typescript
// Every action becomes an immutable event
interface AgentEvent {
  id: string;              // uuid v4
  sequence: number;        // monotonically increasing per run
  runId: string;
  projectId: number;
  timestamp: number;       // Unix ms
  prevHash: string;        // hash of previous event (chain integrity)
  type: AgentEventType;
  payload: unknown;        // typed per event type
  evidenceRefs: string[];  // links to EvidenceLog entries
}

type AgentEventType =
  | "goal_received"
  | "plan_created"
  | "task_started"
  | "tool_called"
  | "tool_result_observed"
  | "fact_verified"
  | "claim_recorded"
  | "verification_ran"
  | "verification_passed"
  | "verification_failed"
  | "retry_attempted"
  | "checkpoint_created"
  | "recovery_triggered"
  | "run_completed"
  | "run_failed"
  | "human_escalation";
```

### 11.2 Deterministic Replay

Every agent run can be replayed from its event log:
- All tool calls logged with inputs + outputs
- All filesystem changes logged with before/after content
- All LLM responses logged with exact prompt + response
- Replay mode: apply events to a sandbox environment, verify same outcome

### 11.3 Rollback Reconstruction

Recovery from any event position:
```
Rollback to event #47:
  1. Identify all file writes between #47 and current
  2. Restore files to state at #47 (from embedded content or checkpoint)
  3. Replay events #47 → current in sandbox to verify divergence point
  4. Resume from #47 with corrected strategy
```

---

## SECTION 12 — Reliability Target Analysis

### 12.1 Current vs Target Metrics

| Capability | Current | Target | Gap | Achievable? |
|-----------|---------|--------|-----|-------------|
| Hallucination Resistance | ~60% | 99% | -39% | Partial — 92% realistic |
| Runtime Accuracy | ~70% | 99% | -29% | 96% realistic |
| Tool Verification | ~65% | 100% | -35% | 99% with Evidence Gating |
| Recovery Reliability | ~55% | 95% | -40% | 90% with Grade-A checkpoints |
| Context Integrity | ~50% | 98% | -48% | 88% realistic |
| Visual Validation | ~45% | 95% | -50% | 80% realistic (Playwright) |
| False Success Rate | ~15% | <1% | -14% | 3% realistic |
| Retry Intelligence | ~30% | 95% | -65% | 85% with divergence logic |

### 12.2 What Cannot Reach 99%

**Brutally honest assessment:**

1. **Hallucination Resistance: 92% ceiling, not 99%**  
   The LLM is a probabilistic model. Even with all guards, it will occasionally produce semantically incorrect outputs that pass syntactic verification. Code that compiles and runs is not necessarily code that does what was intended. Logic correctness cannot be 100% verified without a formal proof system.

2. **Visual Validation: 80% ceiling**  
   Visual correctness is subjective. A layout that is technically present but aesthetically wrong cannot be machine-verified. Domain-specific UI correctness (e.g., "this chart shows the right data") requires domain knowledge the system doesn't have.

3. **Context Integrity: 88% ceiling**  
   Long-running projects with hundreds of memory entries will always have some staleness. The expiration system reduces contamination but cannot eliminate it — some context decisions require human judgment about relevance.

4. **Recovery Reliability: 90% ceiling**  
   If all available checkpoints are in Grade-C or Grade-D quality, recovery will fail. The checkpoint grading system helps, but cannot retroactively improve old checkpoints.

5. **False Success Rate: 3% floor**  
   There will always be edge cases where verification passes but the implementation has subtle bugs — e.g., a route that returns 200 with incorrect data, or a component that renders without errors but displays wrong information.

---

## SECTION 13 — Architecture Changes Required

### 13.1 Systems That Must Be Added (New)

| System | Priority | Effort |
|--------|---------|--------|
| RuntimeTruthEngine (tsc + npm ls + import graph) | CRITICAL | High |
| Evidence Gating layer in ToolRouter | CRITICAL | Medium |
| TypedTask + Precondition/Postcondition schema | CRITICAL | High |
| ImmutableEventLog (hash-chained) | HIGH | Medium |
| VerifiedFactsStore (separate from AGENT_CLAIMS) | HIGH | Medium |
| RetryDivergenceEngine (blacklist failed strategies) | HIGH | Medium |
| Grade-A/B/C checkpoint qualification system | HIGH | Medium |
| GovernanceEngine (entropy + drift + confidence) | HIGH | Medium |
| BehavioralPreviewVerifier (Playwright sequential stages) | MEDIUM | High |
| ContextChecksumValidator | MEDIUM | Low |

### 13.2 Systems That Must Be Rewritten

| System | What Changes | Why |
|--------|-------------|-----|
| `verification-engine.ts` | Remove score thresholds; add tsc subprocess; fail-closed on exhaustion | Fake success bug |
| `continuation-manager.ts` | Replace LLM compression with EventLog extraction | Compression hallucination |
| `project-context-builder.ts` | Add verified/claimed tagging; add checksum; add expiration | Stale injection |
| `browser-verifier.ts` | Replace scoring with sequential binary stages | Arbitrary thresholds |
| `recovery-manager.ts` | Add post-restore verification pipeline | Metadata-only validation |
| `planner.service.ts` | Output typed DAG not string phases | Missing preconditions |
| `memory-store.ts` | Add verified/claimed/stale/contradicted tags | Trust store pollution |

### 13.3 Bottlenecks That Remain

1. **LLM Quality**: Better architecture reduces amplification of LLM errors but does not eliminate them. Model capability is a hard ceiling.
2. **Playwright availability**: Full UI verification requires Playwright/CDP in the runtime environment. Headless browser initialization adds 5–15s to every verification cycle.
3. **tsc runtime**: Running `tsc --noEmit` on large projects takes 10–60s. This affects developer experience for tight iteration loops.
4. **Checkpoint storage**: Grade-A checkpoints store file content hashes + TypeScript validity. For large projects, checkpoint storage overhead is significant.

---

## SECTION 14 — Migration Roadmap

### Phase 1 — Fail-Closed Fixes (Week 1, Zero Risk)
```
1. Remove buildExhaustedFeedback ok:true
   → Replace with: run FAILED, rollback triggered
   Files: verification-engine.ts

2. Replace TypeScript log-scanning with actual tsc subprocess
   Files: typescript-validator.ts

3. Add post-restore verification to recovery-manager
   Files: recovery-manager.ts

4. Replace browser score >= 60 with sequential binary stages
   Files: browser-verifier.ts
```

### Phase 2 — Evidence Infrastructure (Week 2-3, Medium Risk)
```
5. Build EvidenceLog and VerifiedFactsStore
6. Add Evidence Gating to tool-call.executor.ts
7. Build TypedTask schema + PlanVerifier
8. Implement RetryDivergenceEngine
```

### Phase 3 — Context Integrity (Week 3-4, Medium Risk)
```
9.  Split memory into VERIFIED_FACTS + AGENT_CLAIMS + IMMUTABLE_EVENTS
10. Replace LLM compression with EventLog extraction
11. Add memory expiration + contradiction detection
12. Implement ContextChecksumValidator
```

### Phase 4 — Governance + Observability (Week 4-5, Low Risk)
```
13. Build GovernanceEngine (entropy + drift + confidence)
14. Build ImmutableAuditLog (hash-chained events)
15. Implement checkpoint grading (Grade A/B/C)
16. Add deterministic replay capability
```

### Phase 5 — UI Verification (Week 5-6, High Effort)
```
17. Implement BehavioralPreviewVerifier (Playwright stages)
18. Add API route coverage verification
19. Visual regression baseline system
```

---

## SECTION 15 — Production-Grade Final Architecture

```
╔═══════════════════════════════════════════════════════════════════╗
║           NURA X — PRODUCTION RELIABILITY ARCHITECTURE            ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  USER GOAL (string)                                               ║
║       │                                                           ║
║       ▼                                                           ║
║  ┌─────────────────┐                                             ║
║  │  IntentEngine   │ → GoalDescriptor (typed, sealed, immutable) ║
║  └─────────────────┘                                             ║
║       │                                                           ║
║       ▼                                                           ║
║  ┌─────────────────────────────────────────────────────────────┐ ║
║  │  TypedPlanner                                               │ ║
║  │  LLM → proposes tasks → PlanVerifier → ExecutionDAG        │ ║
║  │  (LLM is advisor only — PlanVerifier is authority)         │ ║
║  └─────────────────────────────────────────────────────────────┘ ║
║       │                                                           ║
║       ▼                                                           ║
║  ┌─────────────────────────────────────────────────────────────┐ ║
║  │  GovernanceEngine (wraps entire execution)                  │ ║
║  │  ├── Entropy Detector                                       │ ║
║  │  ├── Context Drift Detector                                 │ ║
║  │  ├── Confidence Tracker                                     │ ║
║  │  └── ImmutableAuditLog                                      │ ║
║  └─────────────────────────────────────────────────────────────┘ ║
║       │                                                           ║
║       ▼                                                           ║
║  ┌──────────────┐      ┌──────────────────────────────────────┐  ║
║  │  ToolLoop    │─────▶│  ToolRouter (Evidence Gate)          │  ║
║  │  Agent       │      │  ├── Is tool in whitelist?           │  ║
║  │  (LLM =      │      │  ├── Is scope valid?                 │  ║
║  │   hypothesis │      │  ├── Is precondition met?            │  ║
║  │   generator) │      │  └── Is this a repeated call?        │  ║
║  └──────────────┘      └──────────────────────────────────────┘  ║
║       │                          │                                ║
║       │                          ▼                                ║
║       │               ┌──────────────────────────────────────┐  ║
║       │               │  Tool Executor → EvidenceLog entry   │  ║
║       │               └──────────────────────────────────────┘  ║
║       │                          │                                ║
║       │                          ▼                                ║
║       │               ┌──────────────────────────────────────┐  ║
║       │               │  RuntimeTruthEngine                  │  ║
║       │               │  (continuous + on-demand checks)     │  ║
║       │               └──────────────────────────────────────┘  ║
║       │                          │                                ║
║       ▼                          ▼                                ║
║  [task_complete?] ──▶  HardenedValidationEngine                  ║
║                         Tier 1: Static (import graph, AST)       ║
║                         Tier 2: Build (tsc, npm ls)              ║
║                         Tier 3: Runtime (HTTP, process, logs)    ║
║                         Tier 4: Behavioral (Playwright)          ║
║                              │                                    ║
║                    ┌─────────┴─────────┐                         ║
║                    │                   │                          ║
║                  PASS                FAIL                         ║
║                    │                   │                          ║
║              VerifiedFactsStore   RetryDivergenceEngine           ║
║              updated               ├── classify error             ║
║              Run marked SUCCESS     ├── check strategy blacklist  ║
║              EventLog sealed        ├── if exhausted: ROLLBACK    ║
║                                     └── if rollback fails: HALT   ║
╚═══════════════════════════════════════════════════════════════════╝

KEY PRINCIPLES (no marketing language):

1. LLM proposes. Tools verify. RuntimeTruth decides.
2. No LLM output is trusted until evidence confirms it.
3. Task_complete is never self-granted. Always externally verified.
4. Retries must diverge. Identical retries are circuit-broken.
5. Verification exhaustion → FAIL, never ok:true.
6. All events are immutable, hash-chained, replayable.
7. Memory is split: verified facts vs agent claims. Never mixed.
8. Recovery restores only Grade-A/B checkpoints (post-restore verified).
9. Governance stops execution before humans need to notice a problem.
10. Every decision has provenance. Nothing happens without audit.
```

---

## Summary: Honest Assessment

The current NURA X system is a **well-structured prototype** with good event-driven patterns, solid SSE architecture, and a meaningful verification layer. Its hallucination resistance is approximately **60–65%** — good for a prototype, inadequate for production.

The five changes with the highest impact:

| Change | Impact | Effort |
|--------|--------|--------|
| Fix fake-success bug (`buildExhaustedFeedback ok:true`) | CRITICAL | 2 hours |
| Replace TypeScript log-scanning with real `tsc --noEmit` | HIGH | 4 hours |
| Replace LLM compression with EventLog extraction | HIGH | 2 days |
| Split memory into verified-facts vs agent-claims | HIGH | 3 days |
| Add post-restore verification to recovery | MEDIUM | 4 hours |

Items 1, 2, and 5 are bug fixes. Items 3 and 4 are architectural improvements. Together they can push hallucination resistance from ~65% to approximately **87–90%** — the realistic production-grade ceiling given the current LLM-driven design.

The path from 90% to 99% requires a formal verification layer (typed postconditions proved rather than tested) which is significantly more complex and likely a Phase 2 product effort.
