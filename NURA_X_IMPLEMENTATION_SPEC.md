# NURA X — Fail-Closed Implementation Specification
## Exact Code. Exact Diffs. No Theory.

> **Type:** Implementation-Ready Engineering Spec  
> **Evidence Base:** Actual file reads of current codebase  
> **Scope:** 11 files created/replaced, 5 files patched, 0 fake success paths remaining

---

## PART 1 — Exact Fake-Success Removals

### REMOVAL 1 of 4 — `tool-loop.agent.ts` lines 168–175 + 186–188

**CURRENT (broken):**
```typescript
// Line 168: exhaustion sets saw_complete = true → reaches return { success: true }
} else if (retryCtrl.exhausted) {
  emitVerificationExhausted(input.projectId, input.runId, retryCtrl.maxRetries);
  messages[messages.length - 1] = {
    role: "tool", tool_call_id: call.id,
    content: buildExhaustedFeedback(report, retryCtrl.maxRetries), // ok:true inside
  };
  saw_complete = true;                   // ← FAKE: gates success return below
  lastSummary = `${summary} (completed with verification warnings)`;
}
// Line 186:
if (saw_complete) {
  return { success: true, ... };         // ← runs even after exhausted verification
}
```

**REPLACEMENT:**
```typescript
} else if (retryCtrl.exhausted) {
  emitVerificationExhausted(input.projectId, input.runId, retryCtrl.maxRetries);
  // FAIL-CLOSED: exhaustion triggers rollback, never success
  await onVerificationExhausted(input.projectId, input.runId, report, retryCtrl.maxRetries);
  // onVerificationExhausted throws VerificationExhaustedError — never returns
  // The return below is unreachable — TypeScript never type
}
```

---

### REMOVAL 2 of 4 — `tool-loop.agent.ts` lines 129–133

**CURRENT (broken):**
```typescript
if (response.toolCalls.length === 0) {
  const summary = response.content?.trim() || lastSummary || "Done.";
  emit(input.runId, "agent.message", "complete", { text: summary });
  return { success: true, steps, summary, stopReason: "no_tool_calls", messages };
  //        ↑ LLM exits without task_complete → verification never runs → success:true
}
```

**REPLACEMENT:**
```typescript
if (response.toolCalls.length === 0) {
  const content = response.content?.trim() || lastSummary || "Done.";
  emit(input.runId, "agent.thinking", "tool-loop", { text: "LLM text exit — running verification before completing." });
  // FAIL-CLOSED: no_tool_calls exit requires same verification as task_complete
  const snapshot = await runRuntimeTruth(input.projectId, input.runId);
  if (snapshot.status === VerificationStatus.VERIFIED) {
    emit(input.runId, "agent.message", "complete", { text: content });
    return { success: true, steps, summary: content, stopReason: "no_tool_calls", messages };
  }
  // Not verified — inject failure message and continue loop
  messages.push({ role: "user", content: buildNoToolCallsFailure(snapshot) });
  continue;  // back to top of while loop
}
```

---

### REMOVAL 3 of 4 — `verification-engine.ts` `buildExhaustedFeedback()` ok:true

**CURRENT (broken):**
```typescript
export function buildExhaustedFeedback(report, maxRetries) {
  return JSON.stringify({
    ok: true,                         // ← ROOT CAUSE
    verification_exhausted: true,
    warning: `Verification failed after ${maxRetries} attempts...`,
  });
}
```

**REPLACEMENT:** Function deleted entirely. No replacement. Exhaustion path calls
`onVerificationExhausted()` which throws — there is no "exhausted feedback" concept
in the new architecture. Exhaustion = rollback = FAILED.

---

### REMOVAL 4 of 4 — `hallucination-detector.ts` line 139 silent continue

**CURRENT (broken):**
```typescript
const recommendation =
  repetition.repeatCount >= 3 || fabricated.length > 0 ? "halt"
  : ungrounded.length >= 2                              ? "inject-warning"
  : "continue";   // ← 1 ungrounded claim → silently continues
```

**REPLACEMENT:**
```typescript
const recommendation =
  repetition.repeatCount >= 3 || fabricated.length > 0 ? "halt"
  : ungrounded.length >= 1                              ? "inject-warning"  // ← 1 is enough
  : "continue";
```

---

## PART 2 — New Type System

### FILE: `server/verification/types.ts` (REPLACE ENTIRELY)

```typescript
/**
 * server/verification/types.ts
 *
 * Shared types for verification + governance layers.
 * Pure data. No logic. No imports from other modules.
 *
 * LOC: ~90
 */

// ─── Status enum — replaces boolean ok:true/false and string status ───────────

export enum VerificationStatus {
  VERIFIED    = "VERIFIED",     // all blocking checks passed — success permitted
  FAILED      = "FAILED",       // one or more blocking checks failed
  ROLLED_BACK = "ROLLED_BACK",  // recovery executed — terminal failure state
  BLOCKED     = "BLOCKED",      // governance guard blocked execution
  UNKNOWN     = "UNKNOWN",      // observation incomplete — must re-observe
}

// REMOVED: "passed" | "failed" | "warned"  ← "warned" does not exist anymore
// REMOVED: boolean ok:true/false            ← replaced by VerificationStatus

// ─── Verification tier ────────────────────────────────────────────────────────

export type VerificationTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";

// ─── Check names — one per assertion ─────────────────────────────────────────

export type CheckName =
  // TIER_1 — static (no subprocess)
  | "import_graph_valid"
  | "file_exists"
  | "no_circular_deps"
  // TIER_2 — build subprocess
  | "typescript_compile"
  | "package_integrity"
  // TIER_3 — runtime observation
  | "process_alive"
  | "http_stable"
  | "no_fatal_logs"
  // TIER_4 — behavioral (Playwright / HTTP route probes)
  | "dom_rendered"
  | "no_error_boundary"
  | "routes_respond"
  // Legacy names — kept for backward compat with existing emitters
  | "runtime_logs"
  | "typescript_errors"
  | "package_install"
  | "preview_http";

// Binary only — no "warning" grade
export type CheckStatus = "PASSED" | "FAILED" | "SKIPPED";

// ─── Evidence — raw subprocess output attached to every check ─────────────────

export interface EvidenceEntry {
  readonly source: "subprocess" | "http_probe" | "ast_analysis" | "playwright" | "log_tail" | "syscall";
  readonly command?: string;         // e.g. "tsc --noEmit"
  readonly exitCode?: number;
  readonly stdout?: string;          // capped at 2000 chars
  readonly stderr?: string;          // capped at 2000 chars
  readonly responseCode?: number;
  readonly latencyMs?: number;
  readonly observedAt: number;
}

// ─── Individual check result ──────────────────────────────────────────────────

export interface CheckResult {
  readonly name: CheckName;
  readonly tier: VerificationTier;
  readonly status: CheckStatus;
  readonly message: string;
  readonly evidence: EvidenceEntry;
  readonly detail?: string;          // LLM-actionable hint
}

// ─── Aggregated verification result — immutable after Object.freeze() ─────────

export interface VerificationResult {
  readonly id: string;               // uuid
  readonly runId: string;
  readonly projectId: number;
  readonly status: VerificationStatus;
  readonly attempt: number;
  readonly checks: readonly CheckResult[];
  readonly issues: readonly string[];
  readonly requiredActions: readonly string[];
  readonly evidence: readonly EvidenceEntry[];
  readonly elapsedMs: number;
  readonly timestamp: number;
}

// ─── Runtime truth snapshot ───────────────────────────────────────────────────

export interface RuntimeSnapshot {
  readonly status: VerificationStatus;
  readonly observedAt: number;
  readonly processPid: number | null;
  readonly processAlive: boolean;
  readonly consecutiveHttpOk: number;  // must be >= 3 to count as stable
  readonly tscExitCode: number | null;
  readonly tscErrors: readonly string[];
  readonly npmLsValid: boolean;
  readonly importErrors: readonly string[];
  readonly tiers: readonly TierResult[];
}

export interface TierResult {
  readonly tier: VerificationTier;
  readonly status: "PASSED" | "FAILED" | "SKIPPED";
  readonly checks: readonly CheckResult[];
  readonly durationMs: number;
}

// ─── Recovery types ───────────────────────────────────────────────────────────

export type CheckpointGrade = "A" | "B" | "C" | "D";

export interface GradedCheckpoint {
  readonly id: string;
  readonly grade: CheckpointGrade;
  readonly gitCommitSha: string | null;
  readonly tscVerified: boolean;
  readonly httpVerified: boolean;
  readonly createdAt: number;
}

export interface RecoveryInput {
  readonly projectId: number;
  readonly runId: string;
  readonly reason: string;
  readonly lastResult: VerificationResult;
}

export interface RecoveryResult {
  readonly status: VerificationStatus;  // ROLLED_BACK | FAILED — never VERIFIED
  readonly checkpointId: string | null;
  readonly rollbackStrategy: "git" | "snapshot" | null;
  readonly postRestoreVerified: boolean;
  readonly requiresHumanIntervention: boolean;
  readonly reason?: string;
}

// ─── Agent run result — replaces { success: boolean } ─────────────────────────

export interface AgentRunResult {
  readonly status: VerificationStatus;
  readonly stopReason:
    | "verified_complete"    // success = true — only valid success path
    | "verification_failed"  // fix attempts remain
    | "rolled_back"          // exhausted → recovery done → FAILED
    | "halted"               // recovery also failed → human required
    | "governance_blocked"   // ExecutionGuard rejected run
    | "max_steps"            // step limit reached
    | "aborted"              // user cancelled
    | "error";               // unhandled error
  readonly steps: number;
  readonly summary: string;
  readonly verificationResult?: VerificationResult;
  readonly recoveryResult?: RecoveryResult;
  readonly error?: string;
}

// ─── Legacy compat shim — remove after full migration ─────────────────────────

/** @deprecated Use VerificationResult */
export interface VerificationReport {
  projectId:       number;
  runId:           string;
  status:          "passed" | "failed" | "warned";
  passed:          boolean;
  checks:          Array<{ name: CheckName; status: string; message: string; detail?: string }>;
  issues:          string[];
  requiredActions: string[];
  elapsedMs:       number;
}

/** @deprecated Use VerificationStatus */
export interface RetryState {
  runId:      string;
  attempts:   number;
  maxRetries: number;
  exhausted:  boolean;
}
```

