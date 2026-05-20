/**
 * lifecycle-manager.ts
 *
 * Manages lifecycle hooks for all orchestration phases.
 * Hooks are registered per-phase and fired deterministically.
 * Enables plugins/integrations to observe and react to phase changes.
 */

import { onRunLifecycle }      from "../core/orchestration-events.ts";
import { captureCheckpoint }   from "../core/orchestration-replay.ts";
import { recordDuration }      from "../telemetry/orchestration-metrics.ts";
import type { OrchestrationPhase } from "../core/orchestration-types.ts";

// ── Hook types ────────────────────────────────────────────────────────────────

export type PhaseHook = (opts: {
  runId:     string;
  projectId: number;
  phase:     OrchestrationPhase;
  metadata?: Record<string, unknown>;
}) => Promise<void> | void;

type HookMap = Map<OrchestrationPhase | "any", PhaseHook[]>;

// ── Registry ──────────────────────────────────────────────────────────────────

const _enterHooks: HookMap = new Map();
const _exitHooks:  HookMap = new Map();
const _phaseTimers = new Map<string, number>(); // `${runId}:${phase}` → startedAt

// ── Registration ──────────────────────────────────────────────────────────────

export function onPhaseEnter(phase: OrchestrationPhase | "any", hook: PhaseHook): void {
  const list = _enterHooks.get(phase) ?? [];
  list.push(hook);
  _enterHooks.set(phase, list);
}

export function onPhaseExit(phase: OrchestrationPhase | "any", hook: PhaseHook): void {
  const list = _exitHooks.get(phase) ?? [];
  list.push(hook);
  _exitHooks.set(phase, list);
}

// ── Fire hooks ────────────────────────────────────────────────────────────────

export async function firePhaseEnter(
  runId:     string,
  projectId: number,
  phase:     OrchestrationPhase,
  metadata?: Record<string, unknown>,
): Promise<void> {
  _phaseTimers.set(`${runId}:${phase}`, Date.now());

  const hooks = [
    ...(_enterHooks.get(phase) ?? []),
    ...(_enterHooks.get("any")  ?? []),
  ];

  for (const hook of hooks) {
    try {
      await hook({ runId, projectId, phase, metadata });
    } catch (err) {
      console.warn(`[lifecycle-manager] Enter hook failed for phase=${phase}: ${err}`);
    }
  }
}

export async function firePhaseExit(
  runId:     string,
  projectId: number,
  phase:     OrchestrationPhase,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const key    = `${runId}:${phase}`;
  const startAt = _phaseTimers.get(key) ?? Date.now();
  const durationMs = Date.now() - startAt;
  _phaseTimers.delete(key);

  recordDuration(`phase.${phase}.duration`, durationMs, { projectId: String(projectId) });

  const hooks = [
    ...(_exitHooks.get(phase) ?? []),
    ...(_exitHooks.get("any")  ?? []),
  ];

  for (const hook of hooks) {
    try {
      await hook({ runId, projectId, phase, metadata });
    } catch (err) {
      console.warn(`[lifecycle-manager] Exit hook failed for phase=${phase}: ${err}`);
    }
  }
}

// ── Built-in hooks ────────────────────────────────────────────────────────────

// Checkpoint at key phases automatically
onPhaseExit("plan",    async ({ runId, projectId }) => { captureCheckpoint(runId, projectId, "plan"); });
onPhaseExit("execute", async ({ runId, projectId }) => { captureCheckpoint(runId, projectId, "execute"); });
onPhaseExit("verify",  async ({ runId, projectId }) => { captureCheckpoint(runId, projectId, "verify"); });

// ── Run lifecycle integration ─────────────────────────────────────────────────

let _lifecycleUnsub: (() => void) | null = null;

export function startLifecycleTracking(): void {
  if (_lifecycleUnsub) return;
  _lifecycleUnsub = onRunLifecycle((status, runId, projectId) => {
    if (status === "completed") {
      _phaseTimers.forEach((_, key) => {
        if (key.startsWith(`${runId}:`)) _phaseTimers.delete(key);
      });
    }
  });
  console.log("[lifecycle-manager] Phase lifecycle tracking active.");
}

export function stopLifecycleTracking(): void {
  _lifecycleUnsub?.();
  _lifecycleUnsub = null;
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function activePhaseTimers(): string[] {
  return Array.from(_phaseTimers.keys());
}

export function hookCount(): { enter: number; exit: number } {
  let enter = 0, exit = 0;
  _enterHooks.forEach(h => { enter += h.length; });
  _exitHooks.forEach(h => { exit  += h.length; });
  return { enter, exit };
}
