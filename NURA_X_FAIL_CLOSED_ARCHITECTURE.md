# NURA X — Fail-Closed Verification Architecture
## Zero Fake Success. Binary Truth. Deterministic State Transitions.

> **Mode:** Engineering Specification — Implementation Ready  
> **Rule:** If verification fails, the system fails visibly. Never silently succeeds.  
> **Evidence base:** Exact code traces from current `server/` codebase

---

## PART 1 — Current Fake Success Paths (Exact Code Evidence)

Before the new architecture, every fake success path documented with file + line.

---

### FAKE SUCCESS PATH #1 — Verification Exhaustion Returns `success: true`

**File:** `server/agents/core/tool-loop/tool-loop.agent.ts`

```typescript
// Lines 168-175 — exhaustion sets saw_complete = true
} else if (retryCtrl.exhausted) {
  emitVerificationExhausted(input.projectId, input.runId, retryCtrl.maxRetries);
  messages[messages.length - 1] = {
    role: "tool", tool_call_id: call.id,
    content: buildExhaustedFeedback(report, retryCtrl.maxRetries),  // ← ok:true here
  };
  saw_complete = true;                          // ← fake success flag set
  lastSummary = `${summary} (completed with verification warnings)`;
}

// Lines 186-188 — saw_complete=true → success:true unconditionally
if (saw_complete) {
  return { success: true, steps, summary: lastSummary, stopReason: "complete", messages };
  //        ^^^^^^^^^^^^^ FAKE SUCCESS — verification failed but reported as done
}
```

**File:** `server/verification/engine/verification-engine.ts`

```typescript
// buildExhaustedFeedback() — explicitly returns ok:true after failure
export function buildExhaustedFeedback(report, maxRetries) {
  return JSON.stringify({
    ok: true,                          // ← ROOT CAUSE: ok:true on failure
    verification_exhausted: true,
    warning: `Verification failed after ${maxRetries} attempts...`,
  });
}
```

---

### FAKE SUCCESS PATH #2 — LLM Silent Exit Returns `success: true`

**File:** `server/agents/core/tool-loop/tool-loop.agent.ts`

```typescript
// Lines 129-133 — LLM stops calling tools → immediate success, NO verification
if (response.toolCalls.length === 0) {
  const summary = response.content?.trim() || lastSummary || "Done.";
  emit(input.runId, "agent.message", "complete", { text: summary });
  return { success: true, steps, summary, stopReason: "no_tool_calls", messages };
  //        ^^^^^^^^^^^^^ LLM decides it's done → no verification runs at all
}
```

---

### FAKE SUCCESS PATH #3 — Single Ungrounded Claim Continues Without Warning

**File:** `server/agents/supervisor/hallucination-detector.ts`

```typescript
// Lines 136-139 — one ungrounded claim → "continue" (not halted, not warned)
const recommendation =
  repetition.repeatCount >= 3 || fabricated.length > 0 ? "halt"
  : ungrounded.length >= 2                              ? "inject-warning"
  : "continue";   // ← single ungrounded claim: silently continues to task_complete
```

---

### FAKE SUCCESS PATH #4 — Recovery Validates Only Metadata

**File:** `server/infrastructure/recovery/recovery-manager.ts`

```typescript
// validateCheckpoint — checks DB status and file count only
const meta = await checkpointStore.get(projectId, checkpointId);
if (meta.status === "failed") { issues.push("..."); }
if (!meta.gitCommitSha && meta.fileCount === 0) { issues.push("..."); }
// MISSING:
// - tsc --noEmit on restored files
// - HTTP probe after restore
// - import graph validity
// Result: can declare "valid" checkpoint that contains broken code
```

---

## PART 2 — New Architecture Overview

```
╔══════════════════════════════════════════════════════════════════════╗
║              FAIL-CLOSED VERIFICATION PIPELINE                       ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  LLM calls task_complete                                             ║
║           │                                                          ║
║           ▼                                                          ║
║  ┌──────────────────────┐                                           ║
║  │  ExecutionGuard      │  GOVERNANCE LAYER                         ║
║  │  FailClosedPolicy    │  → Is this run in a valid state?          ║
║  └──────────────────────┘  → Is retry budget available?             ║
║           │                                                          ║
║     ALLOWED │ BLOCKED ────────────────────────────────────┐         ║
║           │                                               │         ║
║           ▼                                               ▼         ║
║  ┌──────────────────────┐                      ┌──────────────────┐ ║
║  │  RuntimeTruthEngine  │                      │  RecoveryOrch.   │ ║
║  │  (4 ordered tiers)   │                      │  rollback()      │ ║
║  │  TIER 1: Static      │                      └──────────────────┘ ║
║  │  TIER 2: Build       │                                           ║
║  │  TIER 3: Runtime     │                                           ║
║  │  TIER 4: Behavioral  │                                           ║
║  └──────────────────────┘                                           ║
║           │                                                          ║
║   VERIFIED │ FAILED ───────────────────────────────────┐            ║
║           │                                            │            ║
║           ▼                                            ▼            ║
║  ┌──────────────────────┐               ┌─────────────────────────┐ ║
║  │  VerificationEngine  │               │  RetryOrchestrator      │ ║
║  │  immutable result    │               │  retries left? → retry  │ ║
║  │  status: VERIFIED    │               │  exhausted? → ROLLBACK  │ ║
║  └──────────────────────┘               └─────────────────────────┘ ║
║           │                                            │            ║
║           ▼                                            ▼            ║
║     Run: SUCCESS                          RecoveryOrchestrator      ║
║     (only path)                           rollback → verify restore ║
║                                           → Run: FAILED             ║
║                                           (only path after exhaust) ║
╚══════════════════════════════════════════════════════════════════════╝

ABSOLUTE RULE:
  success:true  ←  only VerificationEngine.status === VERIFIED
  success:false ←  everything else, always, without exception
```

---

## PART 3 — VerificationStatus Enum (System-Wide)

```typescript
// Replaces all boolean ok:true/false and string-based states

enum VerificationStatus {
  VERIFIED   = "VERIFIED",    // all checks passed, run may complete
  FAILED     = "FAILED",      // one or more checks failed
  ROLLED_BACK = "ROLLED_BACK", // recovery triggered, files restored
  BLOCKED    = "BLOCKED",     // cannot even start (governance guard)
  UNKNOWN    = "UNKNOWN",     // observation incomplete, must re-observe
}

// NO VerificationStatus.WARNING
// NO VerificationStatus.PARTIAL
// NO VerificationStatus.EXHAUSTED_OK
// Warning states do not exist. Only VERIFIED or FAILED.
```