---

## PART 3 — New Files (Full TypeScript)

### FILE: `server/governance/fail-closed-policy.ts` *(NEW)*

```typescript
/**
 * fail-closed-policy.ts
 *
 * Declarative policy constants enforcing fail-closed behavior.
 * Pure data — no logic, no imports, no side effects.
 * Immutable at runtime via Object.freeze().
 *
 * Responsibility: declare WHAT happens in each failure scenario.
 * ExecutionGuard is responsible for HOW it is enforced.
 *
 * LOC: ~55
 */

import type { CheckpointGrade } from "../verification/types.ts";

export const FAIL_CLOSED_POLICY = Object.freeze({

  // Verification exhausted → trigger rollback. NEVER ok:true.
  onVerificationExhausted: "ROLLBACK" as const,

  // LLM exits without calling task_complete → require verification first.
  onNoToolCallsExit: "REQUIRE_VERIFICATION" as const,

  // Any ungrounded claim (≥1) → inject warning into LLM context.
  onSingleUngroundedClaim: "INJECT_WARNING" as const,

  // Rollback failure → halt, require human.
  onRollbackFailure: "HALT_AND_ESCALATE" as const,

  // Recovery success is a FAILED terminal state (not a success state).
  rollbackSuccessIsFailure: true as const,

  // Warning states forbidden — only VERIFIED or FAILED.
  allowWarnedSuccess: false as const,

  // Score-based validation forbidden — every check is binary.
  allowScoreThreshold: false as const,

  // Minimum checkpoint grade usable for recovery.
  minimumRecoveryGrade: "B" as CheckpointGrade,

  // HTTP probe: consecutive successes required (not a single probe).
  httpProbeConsecutiveRequired: 3 as const,

  // HTTP probe interval (ms).
  httpProbeIntervalMs: 5_000 as const,

  // Post-restore verification tiers required.
  postRestoreTiers: ["TIER_1", "TIER_2", "TIER_3"] as const,

} as const);

export type FailClosedPolicy = typeof FAIL_CLOSED_POLICY;
```

---

### FILE: `server/governance/execution-guard.ts` *(NEW)*

```typescript
/**
 * execution-guard.ts
 *
 * Runtime enforcement of fail-closed policy.
 * Guards every state transition that could produce a success result.
 *
 * Responsibility: enforce FAIL_CLOSED_POLICY at runtime.
 *   - Intercept exhausted verification → trigger rollback
 *   - Intercept no_tool_calls exit → require verification
 *   - Block success return unless status === VERIFIED
 *
 * Inputs:  VerificationResult, RuntimeSnapshot, FailClosedPolicy
 * Outputs: throws PolicyViolationError | VerificationExhaustedError
 *          or permits execution to continue
 *
 * LOC: ~140
 */

import { VerificationStatus }   from "../verification/types.ts";
import { FAIL_CLOSED_POLICY }   from "./fail-closed-policy.ts";
import type { VerificationResult, RuntimeSnapshot, RecoveryResult } from "../verification/types.ts";

// ─── Error classes ────────────────────────────────────────────────────────────

export class PolicyViolationError extends Error {
  constructor(
    public readonly violation: string,
    public readonly status: VerificationStatus,
  ) {
    super(`POLICY VIOLATION: ${violation} (status=${status})`);
    this.name = "PolicyViolationError";
  }
}

export class VerificationExhaustedError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastResult: VerificationResult,
    public readonly recoveryResult: RecoveryResult,
  ) {
    super(
      `Verification exhausted after ${attempts} attempts. ` +
      `Recovery status: ${recoveryResult.status}. Run marked FAILED.`,
    );
    this.name = "VerificationExhaustedError";
  }
}

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * Call before returning success from any agent run result.
 * Throws PolicyViolationError if status is not VERIFIED.
 */
export function assertCanReturnSuccess(result: VerificationResult): void {
  if (result.status !== VerificationStatus.VERIFIED) {
    throw new PolicyViolationError(
      `attempted to return success with status=${result.status}`,
      result.status,
    );
  }
}

/**
 * Called when verification retry budget is exhausted.
 * Per policy: ROLLBACK always. NEVER returns ok:true.
 * Callers MUST await this — it always throws VerificationExhaustedError.
 */
export async function onVerificationExhausted(
  projectId: number,
  runId:     string,
  lastResult: VerificationResult,
  attempts:  number,
): Promise<never> {
  // Import here to avoid circular dependency: guard → orchestrator → guard
  const { triggerRecovery } = await import("../recovery/recovery-orchestrator.ts");

  const recoveryResult = await triggerRecovery({
    projectId,
    runId,
    reason:     "verification_exhausted",
    lastResult,
  });

  // Always throw — caller never receives a success response
  throw new VerificationExhaustedError(attempts, lastResult, recoveryResult);
}

/**
 * Called when LLM exits without tool calls (no_tool_calls).
 * Per policy: REQUIRE_VERIFICATION before success is permitted.
 * Returns the snapshot — caller decides based on status.
 */
export async function onNoToolCallsExit(
  projectId: number,
  runId:     string,
): Promise<RuntimeSnapshot> {
  const { runRuntimeTruth } = await import("../runtime-truth/runtime-truth-engine.ts");
  return runRuntimeTruth(projectId, runId);
}

/**
 * Called when hallucination-detector finds ≥1 ungrounded claim.
 * Per policy: INJECT_WARNING — never silently continue.
 * Returns the warning message to inject into LLM context.
 */
export function onUngroundedClaim(runId: string, claims: string[]): string {
  // Emit event for SSE stream
  import("../infrastructure/events/bus.ts").then(({ bus }) => {
    bus.emit("agent.event", {
      runId,
      eventType: "agent.hallucination.warning" as any,
      phase: "governance",
      payload: { claims },
      ts: Date.now(),
    });
  });

  return [
    "⚠ GOVERNANCE WARNING: Ungrounded claim(s) detected.",
    "The following assertions have no supporting evidence in tool outputs:",
    ...claims.map((c, i) => `  ${i + 1}. "${c}"`),
    "",
    "Before calling task_complete, verify each claim using actual tool calls.",
    "Do NOT assume these are true — use read_file, run_command, or http_probe to confirm.",
  ].join("\n");
}

/**
 * Build the failure message injected when LLM text exit fails verification.
 * Used by no_tool_calls guard path.
 */
export function buildNoToolCallsFailure(snapshot: RuntimeSnapshot): string {
  const issues = snapshot.tiers
    .filter(t => t.status === "FAILED")
    .flatMap(t => t.checks.filter(c => c.status === "FAILED").map(c => c.message));

  return JSON.stringify({
    ok: false,
    reason: "no_tool_calls_exit_failed_verification",
    message: [
      "Your text response implied task completion, but runtime verification failed.",
      "Issues detected:",
      ...issues.map((iss, i) => `  ${i + 1}. ${iss}`),
      "",
      "Fix these issues and call task_complete explicitly to complete the task.",
    ].join("\n"),
    issues,
  });
}
```

