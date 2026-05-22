/**
 * dynamic-rerouter.ts
 *
 * Public facade for the Dynamic Re-Routing System.
 * Orchestrates the full rerouting lifecycle: signal analysis → decision →
 * guard check → transition → telemetry.
 *
 * Callers invoke evaluate() at decision points in the execution pipeline.
 * No business logic lives here — all delegated to focused sub-modules.
 */

import type { OrchestrationContext, OrchestrationState } from "../core/orchestration-types.ts";
import type { RuntimeMetricsSnapshot, RerouteContext } from "./reroute-types.ts";
import { analyzeSignals }          from "./reroute-signal-analyzer.ts";
import { makeDecision }            from "./reroute-decision-engine.ts";
import { runGuards }               from "./reroute-guards.ts";
import { executeTransition, getEscalationInfo, recordEscalation } from "./mode-transition-manager.ts";
import {
  telemetrySignalDetected,
  telemetryRerouteRequested,
  telemetryRerouteApproved,
  telemetryRerouteBlocked,
  telemetryLoopDetected,
} from "./reroute-telemetry.ts";
import { ESCALATION } from "./reroute-thresholds.ts";

// ── Reroute result ────────────────────────────────────────────────────────────

export interface RerouteResult {
  rerouted:    boolean;
  updatedCtx:  OrchestrationContext;
  reason:      string;
  newMode?:    string;
}

// ── Per-run lock state (in-process) ──────────────────────────────────────────

const _locks = new Map<string, {
  writeLock:        boolean;
  verificationLock: boolean;
  recoveryLock:     boolean;
  checkpointExists: boolean;
}>();

function _getLocks(runId: string) {
  return _locks.get(runId) ?? {
    writeLock: false, verificationLock: false,
    recoveryLock: false, checkpointExists: false,
  };
}

// ── Lock API (called by execution subsystems) ─────────────────────────────────

export function setWriteLock(runId: string, active: boolean): void {
  const l = _getLocks(runId);
  _locks.set(runId, { ...l, writeLock: active });
}

export function setVerificationLock(runId: string, active: boolean): void {
  const l = _getLocks(runId);
  _locks.set(runId, { ...l, verificationLock: active });
}

export function setRecoveryLock(runId: string, active: boolean): void {
  const l = _getLocks(runId);
  _locks.set(runId, { ...l, recoveryLock: active });
}

export function setCheckpointExists(runId: string, exists: boolean): void {
  const l = _getLocks(runId);
  _locks.set(runId, { ...l, checkpointExists: exists });
}

// ── Main evaluate entrypoint ──────────────────────────────────────────────────

export async function evaluate(
  metrics: RuntimeMetricsSnapshot,
  ctx:     OrchestrationContext,
  state:   OrchestrationState,
): Promise<RerouteResult> {
  const { runId } = ctx;

  // Step 1: Analyse signals
  const analysis = analyzeSignals(metrics);

  // Emit telemetry for each detected signal
  for (const signal of analysis.signals) {
    telemetrySignalDetected(signal, runId);
  }

  // Step 2: Get escalation history
  const escalInfo = getEscalationInfo(runId);

  // Step 3: Loop detection
  if (escalInfo.count >= ESCALATION.MAX_ESCALATIONS_PER_RUN) {
    telemetryLoopDetected(runId, escalInfo.count);
    return { rerouted: false, updatedCtx: ctx, reason: "Escalation loop detected — rerouting halted" };
  }

  // Step 4: Make decision
  const decision = makeDecision({
    metrics,
    analysis,
    escalationCount: escalInfo.count,
  });

  // Step 5: If not escalating, return early
  if (decision.kind !== "ESCALATE" || !decision.toMode) {
    return { rerouted: false, updatedCtx: ctx, reason: decision.reason };
  }

  telemetryRerouteRequested(decision, runId, metrics);

  // Step 6: Run safety guards
  const locks    = _getLocks(runId);
  const guardCtx = {
    escalationCount:      escalInfo.count,
    lastEscalationAt:     escalInfo.lastAt,
    transitionAttempts:   0,
    hasActiveWriteLock:   locks.writeLock,
    hasVerificationLock:  locks.verificationLock,
    hasRecoveryLock:      locks.recoveryLock,
    checkpointExists:     locks.checkpointExists,
  };

  const guardResult = runGuards(metrics, ctx.mode, decision.toMode, guardCtx);

  // Build reroute context for downstream
  const rerouteCtx: RerouteContext = {
    runId, projectId: ctx.projectId,
    metrics, signals: analysis.signals,
    decision, guardResult,
    escalationCount: escalInfo.count,
  };

  // Step 7: Block if guards fail
  if (!guardResult.safe) {
    telemetryRerouteBlocked(
      runId, ctx.mode, guardResult.blockingGuards,
      guardResult.blockingGuards[0] ?? "unknown guard failure",
    );
    return {
      rerouted:   false,
      updatedCtx: ctx,
      reason:     `Reroute blocked: ${guardResult.blockingGuards.join("; ")}`,
    };
  }

  telemetryRerouteApproved(decision, runId);

  // Step 8: Execute transition
  const transition = await executeTransition({
    runId, ctx, state,
    fromMode: ctx.mode,
    toMode:   decision.toMode,
    reason:   decision.reason,
    metrics,
  });

  if (!transition.success) {
    return {
      rerouted:   false,
      updatedCtx: ctx,
      reason:     `Transition failed: ${transition.error}`,
    };
  }

  // Step 9: Record escalation and return updated context
  recordEscalation(runId);

  console.info(
    `[dynamic-rerouter] REROUTED run=${runId} ` +
    `${ctx.mode} → ${decision.toMode} reason="${decision.reason}"`,
  );

  return {
    rerouted:   true,
    updatedCtx: transition.updatedCtx,
    newMode:    decision.toMode,
    reason:     decision.reason,
  };
}

// ── Convenience: build metrics snapshot from available runtime data ───────────

export function buildMetricsSnapshot(
  partial: Omit<RuntimeMetricsSnapshot, "heapUsedMb" | "capturedAt"> &
           Partial<Pick<RuntimeMetricsSnapshot, "heapUsedMb" | "capturedAt">>,
): RuntimeMetricsSnapshot {
  const memUsage = process.memoryUsage();
  return {
    ...partial,
    heapUsedMb: partial.heapUsedMb ?? memUsage.heapUsed / 1_048_576,
    capturedAt:  partial.capturedAt ?? Date.now(),
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanup(runId: string): void {
  _locks.delete(runId);
}