---

## PART 4 — Module Map (File-by-File)

### 4.1 `/verification/` — Refactored (Existing, Cleaned)

---

#### `server/verification/engine/verification-engine.ts`
**Responsibility:** Orchestrate verification tiers. Return immutable VerificationResult.  
**Single rule:** Never return VERIFIED if any TIER_2+ check fails.  
**LOC budget:** ~180

```typescript
// INPUTS
interface VerificationInput {
  projectId: number;
  runId: string;
  goalScope: string[];   // files declared in GoalDescriptor.scope
}

// OUTPUT — immutable after creation
interface VerificationResult {
  readonly status: VerificationStatus;    // VERIFIED | FAILED | UNKNOWN
  readonly tier: VerificationTier;        // highest tier that ran
  readonly checks: readonly CheckResult[];
  readonly issues: readonly string[];
  readonly evidence: readonly EvidenceEntry[];  // raw observations
  readonly elapsedMs: number;
  readonly timestamp: number;
}
// Object.freeze() applied before return — no mutation possible

// ORCHESTRATION
async function runVerificationEngine(input: VerificationInput): Promise<VerificationResult> {
  // Run TIER 1 first — if FAILED, short-circuit (no point running slower tiers)
  // Run TIER 2 — if FAILED, short-circuit
  // Run TIER 3 — if FAILED, short-circuit
  // Run TIER 4 — if FAILED, return FAILED
  // ALL pass → return VERIFIED
  // NEVER return ok:true when any tier fails
}

// REMOVED FROM THIS FILE:
// - buildExhaustedFeedback() with ok:true  ← DELETED
// - "warned" status                        ← DELETED
// - Any retry logic                        ← moved to RetryOrchestrator
```

**Coupling:** imports from `verification-result.ts`, `verification-policy.ts`, `runtime-truth/runtime-truth-engine.ts`  
**Does NOT import:** tool-loop, agents, memory, planner — zero agent coupling

---

#### `server/verification/engine/verification-result.ts`  *(NEW FILE)*
**Responsibility:** Immutable VerificationResult construction and serialization only.  
**LOC budget:** ~80

```typescript
// Factory — builds and freezes result
function createVerificationResult(
  status: VerificationStatus,
  checks: CheckResult[],
  evidence: EvidenceEntry[],
  elapsedMs: number,
): VerificationResult {
  return Object.freeze({
    status,
    tier: highestTierRan(checks),
    checks: Object.freeze([...checks]),
    issues: Object.freeze(extractFailedMessages(checks)),
    evidence: Object.freeze([...evidence]),
    elapsedMs,
    timestamp: Date.now(),
  });
}

// Serialize for LLM injection (replaces buildVerificationFeedback)
// RULE: If status !== VERIFIED → ok is always false
function serializeForLLM(result: VerificationResult, attempt: number, maxRetries: number): string {
  return JSON.stringify({
    ok: result.status === VerificationStatus.VERIFIED,  // ← only true on VERIFIED
    status: result.status,
    attempt,
    maxRetries,
    issues: result.issues,
    evidence: result.evidence.map(e => e.summary),
  });
}

// REMOVED: buildExhaustedFeedback() with ok:true — does not exist in this file
// REMOVED: any path that returns ok:true when status !== VERIFIED
```

---

#### `server/verification/engine/verification-policy.ts`  *(NEW FILE)*
**Responsibility:** Declare which checks are blocking, which are advisory only.  
**LOC budget:** ~60

```typescript
// Policy is data — not logic scattered across the engine

const BLOCKING_CHECKS: Set<CheckName> = new Set([
  "process_alive",
  "typescript_compile",   // ← tsc --noEmit subprocess (not log scan)
  "package_integrity",    // ← npm ls subprocess (not log scan)
  "http_stable",          // ← 3 consecutive 200s (not single probe)
  "import_graph_valid",   // ← static AST walk (not log scan)
]);

const ADVISORY_CHECKS: Set<CheckName> = new Set([
  "accessibility_labels",
  "visual_regression",
  "response_schema",
]);

// Advisory checks that fail → logged but NEVER block VERIFIED status
// Blocking checks that fail → status = FAILED, period

function isBlocking(check: CheckName): boolean {
  return BLOCKING_CHECKS.has(check);
}

// Exhaustion policy — ONLY valid response to exhaustion
const EXHAUSTION_POLICY = {
  action: "ROLLBACK" as const,       // ← trigger RecoveryOrchestrator
  markSuccess: false,                // ← NEVER true
  allowWarningSuccess: false,        // ← NEVER true
} as const;
```

---

#### `server/verification/engine/verification-errors.ts`  *(NEW FILE)*
**Responsibility:** Typed error classes for verification failures.  
**LOC budget:** ~70

```typescript
class VerificationBlockedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly blockedBy: CheckName,
    public readonly evidence: EvidenceEntry[],
  ) {
    super(`Verification blocked: ${reason}`);
    this.name = "VerificationBlockedError";
  }
}

class VerificationExhaustedError extends Error {
  // NEVER carries ok:true or success:true
  constructor(
    public readonly attempts: number,
    public readonly lastResult: VerificationResult,  // status = FAILED
  ) {
    super(`Verification exhausted after ${attempts} attempts — triggering rollback`);
    this.name = "VerificationExhaustedError";
    // Caller MUST handle this by triggering RecoveryOrchestrator
    // Caller MUST NOT catch and return success
  }
}

class VerificationUnknownStateError extends Error {
  constructor(public readonly reason: string) {
    super(`Verification state unknown: ${reason} — cannot complete`);
    this.name = "VerificationUnknownStateError";
  }
}
```

---

### 4.2 `/runtime-truth/` — NEW MODULE

This module did not exist. All truth observation lives here.

---

#### `server/runtime-truth/runtime-truth-engine.ts`  *(NEW)*
**Responsibility:** Orchestrate all 4 verification tiers in order. Expose single `observe()` call.  
**LOC budget:** ~150