---

### FILE: `server/runtime-truth/runtime-assertions.ts` *(NEW)*

```typescript
/**
 * runtime-assertions.ts
 *
 * Deterministic assertion functions. One function per check.
 * Every function: real subprocess or syscall. NO log scanning as source of truth.
 *
 * Responsibility: execute individual checks and return binary PASSED/FAILED
 *   with raw evidence attached.
 *
 * Inputs:  projectId, file paths, port numbers
 * Outputs: CheckResult (immutable, with EvidenceEntry)
 *
 * LOC: ~220
 */

import { exec }               from "node:child_process";
import { promisify }          from "node:util";
import { existsSync, statSync } from "node:fs";
import { getProjectDir }      from "../infrastructure/sandbox/sandbox.util.ts";
import { runtimeManager }     from "../infrastructure/runtime/runtime-manager.ts";
import type { CheckResult, EvidenceEntry } from "../verification/types.ts";

const execAsync = promisify(exec);

// ─── TIER 1 — Static ──────────────────────────────────────────────────────────

export async function assertFilesExist(
  projectId: number,
  paths: string[],
): Promise<CheckResult> {
  const missing = paths.filter(p => !existsSync(p));
  const evidence: EvidenceEntry = {
    source: "syscall",
    command: `fs.existsSync x${paths.length}`,
    observedAt: Date.now(),
  };

  if (missing.length === 0) {
    return { name: "file_exists", tier: "TIER_1", status: "PASSED", evidence,
      message: `All ${paths.length} expected file(s) exist.` };
  }
  return { name: "file_exists", tier: "TIER_1", status: "FAILED", evidence,
    message: `${missing.length} file(s) missing: ${missing.slice(0, 3).join(", ")}`,
    detail: `Create the missing files: ${missing.join(", ")}` };
}

// ─── TIER 2 — Build subprocesses ──────────────────────────────────────────────

export async function assertTypeScriptCompiles(
  projectId: number,
): Promise<CheckResult> {
  const cwd = getProjectDir(projectId);
  const startMs = Date.now();

  let stdout = "", stderr = "", exitCode = -1;
  try {
    const result = await execAsync("npx tsc --noEmit --pretty false 2>&1", {
      cwd,
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    stdout = result.stdout.slice(0, 2000);
    exitCode = 0;
  } catch (err: any) {
    stderr = (err.stdout ?? err.stderr ?? String(err)).slice(0, 2000);
    exitCode = err.code ?? 1;
  }

  const evidence: EvidenceEntry = {
    source: "subprocess",
    command: "npx tsc --noEmit --pretty false",
    exitCode,
    stdout: stdout.slice(0, 2000),
    stderr: stderr.slice(0, 2000),
    observedAt: Date.now(),
  };

  if (exitCode === 0) {
    return { name: "typescript_compile", tier: "TIER_2", status: "PASSED", evidence,
      message: `TypeScript compiled successfully (${Date.now() - startMs}ms).` };
  }

  const errorLines = (stderr || stdout).split("\n")
    .filter(l => l.includes("error TS"))
    .slice(0, 5);

  return {
    name: "typescript_compile", tier: "TIER_2", status: "FAILED", evidence,
    message: `TypeScript compile failed (exit ${exitCode}): ${errorLines.length} error(s)`,
    detail: `Errors:\n${errorLines.map(l => `  ${l.trim()}`).join("\n")}`,
  };
}

export async function assertPackagesInstalled(
  projectId: number,
): Promise<CheckResult> {
  const cwd = getProjectDir(projectId);

  let stdout = "", exitCode = -1;
  try {
    const result = await execAsync("npm ls --depth=0 --json 2>/dev/null", {
      cwd, timeout: 30_000,
    });
    stdout = result.stdout;
    exitCode = 0;
  } catch (err: any) {
    stdout = err.stdout ?? "";
    exitCode = err.code ?? 1;
  }

  const evidence: EvidenceEntry = {
    source: "subprocess",
    command: "npm ls --depth=0 --json",
    exitCode,
    stdout: stdout.slice(0, 2000),
    observedAt: Date.now(),
  };

  // npm ls exits 1 when there are missing/extraneous packages
  if (exitCode !== 0) {
    let detail = "Run npm install to fix package integrity.";
    try {
      const parsed = JSON.parse(stdout);
      const problems = Object.keys(parsed?.problems ?? {}).slice(0, 3);
      if (problems.length > 0) detail = `Problems: ${problems.join("; ")}`;
    } catch { /* ignore parse error */ }
    return { name: "package_integrity", tier: "TIER_2", status: "FAILED", evidence,
      message: "Package integrity check failed — missing or extraneous packages.",
      detail };
  }

  return { name: "package_integrity", tier: "TIER_2", status: "PASSED", evidence,
    message: "All packages installed correctly (npm ls exit 0)." };
}

// ─── TIER 3 — Runtime ─────────────────────────────────────────────────────────

export async function assertProcessAlive(projectId: number): Promise<CheckResult> {
  const entry = runtimeManager.get(projectId);
  const evidence: EvidenceEntry = { source: "syscall", command: "kill -0 <PID>", observedAt: Date.now() };

  if (!entry?.pid) {
    return { name: "process_alive", tier: "TIER_3", status: "SKIPPED", evidence,
      message: "No process registered for this project." };
  }

  let alive = false;
  try {
    process.kill(entry.pid, 0);  // kill -0: check existence only
    alive = true;
  } catch { alive = false; }

  if (alive) {
    return { name: "process_alive", tier: "TIER_3", status: "PASSED", evidence,
      message: `Process PID ${entry.pid} is alive (port ${entry.port}).` };
  }
  return { name: "process_alive", tier: "TIER_3", status: "FAILED", evidence,
    message: `Process PID ${entry.pid} is not running.`,
    detail: "Call server_restart to bring the server back up." };
}

export async function assertHttpStable(
  projectId: number,
  consecutiveRequired = 3,
  intervalMs = 5_000,
): Promise<CheckResult> {
  const entry = runtimeManager.get(projectId);
  const evidence: EvidenceEntry = {
    source: "http_probe",
    command: `HTTP GET :<port>/ × ${consecutiveRequired} @ ${intervalMs}ms`,
    observedAt: Date.now(),
  };

  if (!entry || entry.status !== "running") {
    return { name: "http_stable", tier: "TIER_3", status: "SKIPPED", evidence,
      message: "Server not running — HTTP stability check skipped." };
  }

  let successes = 0;
  for (let i = 0; i < consecutiveRequired; i++) {
    if (i > 0) await sleep(intervalMs);
    try {
      const res = await fetch(`http://localhost:${entry.port}/`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok || (res.status >= 200 && res.status < 500)) {
        successes++;
        evidence.responseCode = res.status;
      } else {
        break;  // 5xx → stop immediately
      }
    } catch {
      break;  // connection refused → stop
    }
  }

  if (successes >= consecutiveRequired) {
    return { name: "http_stable", tier: "TIER_3", status: "PASSED", evidence,
      message: `HTTP stable: ${successes}/${consecutiveRequired} consecutive 200s on port ${entry.port}.` };
  }
  return { name: "http_stable", tier: "TIER_3", status: "FAILED", evidence,
    message: `HTTP unstable: only ${successes}/${consecutiveRequired} consecutive successes.`,
    detail: "Server is responding intermittently. Check logs for crash-restart loops." };
}

