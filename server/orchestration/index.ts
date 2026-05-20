/**
 * server/orchestration/index.ts
 *
 * Public surface of the orchestration layer.
 * All external consumers import from here — never from deep sub-paths.
 *
 * Boot sequence:
 *   1. initOrchestration() — called once from main.ts after runtimeStore.init()
 *   2. createOrchestrationRouter() — mounts API at /api/orchestration
 */

// ── Core ──────────────────────────────────────────────────────────────────────
export { executeOrchestration, getEngineVersion } from "./core/orchestration-engine.ts";
export type { EngineInput, EngineResult }         from "./core/orchestration-engine.ts";
export { createContext, getContext, requireContext, clearContext } from "./core/orchestration-context.ts";
export { createState, getState, transitionPhase, markStatus }     from "./core/orchestration-state.ts";
export { captureCheckpoint, getLatestCheckpoint, buildReplayPlan } from "./core/orchestration-replay.ts";
export * from "./core/orchestration-types.ts";

// ── Bridges ───────────────────────────────────────────────────────────────────
export { supervisorBridge }   from "./agents/supervisor-bridge.ts";
export { plannerBridge }      from "./agents/planner-bridge.ts";
export { builderBridge }      from "./agents/builder-bridge.ts";
export { verificationBridge } from "./agents/verification-bridge.ts";
export { recoveryBridge }     from "./agents/recovery-bridge.ts";
export { memoryBridge }       from "./agents/memory-bridge.ts";

// ── Runtime Orchestrators ─────────────────────────────────────────────────────
export { runtimeOrchestrator }       from "./runtime/runtime-orchestrator.ts";
export { previewOrchestrator }       from "./runtime/preview-orchestrator.ts";
export { verificationOrchestrator }  from "./runtime/verification-orchestrator.ts";
export { recoveryOrchestrator }      from "./runtime/recovery-orchestrator.ts";

// ── Telemetry ─────────────────────────────────────────────────────────────────
export { createOrchLogger, orchLog, queryLogs } from "./telemetry/orchestration-logs.ts";
export { recordSpanStart, recordSpanEnd, getRunTrace, summarizeTrace } from "./telemetry/orchestration-trace.ts";
export { incrementCounter, recordDuration, snapshotMetrics, orchestrationHealthSummary } from "./telemetry/orchestration-metrics.ts";
export { captureDebugSnapshot, buildRunTimeline, orchestrationHealthCheck } from "./telemetry/orchestration-debug.ts";

// ── Execution ─────────────────────────────────────────────────────────────────
export { startLifecycleTracking } from "./execution/lifecycle-manager.ts";
export { initExecutionTelemetry } from "./execution/execution-telemetry.ts";
export { initRuntimeSync }        from "./execution/runtime-sync.ts";

// ── API ───────────────────────────────────────────────────────────────────────
export { createOrchestrationRouter } from "./orchestration.routes.ts";

// ── Boot ──────────────────────────────────────────────────────────────────────

import { startLifecycleTracking }    from "./execution/lifecycle-manager.ts";
import { initExecutionTelemetry }    from "./execution/execution-telemetry.ts";
import { initRuntimeSync }           from "./execution/runtime-sync.ts";
import { previewOrchestrator }       from "./runtime/preview-orchestrator.ts";
import { recoveryOrchestrator }      from "./runtime/recovery-orchestrator.ts";
import { getEngineVersion }          from "./core/orchestration-engine.ts";

export function initOrchestration(): void {
  // Wire telemetry to the event bus
  initExecutionTelemetry();

  // Wire runtime state sync
  initRuntimeSync();

  // Start phase lifecycle tracking
  startLifecycleTracking();

  // Start preview lifecycle integration
  previewOrchestrator.init();

  // Start auto-recovery integration
  recoveryOrchestrator.init();

  console.log(`[orchestration] Initialized — ${getEngineVersion()}`);
  console.log("[orchestration] Systems wired: telemetry ✓ runtime-sync ✓ lifecycle ✓ preview ✓ recovery ✓");
}