```typescript
// The ONLY public API for truth observation
async function observe(projectId: number, scope: string[]): Promise<RuntimeSnapshot> {
  // TIER 1 — Static (instant, no process needed)
  const tier1 = await runStaticChecks(projectId, scope);
  if (tier1.status === "FAILED") return buildSnapshot("FAILED", tier1);

  // TIER 2 — Build (runs subprocesses, blocks on result)
  const tier2 = await runBuildChecks(projectId);
  if (tier2.status === "FAILED") return buildSnapshot("FAILED", tier2);

  // TIER 3 — Runtime (HTTP probes, process health)
  const tier3 = await runRuntimeChecks(projectId);
  if (tier3.status === "FAILED") return buildSnapshot("FAILED", tier3);

  // TIER 4 — Behavioral (Playwright, route coverage) — optional in dev
  const tier4 = await runBehavioralChecks(projectId);
  if (tier4.status === "FAILED") return buildSnapshot("FAILED", tier4);

  return buildSnapshot("VERIFIED", { tier1, tier2, tier3, tier4 });
}

// RuntimeSnapshot — immutable truth record
interface RuntimeSnapshot {
  readonly status: "VERIFIED" | "FAILED" | "UNKNOWN";
  readonly observedAt: number;
  readonly tiers: readonly TierResult[];
  readonly evidence: readonly EvidenceEntry[];  // raw subprocess outputs
}
```

---

#### `server/runtime-truth/runtime-observer.ts`  *(NEW)*
**Responsibility:** Continuous 5s background observation. Maintain live truth state.  
**LOC budget:** ~120

```typescript
// Continuous observer — independent of agent runs
class RuntimeObserver {
  private currentSnapshot: RuntimeSnapshot | null = null;
  private lastObservedAt = 0;
  private intervalId: NodeJS.Timeout | null = null;

  start(projectId: number): void {
    this.intervalId = setInterval(async () => {
      this.currentSnapshot = await this.observeLive(projectId);
      this.lastObservedAt = Date.now();
    }, OBSERVATION_INTERVAL_MS);   // 5000ms
  }

  // Returns current snapshot — NEVER infers state
  getSnapshot(): RuntimeSnapshot | null {
    if (Date.now() - this.lastObservedAt > STALE_THRESHOLD_MS) {
      return null;  // stale → caller must re-observe
    }
    return this.currentSnapshot;
  }

  private async observeLive(projectId: number): Promise<RuntimeSnapshot> {
    // Fast continuous checks only (process alive + HTTP probe)
    // Full tsc/npm ls run only in on-demand mode via RuntimeTruthEngine
  }
}
```

---

#### `server/runtime-truth/runtime-assertions.ts`  *(NEW)*
**Responsibility:** Individual deterministic assertion functions. One function per check.  
**LOC budget:** ~220

```typescript
// Each assertion: runs a real subprocess or syscall — NO log scanning

// TIER 1 — Static
async function assertImportGraphValid(files: string[]): Promise<AssertionResult>
async function assertNoCircularDependencies(files: string[]): Promise<AssertionResult>
async function assertFilesExist(paths: string[]): Promise<AssertionResult>

// TIER 2 — Build
async function assertTypeScriptCompiles(projectId: number): Promise<AssertionResult> {
  // Runs: tsc --noEmit --project tsconfig.json
  // Captures: stdout, stderr, exit code
  // PASSES: exit code === 0
  // FAILS: exit code !== 0 (with exact error lines as evidence)
  // NOT: log scanning
}

async function assertPackagesInstalled(projectId: number): Promise<AssertionResult> {
  // Runs: npm ls --depth=0 --json
  // Captures: JSON output
  // PASSES: no "extraneous" or "missing" entries
  // NOT: log scanning
}

// TIER 3 — Runtime
async function assertProcessAlive(projectId: number): Promise<AssertionResult>
  // kill -0 <PID> — not process registry status

async function assertHttpStable(projectId: number): Promise<AssertionResult> {
  // 3 consecutive HTTP 200s, 5s apart
  // Single response NOT sufficient
  // FAILS if any probe returns non-200 or times out
}

async function assertNoFatalLogs(projectId: number): Promise<AssertionResult>
  // last 20 lines only, exact fatal error patterns

// TIER 4 — Behavioral
async function assertDomRendered(projectId: number): Promise<AssertionResult>
async function assertNoReactErrorBoundary(projectId: number): Promise<AssertionResult>
async function assertRoutesRespond(routes: RouteExpectation[]): Promise<AssertionResult>
```

---

### 4.3 `/recovery/` — Refactored (Existing + New)

---

#### `server/recovery/recovery-orchestrator.ts`  *(NEW — replaces recovery-manager.ts)*
**Responsibility:** State machine for recovery lifecycle. Single entry point.  
**LOC budget:** ~200

```typescript
// Recovery state machine — deterministic, observable
type RecoveryState =
  | "IDLE"
  | "ASSESSING"
  | "LOCKED"
  | "ROLLING_BACK"
  | "VERIFYING_RESTORE"    // ← NEW: post-restore verification (missing in current system)
  | "RECOVERED"
  | "FAILED";

class RecoveryOrchestrator {
  private state: RecoveryState = "IDLE";

  // Single entry point — called when verification exhausted
  async trigger(input: RecoveryInput): Promise<RecoveryResult> {
    this.transition("ASSESSING");

    // 1. Select best Grade-A/B checkpoint
    const checkpoint = await this.selectCheckpoint(input.projectId);
    if (!checkpoint) {
      return this.halt("No valid checkpoint available — human intervention required");
    }

    this.transition("LOCKED");
    const lock = await acquireRecoveryLock(input.projectId);
    if (!lock.acquired) {
      return this.halt("Recovery lock held by concurrent operation");
    }

    try {
      this.transition("ROLLING_BACK");
      const rollback = await RollbackManager.execute(checkpoint);
      if (!rollback.success) {
        return this.halt(`Rollback failed: ${rollback.error}`);
      }

      // ← NEW: post-restore verification (currently missing)
      this.transition("VERIFYING_RESTORE");
      const postRestoreCheck = await this.verifyRestore(input.projectId);
      if (postRestoreCheck.status !== "VERIFIED") {
        // Try next checkpoint
        return this.tryNextCheckpoint(input, checkpoint.id);
      }

      this.transition("RECOVERED");
      return { status: VerificationStatus.ROLLED_BACK, checkpointId: checkpoint.id };
    } finally {
      await releaseRecoveryLock(input.projectId);
    }
  }

  // NEVER returns success:true after failed recovery
  private halt(reason: string): RecoveryResult {
    this.transition("FAILED");
    return {
      status: VerificationStatus.FAILED,
      reason,
      requiresHumanIntervention: true,
    };
  }
}
```