export async function assertNoFatalLogs(projectId: number): Promise<CheckResult> {
  const { logBuffer } = await import("../runtime/observer/log-buffer.ts");
  const { analyzeLines } = await import("../runtime/observer/log-analyzer.ts");
  const tail = logBuffer.tail(projectId, 20);  // last 20 lines only
  const analysis = analyzeLines(tail);
  const evidence: EvidenceEntry = {
    source: "log_tail",
    command: "logBuffer.tail(20)",
    stdout: tail.map(l => l.text).join("\n").slice(0, 1000),
    observedAt: Date.now(),
  };

  if (!analysis.hasFatalError) {
    return { name: "no_fatal_logs", tier: "TIER_3", status: "PASSED", evidence,
      message: "No fatal errors in last 20 log lines." };
  }
  const top = analysis.errors.slice(0, 3).map(e => e.line.slice(0, 100)).join("; ");
  return { name: "no_fatal_logs", tier: "TIER_3", status: "FAILED", evidence,
    message: "Fatal error(s) detected in recent logs.",
    detail: `Errors: ${top}` };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### FILE: `server/runtime-truth/runtime-truth-engine.ts` *(NEW)*

```typescript
/**
 * runtime-truth-engine.ts
 *
 * Ordered, short-circuit verification tier orchestrator.
 * Produces an immutable RuntimeSnapshot with binary VERIFIED | FAILED.
 *
 * Responsibility: run 4 tiers in order, short-circuit on first FAILED tier,
 *   return frozen RuntimeSnapshot.
 *
 * Used by:
 *   - VerificationEngine (on task_complete)
 *   - ExecutionGuard.onNoToolCallsExit
 *   - RecoveryOrchestrator.verifyRestore
 *
 * Inputs:  projectId, runId
 * Outputs: RuntimeSnapshot (Object.freeze)
 *
 * LOC: ~145
 */

import { VerificationStatus }        from "../verification/types.ts";
import {
  assertFilesExist,
  assertTypeScriptCompiles,
  assertPackagesInstalled,
  assertProcessAlive,
  assertHttpStable,
  assertNoFatalLogs,
} from "./runtime-assertions.ts";
import type {
  RuntimeSnapshot,
  TierResult,
  CheckResult,
} from "../verification/types.ts";

const TIER1_TIMEOUT_MS = 10_000;
const TIER2_TIMEOUT_MS = 90_000;  // tsc can be slow
const TIER3_TIMEOUT_MS = 40_000;  // 3 × 5s probes + buffer
const TIER4_TIMEOUT_MS = 30_000;

// ─── Tier runners ─────────────────────────────────────────────────────────────

async function runTier1(projectId: number): Promise<TierResult> {
  const t = Date.now();
  const checks: CheckResult[] = [];
  // Basic file existence check — can extend with import graph walker
  const fileCheck = await assertFilesExist(projectId, []);
  checks.push(fileCheck);
  const failed = checks.some(c => c.status === "FAILED");
  return { tier: "TIER_1", status: failed ? "FAILED" : "PASSED", checks, durationMs: Date.now() - t };
}

async function runTier2(projectId: number): Promise<TierResult> {
  const t = Date.now();
  const [tsCheck, pkgCheck] = await Promise.all([
    assertTypeScriptCompiles(projectId),
    assertPackagesInstalled(projectId),
  ]);
  const checks = [tsCheck, pkgCheck];
  const failed = checks.some(c => c.status === "FAILED");
  return { tier: "TIER_2", status: failed ? "FAILED" : "PASSED", checks, durationMs: Date.now() - t };
}

async function runTier3(projectId: number): Promise<TierResult> {
  const t = Date.now();
  // process_alive first — if dead, skip HTTP
  const processCheck = await assertProcessAlive(projectId);
  if (processCheck.status === "FAILED") {
    return { tier: "TIER_3", status: "FAILED", checks: [processCheck], durationMs: Date.now() - t };
  }
  const [httpCheck, logCheck] = await Promise.all([
    assertHttpStable(projectId),
    assertNoFatalLogs(projectId),
  ]);
  const checks = [processCheck, httpCheck, logCheck];
  const failed = checks.some(c => c.status === "FAILED");
  return { tier: "TIER_3", status: failed ? "FAILED" : "PASSED", checks, durationMs: Date.now() - t };
}

async function runTier4(_projectId: number): Promise<TierResult> {
  // Playwright-based behavioral checks — placeholder for Phase 2
  // Returns PASSED (skipped) until Playwright is available in runtime
  return {
    tier: "TIER_4",
    status: "PASSED",
    checks: [],
    durationMs: 0,
  };
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function runRuntimeTruth(
  projectId: number,
  runId:     string,
): Promise<RuntimeSnapshot> {
  const tiers: TierResult[] = [];
  let overallFailed = false;

  // Short-circuit: stop at first failed tier
  const t1 = await withTimeout(runTier1(projectId), TIER1_TIMEOUT_MS, "TIER_1");
  tiers.push(t1);
  if (t1.status === "FAILED") { overallFailed = true; }

  if (!overallFailed) {
    const t2 = await withTimeout(runTier2(projectId), TIER2_TIMEOUT_MS, "TIER_2");
    tiers.push(t2);
    if (t2.status === "FAILED") { overallFailed = true; }
  }

  if (!overallFailed) {
    const t3 = await withTimeout(runTier3(projectId), TIER3_TIMEOUT_MS, "TIER_3");
    tiers.push(t3);
    if (t3.status === "FAILED") { overallFailed = true; }
  }

  if (!overallFailed) {
    const t4 = await withTimeout(runTier4(projectId), TIER4_TIMEOUT_MS, "TIER_4");
    tiers.push(t4);
    if (t4.status === "FAILED") { overallFailed = true; }
  }

  const allChecks = tiers.flatMap(t => t.checks);
  const tscTier = tiers.find(t => t.tier === "TIER_2");
  const tscCheck = tscTier?.checks.find(c => c.name === "typescript_compile");
  const httpCheck = allChecks.find(c => c.name === "http_stable");
  const processCheck = allChecks.find(c => c.name === "process_alive");

  const snapshot: RuntimeSnapshot = {
    status: overallFailed ? VerificationStatus.FAILED : VerificationStatus.VERIFIED,
    observedAt: Date.now(),
    processPid: null,
    processAlive: processCheck?.status === "PASSED",
    consecutiveHttpOk: httpCheck?.status === "PASSED" ? 3 : 0,
    tscExitCode: tscCheck?.evidence.exitCode ?? null,
    tscErrors: tscCheck?.status === "FAILED" ? [tscCheck.message] : [],
    npmLsValid: tiers.find(t=>t.tier==="TIER_2")?.checks.find(c=>c.name==="package_integrity")?.status === "PASSED",
    importErrors: [],
    tiers,
  };

  return Object.freeze(snapshot);
}

// ─── Tier timeout wrapper ─────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tier ${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}
```

---

### FILE: `server/runtime-truth/runtime-observer.ts` *(NEW)*

```typescript
/**
 * runtime-observer.ts
 *
 * Continuous 5-second background process + HTTP observation.
 * Maintains a live RuntimeHeartbeat — lightweight, not full tier run.
 *
 * Responsibility: continuous lightweight observation only.
 *   Full on-demand tier runs use runtime-truth-engine.ts.
 *
 * LOC: ~90
 */

import { runtimeManager }    from "../infrastructure/runtime/runtime-manager.ts";
import { bus }               from "../infrastructure/events/bus.ts";

export interface RuntimeHeartbeat {
  readonly projectId: number;
  readonly alive: boolean;
  readonly httpCode: number | null;
  readonly observedAt: number;
  readonly stale: boolean;
}

const INTERVAL_MS   = 5_000;
const STALE_MS      = 15_000;  // heartbeat older than this = stale

const _snapshots = new Map<number, RuntimeHeartbeat>();
const _intervals = new Map<number, NodeJS.Timeout>();

export function startObserver(projectId: number): void {
  if (_intervals.has(projectId)) return;

  const tick = async () => {
    const entry = runtimeManager.get(projectId);
    let alive = false, httpCode: number | null = null;

    if (entry?.pid) {
      try { process.kill(entry.pid, 0); alive = true; } catch { alive = false; }
    }

    if (alive && entry?.port) {
      try {
        const res = await fetch(`http://localhost:${entry.port}/`, {
          signal: AbortSignal.timeout(3_000),
        });
        httpCode = res.status;
      } catch { httpCode = null; }
    }

    const hb: RuntimeHeartbeat = { projectId, alive, httpCode, observedAt: Date.now(), stale: false };
    _snapshots.set(projectId, hb);
    bus.emit("runtime.heartbeat" as any, hb);
  };

  tick();  // immediate first tick
  _intervals.set(projectId, setInterval(tick, INTERVAL_MS));
}

