/**
 * server/orchestration/index.ts
 *
 * Public surface of the orchestration layer.
 * All external consumers import from here — never from deep sub-paths.
 *
 * Boot sequence:
 *   1. initOrchestration() — called once from main.ts after runtimeStore.init()
 *   2. createOrchestrationRouter() — mounts API at /api/orchestration
 *
 * server/orchestration/ IS THE BOSS — all orchestrators are registered here.
 */

// ── Core ──────────────────────────────────────────────────────────────────────
export { executeOrchestration, getEngineVersion } from "./core/orchestration-engine.ts";
export type { EngineInput, EngineResult }         from "./core/orchestration-engine.ts";
export { createContext, getContext, requireContext, clearContext } from "./core/orchestration-context.ts";
export { createState, getState, transitionPhase, markStatus }     from "./core/orchestration-state.ts";
export { captureCheckpoint, getLatestCheckpoint, buildReplayPlan } from "./core/orchestration-replay.ts";
export * from "./core/orchestration-types.ts";

// ── Master Registry & Hub ─────────────────────────────────────────────────────
export {
  orchestratorHub,
  OrchestratorHub,
  MASTER_REGISTRY,
  WORKER_REGISTRY,
  PHASE_REGISTRY,
  PLATFORM_REGISTRY,
  SERVICE_REGISTRY,
  MASTER_FORBIDDEN_IDS,
  masterFindById,
  masterFindByCapability,
  masterFindByDomain,
  getMasterStats,
  assertMasterIntegrity,
  findWorkerByCapability,
  findWorkerById,
  findWorkerByDomain,
  getWorkerStats,
} from "./registry/index.ts";

export type {
  OrchestratorEntry,
  OrchestratorDomain,
  HubInvokeResult,
  HubStatus,
  HubListEntry,
} from "./registry/index.ts";

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
import { orchestratorHub }           from "./registry/index.ts";
import { distributedOrchestrationWiring } from "../distributed/orchestration/distributed-orchestration-wiring.ts";
import { initDistributedSystem }     from "../distributed/index.ts";
import { initDagExecutors }          from "../engine/execution/dag-executor-wiring.ts";

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

  // Boot the master orchestrator hub — registers ALL orchestrators system-wide
  orchestratorHub.init();

  // Wire DAG node executors — CRITICAL: resolves dag.agent.execute +
  // dag.verify.execute bus events with real runAgentLoop() / verificationBridge calls.
  // Without this, every planned/DAG-mode run times out with fake success.
  initDagExecutors();

  // Boot distributed system first, then wire it into the orchestration layer (non-blocking).
  // Correct order: init subsystems → connect them to orchestration.
  initDistributedSystem()
    .then(() => distributedOrchestrationWiring.wire())
    .then(report => {
      console.log(
        `[orchestration] Distributed wiring complete — ${report.wired.length} systems` +
        ` (readiness=${report.readinessPct}% backend=${report.backend})`,
      );
    })
    .catch(err => {
      console.warn("[orchestration] Distributed boot/wiring failed (non-fatal):", (err as Error).message);
    });

  console.log(`[orchestration] Initialized — ${getEngineVersion()}`);
  console.log("[orchestration] Systems wired: telemetry ✓ runtime-sync ✓ lifecycle ✓ preview ✓ recovery ✓ master-hub ✓ distributed ✓ dag-executors ✓");

  const status = orchestratorHub.status();
  console.log(
    `[orchestration] Master Hub — ${status.totalRegistered} orchestrators registered` +
    ` (workers=${status.workers} phase=${status.phaseOrchestrators}` +
    ` platform=${status.platformServices} services=${status.serviceOrchestrators})`,
  );
}