---

#### `server/recovery/rollback-manager.ts`  *(REFACTORED from rollback.service.ts)*
**Responsibility:** Execute filesystem restore only. No policy decisions.  
**LOC budget:** ~150

```typescript
// Pure rollback executor — no decisions, only execution
class RollbackManager {
  static async execute(checkpoint: ValidatedCheckpoint): Promise<RollbackResult> {
    // Strategy 1: git reset --hard <sha> (preferred)
    if (checkpoint.gitCommitSha) {
      const gitResult = await execGitReset(checkpoint.gitCommitSha);
      if (gitResult.exitCode === 0) return { success: true, strategy: "git" };
    }

    // Strategy 2: file snapshot restore (fallback)
    if (checkpoint.snapshotId) {
      const snapResult = await restoreSnapshot(checkpoint.snapshotId);
      if (snapResult.success) return { success: true, strategy: "snapshot" };
    }

    return { success: false, error: "Both rollback strategies failed" };
  }
}
```

---

#### `server/recovery/checkpoint-validator.ts`  *(NEW — replaces inline validateCheckpoint)*
**Responsibility:** Grade checkpoints (A/B/C/D). Only A and B usable for recovery.  
**LOC budget:** ~120

```typescript
// Checkpoint grades (replaces binary valid/invalid)
type CheckpointGrade = "A" | "B" | "C" | "D";

interface GradedCheckpoint {
  id: string;
  grade: CheckpointGrade;
  reasons: string[];  // why this grade was assigned
}

// Grade A: git SHA + tsc passed + HTTP 200 at time of creation
// Grade B: git SHA + tsc passed
// Grade C: git SHA only
// Grade D: metadata only (DB status + file count)

async function gradeCheckpoint(
  projectId: number,
  checkpointId: string,
): Promise<GradedCheckpoint> {
  const meta = await checkpointStore.get(projectId, checkpointId);

  // D: metadata only (current system — all checkpoints are currently D)
  if (!meta || meta.status === "failed" || meta.fileCount === 0) {
    return { id: checkpointId, grade: "D", reasons: ["metadata only"] };
  }

  // C: has git SHA
  if (!meta.gitCommitSha) {
    return { id: checkpointId, grade: "C", reasons: ["no git SHA"] };
  }

  // B/A: verify tsc at checkpoint time (from stored evidence, if available)
  const storedEvidence = await evidenceStore.get(checkpointId, "typescript_compile");
  if (!storedEvidence || storedEvidence.exitCode !== 0) {
    return { id: checkpointId, grade: "C", reasons: ["tsc not verified at checkpoint"] };
  }

  // A: all three verified
  const httpEvidence = await evidenceStore.get(checkpointId, "http_stable");
  if (httpEvidence?.status === "VERIFIED") {
    return { id: checkpointId, grade: "A", reasons: ["git + tsc + http verified"] };
  }

  return { id: checkpointId, grade: "B", reasons: ["git + tsc verified"] };
}

// Recovery may ONLY use Grade A or B
const RECOVERY_MINIMUM_GRADE: CheckpointGrade = "B";
```

---

### 4.4 `/governance/` — NEW MODULE

---

#### `server/governance/fail-closed-policy.ts`  *(NEW)*
**Responsibility:** Declarative policy enforcing fail-closed behavior everywhere.  
**LOC budget:** ~80

```typescript
// POLICY — not logic, but rules enforced by ExecutionGuard

const FAIL_CLOSED_POLICY = Object.freeze({
  // Verification exhaustion MUST trigger rollback, never success
  onVerificationExhausted: "ROLLBACK" as const,

  // LLM no_tool_calls exit MUST trigger verification (not bypass it)
  onNoToolCallsExit: "REQUIRE_VERIFICATION" as const,

  // Single ungrounded claim MUST inject warning (not continue silently)
  onSingleUngroundedClaim: "INJECT_WARNING" as const,   // ← fixes fake path #3

  // Rollback failure MUST halt and escalate (not degrade gracefully)
  onRollbackFailure: "HALT_AND_ESCALATE" as const,

  // Warning-based success states are forbidden
  allowWarnedSuccess: false,

  // Partial verification is not verification
  allowPartialVerification: false,

  // Minimum checkpoint grade for recovery
  minimumRecoveryGrade: "B" as CheckpointGrade,
}) as const;

// Policy is immutable — cannot be overridden at runtime
export type FailClosedPolicy = typeof FAIL_CLOSED_POLICY;
export { FAIL_CLOSED_POLICY };
```

---

#### `server/governance/execution-guard.ts`  *(NEW)*
**Responsibility:** Gate every run transition. Enforce policy before state changes.  
**LOC budget:** ~160

```typescript
// Guards wrap state transitions — not business logic

class ExecutionGuard {
  constructor(private policy: FailClosedPolicy) {}

  // Called INSTEAD of returning success when verification exhausted
  async onVerificationExhausted(
    projectId: number,
    runId: string,
    lastResult: VerificationResult,
  ): Promise<never> {
    // POLICY: onVerificationExhausted = "ROLLBACK"
    // Never return ok:true. Always trigger recovery.
    const recovery = await RecoveryOrchestrator.trigger({ projectId, runId, reason: "verification_exhausted" });
    throw new VerificationExhaustedError(recovery);
    // Caller receives an error — never a success response
  }

  // Called when LLM exits without calling task_complete (no_tool_calls)
  async onNoToolCallsExit(
    projectId: number,
    runId: string,
    content: string,
  ): Promise<VerificationResult> {
    // POLICY: onNoToolCallsExit = "REQUIRE_VERIFICATION"
    // Current system: returns success:true immediately — this path is eliminated
    return RuntimeTruthEngine.observe(projectId, []);
    // If VERIFIED → caller may return success
    // If FAILED → caller must trigger recovery
  }

  // Called when hallucination-detector finds single ungrounded claim
  onSingleUngroundedClaim(runId: string, claim: string): void {
    // POLICY: onSingleUngroundedClaim = "INJECT_WARNING"
    // Current system: returns "continue" silently — now always injects warning
    eventBus.emit("agent.warning", { runId, type: "ungrounded_claim", claim });
  }

  // Gate: may this run return success?
  assertCanReturnSuccess(result: VerificationResult): void {
    if (result.status !== VerificationStatus.VERIFIED) {
      throw new Error(
        `POLICY VIOLATION: attempted to return success with status=${result.status}. ` +
        `Only VERIFIED status may produce success. Triggering rollback.`
      );
    }
  }
}
```

