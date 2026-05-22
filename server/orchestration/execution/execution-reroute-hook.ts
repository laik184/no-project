/**
 * execution-reroute-hook.ts
 *
 * Thin wrapper that injects dynamic rerouting into the execution pipeline.
 * Runs the mode handler while concurrently polling for reroute signals.
 * If a reroute is approved, the handler is interrupted and re-routed.
 *
 * Separation reason: keeps execution-router.ts under 250 lines.
 */

import type { OrchestrationContext, OrchestrationState } from "../core/orchestration-types.ts";

// ── Reroute polling interval ──────────────────────────────────────────────────

const POLL_MS       = 15_000;   // evaluate rerouting every 15s
const REROUTE_LIMIT = 2;        // max re-route attempts per routeExecution call

// ── Hook ──────────────────────────────────────────────────────────────────────

export type ModeHandler = (ctx: OrchestrationContext) => Promise<void>;

export interface RerouteHookOptions {
  ctx:     OrchestrationContext;
  state:   OrchestrationState;
  handler: ModeHandler;

  // Caller-supplied runtime metrics (collected incrementally)
  getMetrics: () => RerouteMetricsInput;

  // Re-invoke the full router on escalation
  reInvoke: (updatedCtx: OrchestrationContext) => Promise<void>;
}

export interface RerouteMetricsInput {
  retryCount:            number;
  filesTouchedCount:     number;
  verificationFailCount: number;
  toolFailureCount:      number;
  runtimeStatus:         string;
  runtimeRestarts:       number;
  dependencyCount:       number;
  agentConfidenceScore:  number;
  hallucinationRisk:     number;
  reflectionSeverity:    number;
  avgStepMs:             number;
}

// ── Main wrapper ──────────────────────────────────────────────────────────────

export async function withRerouting(opts: RerouteHookOptions): Promise<void> {
  const { ctx, state, handler, getMetrics, reInvoke } = opts;
  const startedAt      = Date.now();
  let   currentCtx     = ctx;
  let   rerouteAttempts = 0;

  // Abort controller to cancel polling when handler completes
  const ac = new AbortController();

  // Run handler and polling concurrently
  const handlerPromise = handler(currentCtx).finally(() => ac.abort());

  const pollingLoop = (async () => {
    while (!ac.signal.aborted) {
      await new Promise(r => setTimeout(r, POLL_MS));
      if (ac.signal.aborted) break;
      if (rerouteAttempts >= REROUTE_LIMIT) break;

      try {
        const rawMetrics = getMetrics();
        const { evaluate, buildMetricsSnapshot, setCheckpointExists } =
          await import("../rerouting/dynamic-rerouter.ts");

        // Mark checkpoint if state has one
        if (state.checkpointId) {
          setCheckpointExists(ctx.runId, true);
        }

        const metrics = buildMetricsSnapshot({
          runId:                ctx.runId,
          projectId:            ctx.projectId,
          currentMode:          currentCtx.mode,
          currentPhase:         state.phase,
          elapsedMs:            Date.now() - startedAt,
          ...rawMetrics,
        });

        const result = await evaluate(metrics, currentCtx, state);

        if (result.rerouted && result.newMode) {
          rerouteAttempts++;
          currentCtx = result.updatedCtx;
          console.info(
            `[execution-reroute-hook] RE-ROUTING run=${ctx.runId} ` +
            `→ ${result.newMode} attempt=${rerouteAttempts}`,
          );
          // Cancel current handler and re-invoke with new mode
          ac.abort();
          await reInvoke(result.updatedCtx);
          return;
        }
      } catch (err) {
        // Rerouting is best-effort — never crash the main handler
        console.warn(`[execution-reroute-hook] Reroute evaluation error: ${(err as Error).message}`);
      }
    }
  })();

  // Wait for handler (polling auto-stops when handler finishes)
  await handlerPromise;
  // Drain the polling loop (it's already aborted)
  await pollingLoop.catch(() => { /* ignore abort errors */ });
}