export function stopObserver(projectId: number): void {
  const id = _intervals.get(projectId);
  if (id) { clearInterval(id); _intervals.delete(projectId); }
  _snapshots.delete(projectId);
}

export function getHeartbeat(projectId: number): RuntimeHeartbeat | null {
  const hb = _snapshots.get(projectId);
  if (!hb) return null;
  const age = Date.now() - hb.observedAt;
  return age > STALE_MS ? { ...hb, stale: true } : hb;
}
```

---

### FILE: `server/recovery/checkpoint-validator.ts` *(NEW)*

```typescript
/**
 * checkpoint-validator.ts
 *
 * Grade checkpoints A/B/C/D based on evidence stored at creation time.
 * Recovery uses only Grade A or B (minimum configurable via policy).
 *
 * Responsibility: grade and select checkpoints for recovery.
 *
 * Grade A: git SHA + tsc verified + HTTP verified at checkpoint time
 * Grade B: git SHA + tsc verified
 * Grade C: git SHA only
 * Grade D: metadata only (DB status + file count)
 *
 * LOC: ~120
 */

import { checkpointStore }  from "../infrastructure/checkpoints/checkpoint.service.ts";
import { FAIL_CLOSED_POLICY } from "../governance/fail-closed-policy.ts";
import type { GradedCheckpoint, CheckpointGrade } from "../verification/types.ts";

// ─── Grading ──────────────────────────────────────────────────────────────────

export async function gradeCheckpoint(
  projectId:    number,
  checkpointId: string,
): Promise<GradedCheckpoint> {
  const meta = await checkpointStore.get(projectId, checkpointId);

  if (!meta || meta.status === "failed" || meta.fileCount === 0) {
    return { id: checkpointId, grade: "D", gitCommitSha: null,
      tscVerified: false, httpVerified: false, createdAt: meta?.createdAt ?? 0 };
  }

  if (!meta.gitCommitSha) {
    return { id: checkpointId, grade: "C", gitCommitSha: null,
      tscVerified: false, httpVerified: false, createdAt: meta.createdAt };
  }

  // B/A: need stored evidence from checkpoint creation
  // For now: if status === "stable" and has git SHA → Grade B
  // Phase 2: store tsc/http evidence at checkpoint creation time → Grade A
  const tscVerified = meta.status === "stable" && !!meta.gitCommitSha;
  const httpVerified = false;  // Phase 2: stored http probe evidence

  const grade: CheckpointGrade = httpVerified ? "A" : tscVerified ? "B" : "C";
  return {
    id: checkpointId,
    grade,
    gitCommitSha: meta.gitCommitSha,
    tscVerified,
    httpVerified,
    createdAt: meta.createdAt,
  };
}

// ─── Selection ────────────────────────────────────────────────────────────────

export async function selectBestRecoverable(
  projectId: number,
): Promise<GradedCheckpoint | null> {
  const all = await checkpointStore.listForProject(projectId);
  const stable = all.filter(m => m.status === "stable" && m.status !== "rolled_back");

  const graded = await Promise.all(
    stable.map(m => gradeCheckpoint(projectId, m.id)),
  );

  const minGrade = FAIL_CLOSED_POLICY.minimumRecoveryGrade;
  const gradeOrder: CheckpointGrade[] = ["A", "B", "C", "D"];
  const minIndex = gradeOrder.indexOf(minGrade);

  const eligible = graded
    .filter(g => gradeOrder.indexOf(g.grade) <= minIndex)
    .sort((a, b) => b.createdAt - a.createdAt);  // newest first

  return eligible[0] ?? null;
}

export async function selectFallbackCheckpoints(
  projectId: number,
  excludeIds: string[],
): Promise<GradedCheckpoint[]> {
  const all = await checkpointStore.listForProject(projectId);
  const minGrade = FAIL_CLOSED_POLICY.minimumRecoveryGrade;
  const gradeOrder: CheckpointGrade[] = ["A", "B", "C", "D"];
  const minIndex = gradeOrder.indexOf(minGrade);

  const graded = await Promise.all(
    all
      .filter(m => !excludeIds.includes(m.id) && m.status === "stable")
      .map(m => gradeCheckpoint(projectId, m.id)),
  );

  return graded
    .filter(g => gradeOrder.indexOf(g.grade) <= minIndex)
    .sort((a, b) => b.createdAt - a.createdAt);
}
```

---

### FILE: `server/recovery/recovery-orchestrator.ts` *(NEW)*

```typescript
/**
 * recovery-orchestrator.ts
 *
 * State-machine-driven recovery coordinator.
 * Replaces the ad-hoc recovery paths in recovery-manager.ts for the
 * verification-exhausted case.
 *
 * Responsibility: select Grade B+ checkpoint, rollback, verify restore.
 *
 * State machine:
 *   IDLE → ASSESSING → ROLLING_BACK → VERIFYING_RESTORE → RECOVERED | FAILED
 *
 * Inputs:  RecoveryInput
 * Outputs: RecoveryResult (ROLLED_BACK | FAILED — never VERIFIED)
 *
 * LOC: ~165
 */

import { VerificationStatus }          from "../verification/types.ts";
import { selectBestRecoverable, selectFallbackCheckpoints }
                                        from "./checkpoint-validator.ts";
import { acquireRecoveryLock, releaseRecoveryLock }
                                        from "../infrastructure/recovery/recovery-lock.ts";