---

## PART 5 — Execution Flow (With Fake Paths Eliminated)

```
LLM calls task_complete
         │
         ▼
┌────────────────────────┐
│  ExecutionGuard        │
│  .assertCanRun()       │───── BLOCKED? → VerificationStatus.BLOCKED
└────────────────────────┘               → Run ends FAILED
         │
         ▼ ALLOWED
┌────────────────────────────────────────────────────────────────────┐
│  RuntimeTruthEngine.observe(projectId, goalScope)                  │
│                                                                    │
│  TIER 1 — Static (import graph, file existence, circular deps)     │
│    FAILED? → short-circuit, return FAILED immediately              │
│             (no point running slower tiers)                        │
│                                                                    │
│  TIER 2 — Build (tsc --noEmit subprocess, npm ls --json)          │
│    FAILED? → return FAILED with exact subprocess output as evidence│
│                                                                    │
│  TIER 3 — Runtime (process alive, 3× HTTP 200, no fatal logs)     │
│    FAILED? → return FAILED                                         │
│                                                                    │
│  TIER 4 — Behavioral (Playwright DOM, route coverage)              │
│    FAILED? → return FAILED                                         │
│    ALL PASS? → return VERIFIED                                     │
└────────────────────────────────────────────────────────────────────┘
         │
         ├── VERIFIED ──────────────────────────────────────────┐
         │                                                       │
         ▼ FAILED                                                ▼
┌─────────────────────┐                             ┌──────────────────────┐
│  VerificationEngine │                             │  Run returns:        │
│  builds immutable   │                             │  success: true       │
│  VerificationResult │                             │  (ONLY valid path)   │
│  status: FAILED     │                             └──────────────────────┘
└─────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  RetryBudget.hasRemaining()?            │
└─────────────────────────────────────────┘
         │
    YES  │              NO (exhausted)
         │                   │
         ▼                   ▼
  LLM receives          ExecutionGuard
  VerificationResult    .onVerificationExhausted()
  (ok: false always)          │
  Tries fix strategy          ▼
  (with divergence      RecoveryOrchestrator
   enforcement)         .trigger()
                              │
                    ┌─────────┴───────────┐
                    │ ROLLING_BACK         │
                    │ RollbackManager      │
                    │ .execute(grade B+)   │
                    └─────────────────────┘
                              │
                    ┌─────────┴───────────┐
                    │ VERIFYING_RESTORE    │ ← NEW: missing in current system
                    │ RuntimeTruth.observe │
                    └─────────────────────┘
                              │
              VERIFIED ───────┤──────── FAILED
                    │                   │
                    ▼                   ▼
           Run: ROLLED_BACK     Try next Grade B+
           status: FAILED       checkpoint
           User notified        If all fail → HALT
           Evidence report      Human escalation
           generated
```

---

## PART 6 — State Machine (Deterministic)

```
RunState transitions — every transition is observable and logged

  ┌─────────┐
  │ PENDING │ ← initial state
  └────┬────┘
       │ run.started event
       ▼
  ┌─────────┐
  │ RUNNING │ ← agent executing tool calls
  └────┬────┘
       │ task_complete called
       ▼
  ┌───────────────────┐
  │ VERIFYING         │ ← RuntimeTruthEngine running tiers
  └────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
 VERIFIED      FAILED
    │             │
    ▼             ▼
  ┌───────┐  ┌────────────────┐
  │ DONE  │  │ RETRY_PENDING  │ (if budget remains)
  │ ✓     │  └────────────────┘
  └───────┘       │ retries exhausted
                  ▼
            ┌────────────────┐
            │ RECOVERING     │ ← RecoveryOrchestrator
            └────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    RECOVERED           RECOVERY_FAILED
         │                 │
         ▼                 ▼
  ┌────────────┐    ┌─────────────────┐
  │ FAILED     │    │ HALTED          │
  │ (rolled    │    │ (human required)│
  │  back)     │    └─────────────────┘
  └────────────┘

TERMINAL STATES: DONE | FAILED | HALTED
DONE is the ONLY terminal state where success=true.

FORBIDDEN TRANSITIONS (enforced by ExecutionGuard):
  VERIFYING → DONE (without VERIFIED status)
  RETRY_PENDING → DONE (without VERIFIED status)
  RECOVERING → DONE (rollback ≠ success)
```

---

## PART 7 — Verification Lifecycle

```
1. INITIATED
   Trigger: LLM calls task_complete tool
   Guard: ExecutionGuard.assertCanRun()
   Creates: VerificationSession { id, runId, attempt, startedAt }

2. TIER_1_RUNNING (Static)
   assertImportGraphValid() — AST walk
   assertFilesExist() — fs.stat per scope file
   assertNoCircularDeps() — graph cycle detection
   Duration: ~200ms
   Short-circuit: yes (fail → skip remaining tiers)

3. TIER_2_RUNNING (Build)
   assertTypeScriptCompiles() — tsc --noEmit subprocess
   assertPackagesInstalled() — npm ls --json subprocess
   Duration: 5–60s (project size dependent)
   Evidence captured: exact subprocess stdout/stderr

4. TIER_3_RUNNING (Runtime)
   assertProcessAlive() — kill -0 PID
   assertHttpStable() — 3× probe @ 5s intervals = 15s minimum
   assertNoFatalLogs() — log tail 20 lines
   Duration: 15–30s

5. TIER_4_RUNNING (Behavioral)
   assertDomRendered() — Playwright page.content()
   assertNoReactErrorBoundary() — DOM selector check
   assertRoutesRespond() — HTTP probes per scope routes
   Duration: 10–30s

6. RESULT_CREATED
   VerificationResult built (immutable, Object.freeze())
   status: VERIFIED | FAILED | UNKNOWN
   Evidence log attached (raw subprocess outputs)
   Stored in VerificationResultStore (append-only)

7a. ON VERIFIED:
    ExecutionGuard.assertCanReturnSuccess(result)
    Run marked DONE, success:true
    VerifiedFactsStore updated with new facts

7b. ON FAILED:
    VerificationResult injected into LLM context (ok:false always)
    RetryBudget decremented
    If budget > 0 → return to RUNNING state
    If budget = 0 → VerificationExhaustedError thrown
                    RecoveryOrchestrator.trigger()
                    Run marked FAILED

NEVER:
  Step 7b returns success:true
  Step 7b "completes with warnings"
  Step 7b sets ok:true with verification_exhausted flag
```

