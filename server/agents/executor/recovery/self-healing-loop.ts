/**
 * server/agents/executor/recovery/self-healing-loop.ts
 *
 * Autonomous self-healing execution wrapper.
 *
 * Flow:
 *   execute(fn)
 *     ↓ validate result
 *     ↓ detect failure
 *     ↓ analyze via recovery-engine
 *     ↓ apply repair/rollback/retry
 *     ↓ re-execute
 *     ↓ revalidate
 *
 * Hard limits:
 *   MAX_HEAL_CYCLES = 3   — prevents infinite repair loops
 *   MAX_RETRY_PER_CYCLE   — prevents retry explosions within a cycle
 *
 * No tool imports. Callers supply execution and validation functions.
 */

import { recoveryEngine }         from './recovery-engine.ts';
import { rollbackManager }        from './rollback-manager.ts';
import { executionTimeline }      from '../telemetry/execution-timeline.ts';
import { executionStateMachine }  from '../runtime/execution-state-machine.ts';
import { workingMemory }          from '../memory/working-memory.ts';
import type { TaskKind }          from '../types/executor.types.ts';

// ── Configuration ─────────────────────────────────────────────────────────────

const MAX_HEAL_CYCLES     = 3;
const MAX_RETRY_PER_CYCLE = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HealContext {
  runId:           string;
  taskId:          string;
  stepId:          string;
  toolName:        string;
  kind:            TaskKind;
  maxAttempts:     number;
  workflowCritical: boolean;
}

export interface HealResult<T> {
  ok:          boolean;
  data?:       T;
  error?:      string;
  healCycles:  number;
  retries:     number;
  escalated:   boolean;
}

export type HealExecuteFn<T> = () => Promise<T>;
export type HealValidateFn<T> = (result: T) => { ok: boolean; reason?: string };

// ── Loop ──────────────────────────────────────────────────────────────────────

export async function selfHealingLoop<T>(
  ctx:      HealContext,
  execute:  HealExecuteFn<T>,
  validate: HealValidateFn<T> = () => ({ ok: true }),
): Promise<HealResult<T>> {
  const { runId, taskId, stepId, toolName, kind, maxAttempts, workflowCritical } = ctx;

  let healCycles = 0;
  let retries    = 0;
  let lastError  = '';

  workingMemory.init(runId);
  rollbackManager.createCheckpoint(runId, taskId, 'files');

  while (healCycles <= MAX_HEAL_CYCLES) {
    // Guard: check if run was cancelled or escalated externally
    const smState = executionStateMachine.getState(runId);
    if (smState === 'CANCELLED' || smState === 'ESCALATED') {
      return { ok: false, error: `Run ${smState.toLowerCase()}`, healCycles, retries, escalated: smState === 'ESCALATED' };
    }

    // ── Execute ───────────────────────────────────────────────────────────────
    let result: T;
    try {
      result = await execute();
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      retries++;

      if (retries > maxAttempts + MAX_RETRY_PER_CYCLE * MAX_HEAL_CYCLES) {
        lastError = `[self-healing] Retry ceiling breached after ${retries} total attempts`;
        break;
      }

      const plan = recoveryEngine.assess({
        runId, taskId, stepId, toolName, kind,
        error:    lastError,
        attempt:  retries,
        maxAttempts,
        workflowCritical,
      });

      if (plan.shouldEscalate || !plan.ok) {
        recoveryEngine.escalate(runId, plan.rationale);
        return { ok: false, error: plan.rationale, healCycles, retries, escalated: true };
      }

      // Wait before retry
      if (plan.retryDelay && plan.retryDelay > 0) {
        await new Promise<void>((r) => setTimeout(r, Math.min(plan.retryDelay!, 5_000)));
      }

      healCycles++;
      executionTimeline.record(
        runId, 'recovery.started',
        `Self-heal cycle ${healCycles}/${MAX_HEAL_CYCLES}: ${plan.action}`,
      );
      continue;
    }

    // ── Validate ──────────────────────────────────────────────────────────────
    executionTimeline.record(runId, 'validation.started', `Validating result — heal cycle ${healCycles}`);
    const validation = validate(result!);

    if (validation.ok) {
      executionTimeline.record(runId, 'validation.passed', 'Self-healing validation passed');
      recoveryEngine.resolveRecovery(runId);
      return { ok: true, data: result!, healCycles, retries, escalated: false };
    }

    // Validation failed
    lastError = validation.reason ?? 'Validation failed';
    executionTimeline.record(runId, 'validation.failed', lastError);

    if (healCycles >= MAX_HEAL_CYCLES) break;

    healCycles++;

    const plan = recoveryEngine.assess({
      runId, taskId, stepId, toolName, kind,
      error:    lastError,
      attempt:  retries,
      maxAttempts,
      workflowCritical,
    });

    if (plan.shouldEscalate || !plan.ok) {
      recoveryEngine.escalate(runId, plan.rationale);
      return { ok: false, error: plan.rationale, healCycles, retries, escalated: true };
    }

    executionTimeline.record(
      runId, 'recovery.started',
      `Post-validation heal cycle ${healCycles}/${MAX_HEAL_CYCLES}: ${plan.action}`,
    );

    if (plan.retryDelay && plan.retryDelay > 0) {
      await new Promise<void>((r) => setTimeout(r, Math.min(plan.retryDelay!, 5_000)));
    }
  }

  // Exhausted all heal cycles
  executionTimeline.record(runId, 'recovery.failed', `Self-healing exhausted after ${healCycles} cycle(s)`);
  return {
    ok:        false,
    error:     lastError || `Self-healing loop exhausted after ${MAX_HEAL_CYCLES} cycles`,
    healCycles,
    retries,
    escalated: false,
  };
}

export const selfHealingConfig = { MAX_HEAL_CYCLES, MAX_RETRY_PER_CYCLE };