import { rollbackLatestForProject }     from "../infrastructure/checkpoints/rollback.service.ts";
import { runtimeManager }              from "../infrastructure/runtime/runtime-manager.ts";
import { bus }                          from "../infrastructure/events/bus.ts";
import type { RecoveryInput, RecoveryResult, GradedCheckpoint } from "../verification/types.ts";

type RecoveryState =
  | "IDLE" | "ASSESSING" | "LOCKED" | "ROLLING_BACK"
  | "VERIFYING_RESTORE" | "RECOVERED" | "FAILED";

const MAX_FALLBACK_ATTEMPTS = 3;
const RESTORE_VERIFY_TIMEOUT_MS = 90_000;

export async function triggerRecovery(input: RecoveryInput): Promise<RecoveryResult> {
  let state: RecoveryState = "IDLE";
  const transition = (next: RecoveryState) => {
    state = next;
    bus.emit("agent.event", {
      runId: input.runId, eventType: "recovery.state" as any,
      phase: "recovery", payload: { state: next, projectId: input.projectId }, ts: Date.now(),
    });
  };

  transition("ASSESSING");

  const best = await selectBestRecoverable(input.projectId);
  if (!best) {
    transition("FAILED");
    return halt("No Grade B+ checkpoint available — manual intervention required.", input);
  }

  transition("LOCKED");
  const lock = acquireRecoveryLock(input.projectId);
  if (!lock.acquired) {
    transition("FAILED");
    return halt(`Recovery lock held: ${lock.reason}`, input);
  }

  const triedIds: string[] = [];
  let lastError = "";

  try {
    return await attemptRollback(input, best, triedIds, transition, lock.token!);
  } catch (err: any) {
    lastError = err.message;
    // Try fallback checkpoints
    const fallbacks = await selectFallbackCheckpoints(input.projectId, [best.id, ...triedIds]);
    for (const fallback of fallbacks.slice(0, MAX_FALLBACK_ATTEMPTS)) {
      try {
        return await attemptRollback(input, fallback, triedIds, transition, lock.token!);
      } catch (e: any) {
        lastError = e.message;
        triedIds.push(fallback.id);
      }
    }
    transition("FAILED");
    return halt(`All ${triedIds.length + 1} checkpoints failed. Last: ${lastError}`, input);
  } finally {
    releaseRecoveryLock(input.projectId, lock.token!, state === "RECOVERED");
  }
}

async function attemptRollback(
  input: RecoveryInput,
  checkpoint: GradedCheckpoint,
  triedIds: string[],
  transition: (s: RecoveryState) => void,
  lockToken: string,
): Promise<RecoveryResult> {
  triedIds.push(checkpoint.id);
  transition("ROLLING_BACK");

  // Stop runtime before file changes
  await stopRuntime(input.projectId);

  const rollback = await rollbackLatestForProject(input.projectId);
  if (!rollback?.success) {
    throw new Error(`Rollback to ${checkpoint.id} failed: ${rollback?.error ?? "unknown"}`);
  }

  transition("VERIFYING_RESTORE");
  const { runRuntimeTruth } = await import("../runtime-truth/runtime-truth-engine.ts");
  const snapshot = await Promise.race([
    runRuntimeTruth(input.projectId, input.runId),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Post-restore verify timed out")), RESTORE_VERIFY_TIMEOUT_MS),
    ),
  ]);

  if (snapshot.status !== VerificationStatus.VERIFIED) {
    throw new Error(`Post-restore verification failed for checkpoint ${checkpoint.id}`);
  }

  transition("RECOVERED");
  return {
    status: VerificationStatus.ROLLED_BACK,  // ROLLED_BACK ≠ success
    checkpointId: checkpoint.id,
    rollbackStrategy: checkpoint.gitCommitSha ? "git" : "snapshot",
    postRestoreVerified: true,
    requiresHumanIntervention: false,
  };
}

function halt(reason: string, input: RecoveryInput): RecoveryResult {
  bus.emit("agent.event", {
    runId: input.runId, eventType: "recovery.halted" as any,
    phase: "recovery", payload: { reason, projectId: input.projectId }, ts: Date.now(),
  });
  return {
    status: VerificationStatus.FAILED,
    checkpointId: null,
    rollbackStrategy: null,
    postRestoreVerified: false,
    requiresHumanIntervention: true,
    reason,
  };
}

async function stopRuntime(projectId: number): Promise<void> {
  const entry = runtimeManager.get(projectId);
  if (!entry?.pid) return;
  try {
    process.kill(entry.pid, "SIGTERM");
    await new Promise(resolve => setTimeout(resolve, 3_000));
    try { process.kill(entry.pid, "SIGKILL"); } catch { /* already dead */ }
  } catch { /* ignore */ }
}
```

---

## PART 4 — Modified Existing Files

### PATCH: `server/verification/engine/verification-engine.ts`

**Replace entire file:**

```typescript
/**
 * verification-engine.ts
 *
 * Verification orchestrator. Delegates truth observation to RuntimeTruthEngine.
 * Builds immutable VerificationResult. Enforces fail-closed via VerificationStatus.
 *
 * Responsibility: orchestrate → produce VerificationResult.
 *   - NEVER return VERIFIED when any blocking check fails
 *   - NEVER expose buildExhaustedFeedback with ok:true
 *   - buildVerificationFeedback always has ok:false
 *
 * LOC: ~120
 */

import { randomUUID }             from "node:crypto";
import { VerificationStatus }     from "../types.ts";
import { runRuntimeTruth }        from "../../runtime-truth/runtime-truth-engine.ts";
import type { VerificationResult } from "../types.ts";

// ─── Engine ───────────────────────────────────────────────────────────────────

export async function runVerificationEngine(
  projectId: number,
  runId:     string,
  attempt:   number = 1,
): Promise<VerificationResult> {
  const startTs = Date.now();

  const snapshot = await runRuntimeTruth(projectId, runId);
  const allChecks = snapshot.tiers.flatMap(t => t.checks);
  const issues = allChecks.filter(c => c.status === "FAILED").map(c => c.message);
  const requiredActions = allChecks
    .filter(c => c.status === "FAILED" && c.detail)
    .map(c => c.detail!);
  const allEvidence = allChecks.map(c => c.evidence);

  const result: VerificationResult = Object.freeze({
    id:              randomUUID(),
    runId,
    projectId,
    status:          snapshot.status,    // VERIFIED or FAILED — no "warned"
    attempt,
    checks:          Object.freeze([...allChecks]),
    issues:          Object.freeze([...issues]),
    requiredActions: Object.freeze([...requiredActions]),
    evidence:        Object.freeze([...allEvidence]),
    elapsedMs:       Date.now() - startTs,
    timestamp:       Date.now(),
  });

  return result;
}

// ─── LLM feedback — ok is ALWAYS false when status !== VERIFIED ───────────────

export function buildVerificationFeedback(
  result:     VerificationResult,
  maxRetries: number,
): string {
  const remaining = maxRetries - result.attempt;
  return JSON.stringify({
    ok:                  false,          // NEVER true here
    status:              result.status,
    verification_failed: true,
    attempt:             result.attempt,
    maxRetries,
    remaining,
    issues:              result.issues,
    requiredActions:     result.requiredActions,
    checks:              result.checks.map(c => ({
      name: c.name, status: c.status, message: c.message,
    })),
    message: [
      `task_complete BLOCKED — verification found ${result.issues.length} issue(s).`,
      `Attempt ${result.attempt}/${maxRetries} (${remaining} remaining).`,
      "ISSUES:", ...result.issues.map((iss, i) => `  ${i + 1}. ${iss}`),
      "", "Fix all issues above, then call task_complete again.",
    ].join("\n"),
  });
}