---

## PART 8 — Failure Lifecycle

```
Classification → Evidence → Rollback → Report

1. FAILURE DETECTED
   Source: VerificationResult.status === FAILED
   Classification: ErrorClassifier.classify(result)
     → compile_error | runtime_crash | import_error | http_failure | behavioral_failure

2. EVIDENCE COLLECTED (mandatory, blocking)
   EvidenceReport {
     classification: ErrorClass
     failedChecks: CheckResult[]      // exact tier that failed
     rawOutput: string[]              // subprocess stdout/stderr verbatim
     runtimeSnapshot: RuntimeSnapshot // process state at failure time
     filesModifiedThisRun: string[]   // from EvidenceLog
     lastVerifiedState: RuntimeSnapshot | null  // from VerifiedFactsStore
   }

3. RETRY DECISION
   If attempts < maxAttempts:
     RetryStrategySelector.selectDivergent(classification, previousStrategies)
     → must be different from all previous strategies
     → if no divergent strategy available → skip to step 4
   If attempts >= maxAttempts: → step 4

4. ROLLBACK TRIGGERED
   RecoveryOrchestrator.trigger(projectId, runId, EvidenceReport)
   State → RECOVERING
   RollbackManager.execute(Grade B+ checkpoint)
   Post-restore verification runs (TIER_1 + TIER_2 + TIER_3)

5. FAILURE REPORT GENERATED
   FailureReport {
     runId: string
     status: "FAILED"           // never "completed_with_warnings"
     classification: ErrorClass
     evidence: EvidenceReport
     rollbackStatus: "ROLLED_BACK" | "ROLLBACK_FAILED"
     checkpointRestored: string | null
     requiresHumanAction: boolean
     suggestedActions: string[]  // for user display, not for LLM
   }

6. USER NOTIFIED
   SSE event: run.failed { FailureReport }
   UI shows: exact failure classification + evidence
   NOT: "completed with warnings"
   NOT: success-looking failure
```

---

## PART 9 — Rollback Lifecycle

```
Trigger → Select → Prepare → Execute → Verify → Confirm | Escalate

1. TRIGGER
   Source: ExecutionGuard.onVerificationExhausted()
   Input: RecoveryInput { projectId, runId, reason, lastFailureReport }

2. SELECT CHECKPOINT
   CheckpointValidator.selectBestRecoverable(projectId)
   Grades all available checkpoints: A > B > C > D
   Selects highest grade (minimum: Grade B)
   If no Grade A/B exists → HALT, human escalation

3. PREPARE RUNTIME
   RuntimeManager.stop(projectId)
   Wait for process exit (max 10s)
   If process hangs → SIGKILL after 10s

4. EXECUTE ROLLBACK
   RollbackManager.execute(checkpoint)
   Strategy 1: git reset --hard <sha>
   Strategy 2: snapshot restore (fallback)
   Both fail: RecoveryFailed event → HALT

5. VERIFY RESTORE (NEW — currently missing)
   RuntimeTruthEngine.observe(projectId, [])
   Runs TIER_1 + TIER_2 + TIER_3 (not Tier 4 — behavioral skip on restore)
   If VERIFIED → proceed to step 6
   If FAILED → try PREVIOUS Grade B checkpoint (max 3 attempts)
   All attempts fail → HALT, human required

6. CONFIRM
   Checkpoint marked: status = "rolled_back"
   RecoveryResult { status: ROLLED_BACK, checkpointId, verifiedAt }
   Run marked: FAILED (not success — ROLLED_BACK ≠ SUCCESS)
   EvidenceReport finalized and stored

7. HALT (if all recovery fails)
   RecoveryResult { status: FAILED, requiresHumanIntervention: true }
   System state locked — no further agent runs for this project
   User must manually inspect and restart
```

---

## PART 10 — Type-Safe Interfaces (Complete)

```typescript
// ═══════════════════════════════════════════════════════════════
// CORE STATUS ENUM — replaces all boolean ok:true/false
// ═══════════════════════════════════════════════════════════════

enum VerificationStatus {
  VERIFIED    = "VERIFIED",
  FAILED      = "FAILED",
  ROLLED_BACK = "ROLLED_BACK",
  BLOCKED     = "BLOCKED",
  UNKNOWN     = "UNKNOWN",
}
// NO "WARNED", NO "EXHAUSTED_OK", NO "PARTIAL"

// ═══════════════════════════════════════════════════════════════
// VERIFICATION TYPES
// ═══════════════════════════════════════════════════════════════

type CheckName =
  | "import_graph_valid"    // TIER 1 — static
  | "file_exists"           // TIER 1 — static
  | "no_circular_deps"      // TIER 1 — static
  | "typescript_compile"    // TIER 2 — subprocess
  | "package_integrity"     // TIER 2 — subprocess
  | "process_alive"         // TIER 3 — runtime
  | "http_stable"           // TIER 3 — runtime
  | "no_fatal_logs"         // TIER 3 — runtime
  | "dom_rendered"          // TIER 4 — behavioral
  | "no_error_boundary"     // TIER 4 — behavioral
  | "routes_respond";       // TIER 4 — behavioral

type VerificationTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";

interface CheckResult {
  readonly name: CheckName;
  readonly tier: VerificationTier;
  readonly status: "PASSED" | "FAILED";  // only binary — no "warning"
  readonly message: string;
  readonly evidence: EvidenceEntry;      // raw subprocess output or observation
}

interface EvidenceEntry {
  readonly source: "subprocess" | "http_probe" | "ast_analysis" | "playwright";
  readonly command?: string;             // e.g., "tsc --noEmit"
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly responseCode?: number;
  readonly observedAt: number;
}

interface VerificationResult {
  readonly id: string;
  readonly runId: string;
  readonly status: VerificationStatus;  // VERIFIED or FAILED only from engine
  readonly attempt: number;
  readonly checks: readonly CheckResult[];
  readonly issues: readonly string[];
  readonly evidence: readonly EvidenceEntry[];
  readonly elapsedMs: number;
  readonly timestamp: number;
  // Object.freeze() applied — cannot be mutated after creation
}

// ═══════════════════════════════════════════════════════════════
// RUNTIME TRUTH TYPES
// ═══════════════════════════════════════════════════════════════

interface RuntimeSnapshot {
  readonly status: VerificationStatus;
  readonly observedAt: number;
  readonly processPid: number | null;
  readonly processAlive: boolean;
  readonly httpResponseCode: number | null;
  readonly consecutiveSuccessfulProbes: number;
  readonly tscExitCode: number | null;
  readonly tscErrors: readonly string[];
  readonly npmLsValid: boolean;
  readonly importGraphErrors: readonly string[];
  readonly tiers: readonly TierResult[];
}

interface TierResult {
  readonly tier: VerificationTier;
  readonly status: "PASSED" | "FAILED" | "SKIPPED";
  readonly checks: readonly CheckResult[];
  readonly durationMs: number;
}

// ═══════════════════════════════════════════════════════════════
// RECOVERY TYPES
// ═══════════════════════════════════════════════════════════════

type CheckpointGrade = "A" | "B" | "C" | "D";

interface GradedCheckpoint {
  readonly id: string;
  readonly grade: CheckpointGrade;
  readonly gitCommitSha: string | null;
  readonly tscVerified: boolean;
  readonly httpVerified: boolean;
  readonly createdAt: number;
}

interface RecoveryInput {
  readonly projectId: number;
  readonly runId: string;
  readonly reason: string;
  readonly lastFailureReport: EvidenceReport;
}

interface RecoveryResult {
  readonly status: VerificationStatus;   // ROLLED_BACK | FAILED (never VERIFIED)
  readonly checkpointId: string | null;
  readonly rollbackStrategy: "git" | "snapshot" | null;
  readonly postRestoreVerified: boolean;
  readonly requiresHumanIntervention: boolean;
  readonly reason?: string;
}

// ═══════════════════════════════════════════════════════════════
// AGENT RUN RESULT — replaces { success: boolean }
// ═══════════════════════════════════════════════════════════════

interface AgentRunResult {
  readonly status: VerificationStatus;
  readonly stopReason:
    | "verified_complete"    // success:true — ONLY valid success path
    | "verification_failed"  // LLM fix attempts left
    | "rolled_back"          // exhausted → recovery done
    | "halted"               // recovery failed → human needed
    | "governance_blocked";  // ExecutionGuard blocked run
  readonly verificationResult: VerificationResult | null;
  readonly evidenceReport: EvidenceReport | null;
  readonly summary: string;
  // NO: success:true when status !== VERIFIED
  // NO: ok:true with verification_exhausted
}
```

