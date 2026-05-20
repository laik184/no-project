/**
 * orchestration-recovery.ts
 *
 * Orchestration-layer recovery coordinator.
 * Decides recovery strategy and delegates to infrastructure recovery systems.
 * Does NOT implement recovery itself — it coordinates the decision.
 */

import { transitionPhase, recordError, incrementRetry, requireState } from "./orchestration-state.ts";
import { getLatestCheckpoint, buildReplayPlan }                        from "./orchestration-replay.ts";
import { emitOrchestrationLifecycle, emitOrchestrationError }          from "./orchestration-events.ts";
import type {
  OrchestrationPhase,
  RecoveryStrategy,
  RecoveryDecision,
} from "./orchestration-types.ts";

// ── Strategy selection ────────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS    = 3;
const BACKOFF_BASE_MS       = 1_500;

export function selectRecoveryStrategy(
  runId:     string,
  error:     Error,
  phase:     OrchestrationPhase,
): RecoveryDecision {
  const state = requireState(runId);

  // Circuit break if too many retries
  if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
    return {
      strategy:    "circuit_break",
      maxAttempts: 0,
      backoffMs:   0,
      reason:      `Retry limit reached (${state.retryCount}/${MAX_RETRY_ATTEMPTS})`,
      confidence:  1.0,
    };
  }

  // Checkpoint restore if we have one and the phase is past planning
  const RESTORABLE_PHASES: OrchestrationPhase[] = ["execute", "verify", "reflect", "score"];
  if (RESTORABLE_PHASES.includes(phase)) {
    const cp = getLatestCheckpoint(runId);
    if (cp) {
      return {
        strategy:    "checkpoint_restore",
        maxAttempts: 2,
        backoffMs:   BACKOFF_BASE_MS,
        reason:      `Checkpoint available at phase=${cp.phase}`,
        confidence:  0.85,
      };
    }
  }

  // Rollback for destructive execution failures
  if (phase === "execute" && error.message.includes("file")) {
    return {
      strategy:    "rollback",
      maxAttempts: 1,
      backoffMs:   0,
      reason:      "File operation failed — rolling back to safe state",
      confidence:  0.9,
    };
  }

  // Default: retry with exponential backoff
  const backoffMs = BACKOFF_BASE_MS * Math.pow(2, state.retryCount);
  return {
    strategy:    "retry",
    maxAttempts: MAX_RETRY_ATTEMPTS,
    backoffMs,
    reason:      `Transient failure in phase=${phase} — retrying`,
    confidence:  0.7,
  };
}

// ── Recovery execution ────────────────────────────────────────────────────────

export async function applyOrchestrationRecovery(
  runId:     string,
  projectId: number,
  error:     Error,
  phase:     OrchestrationPhase,
): Promise<{ shouldContinue: boolean; resumePhase: OrchestrationPhase }> {
  const decision = selectRecoveryStrategy(runId, error, phase);

  recordError(runId, {
    phase,
    message:   error.message,
    code:      decision.strategy,
    retryable: decision.strategy !== "circuit_break",
  });

  emitOrchestrationError({
    runId,
    projectId,
    phase,
    error:     error.message,
    retryable: decision.strategy !== "circuit_break",
  });

  console.log(`[orchestration-recovery] Strategy=${decision.strategy} for run=${runId} phase=${phase}: ${decision.reason}`);

  switch (decision.strategy) {
    case "circuit_break": {
      transitionPhase(runId, "failed", `Circuit break: ${decision.reason}`);
      return { shouldContinue: false, resumePhase: "failed" };
    }

    case "checkpoint_restore": {
      const plan = buildReplayPlan(runId, phase);
      if (!plan || !plan.replayable) {
        incrementRetry(runId);
        await delay(decision.backoffMs);
        transitionPhase(runId, "heal", "Checkpoint restore fallback to retry");
        return { shouldContinue: true, resumePhase: "execute" };
      }
      incrementRetry(runId);
      await delay(decision.backoffMs);
      transitionPhase(runId, "heal", `Restoring from checkpoint ${plan.checkpointId}`);
      return { shouldContinue: true, resumePhase: plan.resumePhase };
    }

    case "rollback":
    case "retry": {
      incrementRetry(runId);
      await delay(decision.backoffMs);
      transitionPhase(runId, "heal", decision.reason);
      return { shouldContinue: true, resumePhase: "execute" };
    }

    default: {
      transitionPhase(runId, "failed", "Unknown recovery strategy");
      return { shouldContinue: false, resumePhase: "failed" };
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Recovery diagnostics ──────────────────────────────────────────────────────

export function getRecoveryDiagnostics(runId: string): {
  retryCount: number;
  strategy?:  RecoveryStrategy;
  lastError?: string;
} {
  try {
    const state = requireState(runId);
    const lastErr = state.errorLog[state.errorLog.length - 1];
    return {
      retryCount: state.retryCount,
      strategy:   lastErr?.code as RecoveryStrategy,
      lastError:  lastErr?.message,
    };
  } catch {
    return { retryCount: 0 };
  }
}