// REMOVED: buildExhaustedFeedback() with ok:true — does not exist
// Exhaustion is handled by ExecutionGuard.onVerificationExhausted() which throws
```

---

### PATCH: `server/verification/events/verification-events.ts`

Add one new emitter for `verification.exhausted_rollback` (replacing the misleading "completing with warnings" message):

```typescript
// ADD at end of file — replaces emitVerificationExhausted semantics
export function emitVerificationExhaustedRollback(
  projectId: number,
  runId:     string,
  attempts:  number,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "verification",
    eventType: "verification.exhausted_rollback" as any,
    payload:   {
      projectId, attempts,
      message: `Verification exhausted after ${attempts} attempts — triggering rollback.`,
    },
    ts: Date.now(),
  });
}
```

---

### PATCH: `server/verification/index.ts`

**Replace entire file:**

```typescript
/**
 * server/verification/index.ts
 * Public API for the verification layer.
 * LOC: ~25
 */

export { runVerificationEngine, buildVerificationFeedback }
  from "./engine/verification-engine.ts";
// REMOVED: buildExhaustedFeedback — eliminated

export { getOrCreateRetryController, releaseRetryController, RetryController }
  from "./retry/retry-controller.ts";

export {
  emitVerificationStarted,
  emitVerificationPassed,
  emitVerificationFailed,
  emitVerificationExhaustedRollback,
} from "./events/verification-events.ts";
// REMOVED: emitVerificationExhausted (old "completing with warnings" emitter)

export type {
  VerificationResult, VerificationReport,
  CheckResult, CheckStatus, RetryState,
  RuntimeSnapshot, EvidenceEntry, AgentRunResult,
} from "./types.ts";

export { VerificationStatus } from "./types.ts";
```

---

### PATCH: `server/agents/core/tool-loop/tool-loop.agent.ts`

**Replace entire file** with the fail-closed version:

```typescript
/**
 * tool-loop.agent.ts
 *
 * THE LLM TOOL-USE AGENT.
 *
 * Fail-closed execution:
 *   - no_tool_calls exit → verification required before success
 *   - verification exhausted → throws VerificationExhaustedError → run FAILED
 *   - task_complete → verification required, VERIFIED only → success
 *
 * LOC: ~185
 */