---

## PART 11 — Runtime Truth Flow

```
Continuous (every 5s):                    On-Demand (task_complete):
                                          
RuntimeObserver                           RuntimeTruthEngine.observe()
    │                                              │
    ├── kill -0 <PID>                              ├── TIER 1: AST import walk
    ├── HTTP GET :<port>/  (single)                │   (200ms, synchronous)
    └── log tail 5 lines                           │
                                                   ├── TIER 2: subprocess
Publishes:                                         │   tsc --noEmit (10-60s)
  RuntimeHeartbeatEvent {                          │   npm ls --json (2-5s)
    alive: boolean,                                │   (parallel, blocking)
    httpCode: number | null,                       │
    observedAt: number                             ├── TIER 3: runtime
  }                                                │   3× HTTP probe @ 5s
                                                   │   kill -0 PID
                                                   │   log tail 20 lines
                                                   │   (15-30s)
                                                   │
                                                   └── TIER 4: behavioral
                                                       Playwright launch
                                                       DOM inspection
                                                       Route probes
                                                       (10-30s)
                                                       
                                          Total time budget: 30-120s
                                          Short-circuit on first FAILED tier
                                          
Output: RuntimeSnapshot (immutable, Object.freeze())
  → VerificationEngine reads snapshot
  → derives VerificationResult
  → ExecutionGuard reads VerificationResult
  → ONLY path to success: status === VERIFIED
```

---

## PART 12 — Governance Enforcement Flow

```
GovernanceLayer wraps every state transition in the agent run:

agent.run.start
    │
    ▼
ExecutionGuard.assertCanStart(projectId, runId)
    ├── Check: Is recovery lock held? → BLOCKED
    ├── Check: Is previous run still RECOVERING? → BLOCKED
    ├── Check: Is entropy score below threshold? → WARNING injected
    └── PASS → run starts

─────────────────────────────────

LLM calls task_complete
    │
    ▼
ExecutionGuard.onTaskCompleteCall(runId)
    ├── Log event in ImmutableAuditLog
    ├── Freeze current EvidenceLog snapshot
    ├── Verify EvidenceLog.writes.length > 0 (fake path #1 guard)
    └── PASS → RuntimeTruthEngine.observe() starts

─────────────────────────────────

LLM returns no_tool_calls (text response only)
    │
    ▼
ExecutionGuard.onNoToolCallsExit(runId, content)  ← REPLACES fake path #2
    ├── POLICY: onNoToolCallsExit = "REQUIRE_VERIFICATION"
    ├── RuntimeTruthEngine.observe() runs
    ├── If VERIFIED → run may complete
    └── If FAILED → treated same as failed task_complete

─────────────────────────────────

HallucinationDetector detects 1 ungrounded claim
    │
    ▼
ExecutionGuard.onUngroundedClaim(runId, claim)    ← REPLACES fake path #3
    ├── POLICY: onSingleUngroundedClaim = "INJECT_WARNING"
    └── Warning injected into LLM context (not silently continued)

─────────────────────────────────

VerificationResult.status === FAILED + retries exhausted
    │
    ▼
ExecutionGuard.onVerificationExhausted(projectId, runId, result)
    ├── POLICY: onVerificationExhausted = "ROLLBACK"
    ├── Throws VerificationExhaustedError (never returns ok:true)
    ├── RecoveryOrchestrator.trigger()
    └── Run receives: status = FAILED | ROLLED_BACK (never DONE)

─────────────────────────────────

AgentRunResult.status checked before returning to caller:
    ExecutionGuard.assertCanReturnSuccess(result)
    ├── If status !== VERIFIED → throw PolicyViolationError
    └── Success may only be returned if status === VERIFIED
    
    This is a hard runtime assertion — cannot be bypassed.
```

---

## PART 13 — Refactored Module Dependency Graph

