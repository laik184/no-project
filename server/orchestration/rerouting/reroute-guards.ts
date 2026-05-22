/**
 * reroute-guards.ts
 *
 * Safety guards that must ALL pass before a mode transition is allowed.
 * Prevents unsafe rerouting, detects escalation loops, blocks unstable transitions.
 * Pure checks — no side effects, no telemetry (caller emits telemetry).
 */

import type { OrchestrationMode } from "../core/orchestration-types.ts";
import type { GuardResult, RuntimeMetricsSnapshot } from "./reroute-types.ts";
import { ESCALATION, GUARD } from "./reroute-thresholds.ts";

// ── Guard registry ────────────────────────────────────────────────────────────

interface GuardCheck {
  name:  string;
  check: (
    metrics:    RuntimeMetricsSnapshot,
    fromMode:   OrchestrationMode,
    toMode:     OrchestrationMode,
    context:    GuardContext,
  ) => GuardCheckResult;
}

interface GuardCheckResult {
  passed:  boolean;
  detail:  string;
  warning: boolean;    // true = warn but don't block
}

interface GuardContext {
  escalationCount:      number;
  lastEscalationAt:     number;
  transitionAttempts:   number;
  hasActiveWriteLock:   boolean;
  hasVerificationLock:  boolean;
  hasRecoveryLock:      boolean;
  checkpointExists:     boolean;
}

// ── Guards ────────────────────────────────────────────────────────────────────

const GUARDS: GuardCheck[] = [
  {
    name: "no_active_write_lock",
    check: (_, __, ___, ctx) => ({
      passed:  !ctx.hasActiveWriteLock,
      detail:  ctx.hasActiveWriteLock ? "Active write lock — cannot transition mid-write" : "No write lock",
      warning: false,
    }),
  },
  {
    name: "no_verification_lock",
    check: (_, __, ___, ctx) => ({
      passed:  !ctx.hasVerificationLock,
      detail:  ctx.hasVerificationLock ? "Verification in progress — transition blocked" : "No verification lock",
      warning: false,
    }),
  },
  {
    name: "no_recovery_lock",
    check: (_, __, ___, ctx) => ({
      passed:  !ctx.hasRecoveryLock,
      detail:  ctx.hasRecoveryLock ? "Recovery in progress — unsafe to reroute" : "No recovery lock",
      warning: false,
    }),
  },
  {
    name: "checkpoint_exists",
    check: (_, __, ___, ctx) => ({
      passed:  ctx.checkpointExists,
      detail:  ctx.checkpointExists ? "Checkpoint present" : "No checkpoint — state cannot be preserved",
      warning: false,
    }),
  },
  {
    name: "escalation_cooldown",
    check: (_, __, ___, ctx) => {
      const since = Date.now() - ctx.lastEscalationAt;
      const ok    = ctx.lastEscalationAt === 0 || since >= ESCALATION.COOLDOWN_MS;
      return {
        passed:  ok,
        detail:  ok ? "Cooldown satisfied" : `Cooldown active: ${Math.round((ESCALATION.COOLDOWN_MS - since) / 1000)}s remaining`,
        warning: false,
      };
    },
  },
  {
    name: "no_escalation_loop",
    check: (_, __, ___, ctx) => ({
      passed:  ctx.escalationCount < ESCALATION.MAX_ESCALATIONS_PER_RUN,
      detail:  `Escalation count: ${ctx.escalationCount}/${ESCALATION.MAX_ESCALATIONS_PER_RUN}`,
      warning: false,
    }),
  },
  {
    name: "max_transition_attempts",
    check: (_, __, ___, ctx) => ({
      passed:  ctx.transitionAttempts < GUARD.MAX_TRANSITION_ATTEMPTS,
      detail:  `Transition attempts: ${ctx.transitionAttempts}/${GUARD.MAX_TRANSITION_ATTEMPTS}`,
      warning: false,
    }),
  },
  {
    name: "runtime_not_crashed",
    check: (metrics) => {
      const ok = metrics.runtimeStatus !== "crashed";
      return {
        passed:  ok,
        detail:  ok ? "Runtime healthy" : "Runtime is crashed — transition unsafe",
        warning: !ok,   // warn but don't hard-block (recovery might fix it)
      };
    },
  },
  {
    name: "mode_upgrade_only",
    check: (_, from, to) => {
      const ORDER: OrchestrationMode[] = ["tool-loop", "planned", "pipeline", "dag", "recovery", "quantum"];
      const fromIdx = ORDER.indexOf(from);
      const toIdx   = ORDER.indexOf(to);
      const ok      = toIdx > fromIdx;
      return {
        passed:  ok,
        detail:  ok ? `Upgrade: ${from} → ${to}` : `Downgrade blocked: ${from} → ${to}`,
        warning: false,
      };
    },
  },
];

// ── Public guard runner ───────────────────────────────────────────────────────

export function runGuards(
  metrics:    RuntimeMetricsSnapshot,
  fromMode:   OrchestrationMode,
  toMode:     OrchestrationMode,
  ctx:        GuardContext,
): GuardResult {
  const blockingGuards: string[] = [];
  const warnings:       string[] = [];

  for (const guard of GUARDS) {
    const result = guard.check(metrics, fromMode, toMode, ctx);
    if (!result.passed) {
      if (result.warning) warnings.push(`${guard.name}: ${result.detail}`);
      else                blockingGuards.push(`${guard.name}: ${result.detail}`);
    }
  }

  return {
    safe:           blockingGuards.length === 0,
    blockingGuards,
    warnings,
  };
}

export type { GuardContext };