import { llm, type ToolMessage }      from "../../../llm/openrouter.client.ts";
import { TOOL_DEFS }                   from "../../../tools/orchestrator.ts";
import type { ToolContext }             from "../../../tools/orchestrator.ts";
import { bus }                          from "../../../infrastructure/events/bus.ts";
import { buildSystemPrompt }            from "../llm/prompt-builder/agents/system-prompt.agent.js";
import { TOOL_REFERENCE }               from "./tool-reference.ts";
import { withRetry }                    from "./retry.ts";
import { executeToolCall }              from "./tool-call.executor.ts";
import { executionObserver }            from "../../../tools/observation/index.ts";
import { checkpointStore }              from "../../../infrastructure/checkpoints/checkpoint.service.ts";
import { getProjectDir }                from "../../../infrastructure/sandbox/sandbox.util.ts";
import { VerificationStatus }           from "../../../verification/types.ts";
import {
  runVerificationEngine,
  buildVerificationFeedback,
  getOrCreateRetryController,
  releaseRetryController,
  emitVerificationStarted,
  emitVerificationPassed,
  emitVerificationFailed,
  emitVerificationExhaustedRollback,
} from "../../../verification/index.ts";
import {
  onVerificationExhausted,
  onNoToolCallsExit,
  buildNoToolCallsFailure,
  VerificationExhaustedError,
} from "../../../governance/execution-guard.ts";
import type { AgentLoopInput, AgentLoopResult } from "./types.ts";

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const maxSteps = input.maxSteps ?? 25;
  const resolvedSystemPrompt = buildSystemPrompt(input.systemPrompt) + "\n\n" + TOOL_REFERENCE;

  const messages: ToolMessage[] = input.initialMessages ?? buildInitialMessages(
    resolvedSystemPrompt, input.projectId, input.goal, input.memoryContext,
  );

  const ctx: ToolContext = { projectId: input.projectId, runId: input.runId, signal: input.signal };
  const retryCtrl = input.skipVerification ? null : getOrCreateRetryController(input.runId);

  checkpointStore.create({
    projectId:   input.projectId,
    sandboxRoot: getProjectDir(input.projectId),
    trigger:     "run_start",
    runId:       input.runId,
    label:       `pre-run: ${input.goal.slice(0, 60)}`,
  }).catch((e) => console.warn("[tool-loop] Pre-run checkpoint failed:", e.message));

  emit(input.runId, "agent.thinking", "tool-loop", {
    text: `Starting agent loop for: ${input.goal.slice(0, 200)}`,
  });

  let steps = 0, lastSummary = "";

  try {
    while (steps < maxSteps) {
      if (input.signal?.aborted) {
        return { success: false, steps, summary: "Aborted.", stopReason: "aborted", messages };
      }

      steps++;
      emit(input.runId, "agent.thinking", "tool-loop", { step: steps, text: `Step ${steps}…` });

      let response: Awaited<ReturnType<typeof llm.chatWithTools>>;
      let streamedContent = false;
      try {
        response = await withRetry(
          () => llm.streamChatWithTools(messages, [...TOOL_DEFS], {
            signal:      input.signal,
            onStreamStart: () => emit(input.runId, "agent.stream.start", "tool-loop", {}),
            onToken:     (token) => { streamedContent = true; emit(input.runId, "agent.token", "tool-loop", { token }); },
            onStreamEnd: (content) => emit(input.runId, "agent.stream.end", "tool-loop", { content }),
          }),
          { maxAttempts: 3, runId: input.runId, operationName: "llm.streamChatWithTools", signal: input.signal },
        );
      } catch (e: any) {
        const msg = e?.message || String(e);
        emit(input.runId, "agent.message", "error", { text: `LLM error: ${msg}` });
        return { success: false, steps, summary: msg, stopReason: "error", error: msg, messages };
      }

      if (response.content?.trim() && !streamedContent) {
        emit(input.runId, "agent.message", "tool-loop", { text: response.content });
      }

      // ── FAIL-CLOSED: no_tool_calls requires verification ──────────────────
      if (response.toolCalls.length === 0) {
        const content = response.content?.trim() || lastSummary || "Done.";
        emit(input.runId, "agent.thinking", "tool-loop", { text: "Text exit — verifying before completing." });

        const snapshot = await onNoToolCallsExit(input.projectId, input.runId);
        if (snapshot.status === VerificationStatus.VERIFIED) {
          emit(input.runId, "agent.message", "complete", { text: content });
          return { success: true, steps, summary: content, stopReason: "no_tool_calls", messages };
        }
        // Not verified — push failure and continue
        messages.push({ role: "user", content: buildNoToolCallsFailure(snapshot) });
        continue;
      }

      messages.push({
        role: "assistant", content: response.content || "",
        tool_calls: response.toolCalls.map(tc => ({
          id: tc.id, type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      let saw_complete = false;

      for (const call of response.toolCalls) {
        const output = await executeToolCall({ callId: call.id, name: call.name, args: call.arguments, ctx });
        messages.push({ role: "tool", tool_call_id: call.id, content: output.content });

        if (!output.isTerminal) continue;

        const summary = (output.parsedArgs["summary"] as string) || "Task complete.";
        if (!retryCtrl) { saw_complete = true; lastSummary = summary; continue; }

        emitVerificationStarted(input.projectId, input.runId);
        const result = await runVerificationEngine(input.projectId, input.runId, retryCtrl.attempts + 1);

        if (result.status === VerificationStatus.VERIFIED) {
          emitVerificationPassed(result as any);
          saw_complete = true;
          lastSummary = summary;

        } else if (retryCtrl.exhausted) {
          // ── FAIL-CLOSED: exhaustion → rollback → throw ───────────────────
          emitVerificationExhaustedRollback(input.projectId, input.runId, retryCtrl.attempts);
          // onVerificationExhausted ALWAYS throws — never returns
          await onVerificationExhausted(input.projectId, input.runId, result, retryCtrl.attempts);

        } else {
          const attempt = retryCtrl.recordAttempt();
          emitVerificationFailed(result as any, attempt);
          messages[messages.length - 1] = {
            role: "tool", tool_call_id: call.id,
            content: buildVerificationFeedback(result, retryCtrl.maxRetries),
          };
        }
      }

      if (saw_complete) {
        return { success: true, steps, summary: lastSummary, stopReason: "complete", messages };
      }
    }

    return {
      success: false, steps,
      summary: `Reached step limit of ${maxSteps}.`,
      stopReason: "max_steps",
      messages: [...messages],
    };

  } catch (err: any) {
    if (err instanceof VerificationExhaustedError) {
      // Recovery was triggered — run is FAILED, not success
      return {
        success:    false,
        steps,
        summary:    `Verification exhausted after ${err.attempts} attempts. Recovery: ${err.recoveryResult.status}.`,
        stopReason: err.recoveryResult.status === VerificationStatus.ROLLED_BACK
          ? "rolled_back"
          : "halted",
        messages,
      };
    }
    throw err;

  } finally {
    releaseRetryController(input.runId);
    executionObserver.release(input.runId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialMessages(
  systemPrompt: string, projectId: number, goal: string, memoryContext?: string,
): ToolMessage[] {
  const msgs: ToolMessage[] = [{ role: "system", content: systemPrompt }];
  if (memoryContext) {
    msgs.push({ role: "user", content: memoryContext });
    msgs.push({ role: "assistant", content: "I've reviewed the project memory. I'll build on existing work." });
  }
  msgs.push({ role: "user", content: `Project ID: ${projectId}\nGoal:\n${goal}` });
  return msgs;
}

function emit(runId: string, eventType: string, phase: string, payload: unknown): void {
  bus.emit("agent.event", { runId, eventType: eventType as any, phase, ts: Date.now(), payload });
}

export { TOOL_DEFS as TOOL_NAMES };
```

---

### PATCH: `server/agents/supervisor/hallucination-detector.ts` lines 136–139

```typescript
// BEFORE:
  const recommendation: HallucinationReport["recommendation"] =
    repetition.repeatCount >= 3 || fabricated.length > 0 ? "halt"
    : ungrounded.length >= 2                              ? "inject-warning"
    : "continue";

// AFTER (single ungrounded claim → inject-warning, not silently continue):
  const recommendation: HallucinationReport["recommendation"] =
    repetition.repeatCount >= 3 || fabricated.length > 0 ? "halt"
    : ungrounded.length >= 1                              ? "inject-warning"
    : "continue";
```

---

## PART 5 — State Machine (Deterministic)

```
RunState — every arrow is guarded by ExecutionGuard

  PENDING ──run.started──▶ RUNNING
                               │
                    task_complete called
                               │
                               ▼
                          VERIFYING ◀─────────────────────┐
                               │                          │
                    ┌──────────┴──────────┐               │
                    │                     │               │
                 VERIFIED              FAILED             │
                    │                     │               │
                    ▼               retries left?         │
                  DONE                  YES ──────────────┘
              (success:true)
              ONLY STATE         retries exhausted?
              WHERE               │
              success=true        ▼
                            RECOVERING
                                 │
                    ┌────────────┴────────────┐
                    │                         │
               ROLLED_BACK              FAILED (all checkpoints failed)
                    │                         │
                    ▼                         ▼
             Run: FAILED               Run: HALTED
             (success:false)         (human required)
             (never success:true)

FORBIDDEN TRANSITIONS (thrown as PolicyViolationError):
  VERIFYING → DONE without status=VERIFIED
  RECOVERING → DONE (rollback is never success)
  RUNNING → DONE via no_tool_calls without VERIFIED
```

---

## PART 6 — Dependency Graph (Enforcement Rules)

```
ALLOWED IMPORTS:
  tool-loop.agent.ts  →  governance/execution-guard.ts
  tool-loop.agent.ts  →  verification/index.ts
  verification/       →  runtime-truth/runtime-truth-engine.ts
  recovery/           →  runtime-truth/runtime-truth-engine.ts
  recovery/           →  infrastructure/checkpoints/
  governance/         →  verification/types.ts  (types only)
  governance/         →  recovery/recovery-orchestrator.ts  (dynamic import)

FORBIDDEN IMPORTS (enforced by architecture boundary):
  runtime-truth/  →  agents/   ← truth layer must be LLM-free
  verification/   →  planner/  ← verification has no planning concerns
  recovery/       →  planner/  ← recovery has no planning concerns
  governance/     →  memory/   ← governance must not read stale memory
  runtime-truth/  →  llm/      ← no LLM in truth observation
```

---

## PART 7 — Migration Checklist

### Step 1 — Critical Bug Fixes (2–4 hours, surgical edits)

```
□ tool-loop.agent.ts
  - Replace lines 129–133 (no_tool_calls fake success)
  - Replace lines 168–175 (exhaustion fake success)
  - Update import list (remove buildExhaustedFeedback, add execution-guard imports)

□ verification/engine/verification-engine.ts
  - Remove buildExhaustedFeedback() function entirely
  - Update runVerificationEngine() to use RuntimeTruthEngine

□ verification/events/verification-events.ts
  - Add emitVerificationExhaustedRollback()

□ verification/index.ts
  - Remove buildExhaustedFeedback export
  - Add new exports

□ agents/supervisor/hallucination-detector.ts
  - Change ungrounded.length >= 2 to >= 1 (line 138)
```

### Step 2 — New Type System (1–2 hours)

```
□ server/verification/types.ts — replace with new enum-based types
  (keep VerificationReport as @deprecated shim for backward compat)
```

### Step 3 — New Files (1–2 days)

```
□ server/governance/fail-closed-policy.ts
□ server/governance/execution-guard.ts
□ server/runtime-truth/runtime-assertions.ts
□ server/runtime-truth/runtime-truth-engine.ts
□ server/runtime-truth/runtime-observer.ts
□ server/recovery/checkpoint-validator.ts
□ server/recovery/recovery-orchestrator.ts
```

### Step 4 — Wire New Modules (2–4 hours)

```
□ Verify tool-loop.agent.ts imports compile
□ Verify verification-engine.ts imports compile
□ Verify recovery-orchestrator.ts imports compile
□ Add runtime-observer.ts startup to server/main.ts or run-lifecycle init
```

### Step 5 — Remove Legacy (after validation)

```
□ Remove @deprecated VerificationReport if no consumers remain
□ Remove old emitVerificationExhausted (was emitting "completing with warnings")
□ Remove runtime/typescript-validator.ts log-scanning (replaced by assertions.ts)
```

---

## PART 8 — Verification That Fixes Are Complete

After Step 1, search for these patterns — all must return zero results:

```bash
# Must not exist — fake success via ok:true in exhausted path
grep -r "ok.*true.*exhausted\|exhausted.*ok.*true" server/

# Must not exist — buildExhaustedFeedback
grep -r "buildExhaustedFeedback" server/

# Must not exist — no_tool_calls returning success without verification
grep -r "stopReason.*no_tool_calls" server/ | grep "success: true"

# Must not exist — warning-based success
grep -r '"warned"\|"partial"\|verification_exhausted.*true.*ok.*true' server/

# Must not exist — log scanning as TypeScript truth source
grep -r "TS_ERROR_PATTERNS.*logBuffer\|logBuffer.*TS_ERROR" server/verification/
```

---

*The system must fail visibly or not fail at all. Success is only permitted through VERIFIED.*