```
server/
├── governance/                         (NEW — no dependencies on agents)
│   ├── fail-closed-policy.ts           depends on: nothing
│   └── execution-guard.ts              depends on: fail-closed-policy, verification/types
│
├── runtime-truth/                      (NEW — no LLM dependency)
│   ├── runtime-truth-engine.ts         depends on: runtime-assertions, verification/types
│   ├── runtime-observer.ts             depends on: runtime-assertions (lightweight subset)
│   └── runtime-assertions.ts          depends on: node:child_process, node:net only
│
├── verification/
│   └── engine/
│       ├── verification-engine.ts      depends on: runtime-truth-engine, verification-result,
│       │                                            verification-policy, verification-errors
│       ├── verification-result.ts      depends on: nothing (pure data factory)
│       ├── verification-policy.ts      depends on: nothing (pure data)
│       └── verification-errors.ts      depends on: nothing (error classes)
│
├── recovery/
│   ├── recovery-orchestrator.ts        depends on: rollback-manager, checkpoint-validator,
│   │                                               runtime-truth-engine, governance
│   ├── rollback-manager.ts             depends on: infrastructure/checkpoints only
│   └── checkpoint-validator.ts         depends on: infrastructure/checkpoints only
│
└── agents/core/tool-loop/
    └── tool-loop.agent.ts              depends on: governance/execution-guard,
                                                    verification/engine,
                                                    recovery/recovery-orchestrator

DEPENDENCY RULES:
  agents → governance ✓
  agents → verification/engine ✓
  agents → runtime-truth (indirect via engine) ✓
  governance → verification/types only ✓
  runtime-truth → no agents ✓  (no LLM calls in truth layer)
  verification/engine → no agents ✓
  recovery → no agents ✓

FORBIDDEN DEPENDENCIES:
  runtime-truth → agents         ✗ (truth layer must be LLM-free)
  verification/engine → tool-loop ✗ (verification must not call LLM)
  governance → memory            ✗ (governance must not read stale memory)
  recovery → planner             ✗ (recovery is not replanning)
```

---

## PART 14 — Migration Checklist (Implementation Order)

### Step 1 — Immediate Bug Fixes (4–8 hours, zero new files)
```
□ tool-loop.agent.ts line 174–175:
  Remove:   saw_complete = true; lastSummary = `... (verification warnings)`;
  Replace:  throw new VerificationExhaustedError(report, retryCtrl.maxRetries);
  Result:   Exhausted path can no longer reach return { success: true }

□ tool-loop.agent.ts lines 129–133:
  Remove:   return { success: true, ..., stopReason: "no_tool_calls" };
  Replace:  const snapshot = await RuntimeTruthEngine.observe(...)
            if snapshot.status !== VERIFIED → trigger RecoveryOrchestrator
  Result:   LLM silent exit no longer bypasses verification

□ verification-engine.ts:
  Remove:   buildExhaustedFeedback() function entirely
  Remove:   ok:true from any code path
  Replace:  All serialization via verification-result.ts (ok = status===VERIFIED only)

□ hallucination-detector.ts lines 138–139:
  Change:   ungrounded.length >= 2 → inject-warning
  To:       ungrounded.length >= 1 → inject-warning  (any ungrounded claim = warning)
```

### Step 2 — New Type Definitions (2–4 hours)
```
□ Create: server/verification/engine/verification-result.ts
□ Create: server/verification/engine/verification-policy.ts
□ Create: server/verification/engine/verification-errors.ts
□ Update: server/verification/types.ts — add VerificationStatus enum (remove "warned")
```

### Step 3 — Runtime Truth Engine (1–2 days)
```
□ Create: server/runtime-truth/runtime-assertions.ts
  Focus: tsc --noEmit subprocess (replaces log scan)
  Focus: npm ls --json subprocess (replaces log scan)
  Focus: 3× HTTP probe (replaces single probe)
□ Create: server/runtime-truth/runtime-truth-engine.ts
□ Create: server/runtime-truth/runtime-observer.ts
□ Update: server/verification/runtime/typescript-validator.ts
  Remove: log scanning
  Replace: delegate to runtime-assertions.assertTypeScriptCompiles()
□ Update: server/verification/runtime/package-validator.ts
  Remove: log scanning
  Replace: delegate to runtime-assertions.assertPackagesInstalled()
```

### Step 4 — Governance Layer (4–6 hours)
```
□ Create: server/governance/fail-closed-policy.ts
□ Create: server/governance/execution-guard.ts
□ Wire:   tool-loop.agent.ts imports ExecutionGuard
□ Add:    ExecutionGuard.assertCanReturnSuccess() called before every success return
```

### Step 5 — Recovery Hardening (1 day)
```
□ Create: server/recovery/checkpoint-validator.ts (grade A/B/C/D)
□ Create: server/recovery/recovery-orchestrator.ts (replaces recovery-manager.ts)
□ Create: server/recovery/rollback-manager.ts (extracted from rollback.service.ts)
□ Add:    Post-restore verification (TIER_1 + TIER_2 + TIER_3) after every rollback
```

### Step 6 — Checkpoint Grading (4 hours)
```
□ Store TypeScript compile evidence at checkpoint creation time
□ Store HTTP probe evidence at checkpoint creation time
□ Grade existing checkpoints retroactively (all currently Grade C or D)
□ Enforce minimum Grade B for recovery selection
```

---

## PART 15 — What This Architecture Guarantees

```
GUARANTEE 1:
  ok:true is structurally impossible when VerificationStatus !== VERIFIED.
  ExecutionGuard.assertCanReturnSuccess() is a runtime assertion.
  It throws before any success response is returned.
  No code path bypasses it.

GUARANTEE 2:
  Verification exhaustion always triggers RecoveryOrchestrator.
  No configuration can change this — it is enforced by VerificationExhaustedError.
  The error propagates up and cannot be caught to return success.

GUARANTEE 3:
  LLM text response without task_complete now requires verification.
  Silent exits are closed.

GUARANTEE 4:
  TypeScript and package validation use real subprocesses.
  Log scanning removed.
  Evidence = exact subprocess output (stdout/stderr/exitCode).

GUARANTEE 5:
  Recovery restores only Grade B+ checkpoints.
  Post-restore verification runs before recovery is declared successful.
  Recovery success ≠ run success. ROLLED_BACK is a failure state.

GUARANTEE 6:
  Every VerificationResult is immutable (Object.freeze).
  No downstream code can retroactively change a FAILED result to VERIFIED.

GUARANTEE 7:
  governance/fail-closed-policy.ts is a pure data object.
  It cannot be overridden at runtime.
  Its values are const, readonly, and sealed.
```

---

*The system must fail visibly or not fail at all. There is no polite degradation.*
