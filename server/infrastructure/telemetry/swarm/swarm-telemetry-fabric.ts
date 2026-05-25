/**
 * swarm-telemetry-fabric.ts
 *
 * Unified telemetry facade for the Full Quantum Swarm Routing System.
 * Single responsibility: canonical event emission only.
 *
 * Every swarm component emits through this fabric — never directly to bus.
 * Provides correlation IDs linking route→dispatch→merge→verification spans.
 *
 * Canonical events emitted (17 total — all defined in swarm-event-map.ts):
 *   swarm.route.start/complete, DAG.node.start/complete,
 *   specialist.dispatch/complete/failed, lock.acquire/release,
 *   merge.start/complete, verification.start/complete,
 *   orchestration.abort, runtime.crashed, recovery.start/complete
 *
 * Usage:
 *   import { swarmTelemetryFabric as swarmTelemetry } from "...";
 *   swarmTelemetry.routeStart(runId, projectId, { ... });
 */

import { bus } from "../../events/bus.ts";
import { SWARM_EVENTS } from "./swarm-event-map.ts";
import type {
  RouteStartPayload, RouteCompletePayload,
  DagNodeStartPayload, DagNodeCompletePayload,
  SpecialistDispatchPayload, SpecialistCompletePayload, SpecialistFailedPayload,
  LockAcquirePayload, LockReleasePayload,
  MergeStartPayload, MergeCompletePayload,
  VerificationStartPayload, VerificationCompletePayload,
  OrchestrationAbortPayload, RuntimeCrashedPayload,
  RecoveryStartPayload, RecoveryCompletePayload,
} from "./swarm-event-map.ts";

// ── Correlation registry ───────────────────────────────────────────────────────

const _correlations = new Map<string, string>();

function correlationId(runId: string): string {
  if (!_correlations.has(runId)) {
    _correlations.set(runId, `corr-${runId}-${Date.now()}`);
  }
  return _correlations.get(runId)!;
}

// ── Emit helper ───────────────────────────────────────────────────────────────

function emit(
  eventType: string,
  runId:     string,
  projectId: number,
  phase:     string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase,
    agentName:     "swarm-telemetry-fabric",
    eventType,
    payload:       { ...payload, correlationId: correlationId(runId) },
    ts:            Date.now(),
  });
}

// ── SwarmTelemetryFabric ───────────────────────────────────────────────────────

class SwarmTelemetryFabric {

  routeStart(runId: string, projectId: number, p: RouteStartPayload): void {
    emit(SWARM_EVENTS.ROUTE_START, runId, projectId, "swarm.routing", p as unknown as Record<string, unknown>);
  }

  routeComplete(runId: string, projectId: number, p: RouteCompletePayload): void {
    emit(SWARM_EVENTS.ROUTE_COMPLETE, runId, projectId, "swarm.routing", p as unknown as Record<string, unknown>);
    if (p.success) _correlations.delete(runId);
  }

  dagNodeStart(runId: string, projectId: number, p: DagNodeStartPayload): void {
    emit(SWARM_EVENTS.DAG_NODE_START, runId, projectId, "dag.execution", p as unknown as Record<string, unknown>);
  }

  dagNodeComplete(runId: string, projectId: number, p: DagNodeCompletePayload): void {
    emit(SWARM_EVENTS.DAG_NODE_COMPLETE, runId, projectId, "dag.execution", p as unknown as Record<string, unknown>);
  }

  specialistDispatch(runId: string, projectId: number, p: SpecialistDispatchPayload): void {
    emit(SWARM_EVENTS.SPECIALIST_DISPATCH, runId, projectId, "swarm.dispatch", p as unknown as Record<string, unknown>);
  }

  specialistComplete(runId: string, projectId: number, p: SpecialistCompletePayload): void {
    emit(SWARM_EVENTS.SPECIALIST_COMPLETE, runId, projectId, "swarm.dispatch", p as unknown as Record<string, unknown>);
  }

  specialistFailed(runId: string, projectId: number, p: SpecialistFailedPayload): void {
    emit(SWARM_EVENTS.SPECIALIST_FAILED, runId, projectId, "swarm.dispatch", p as unknown as Record<string, unknown>);
  }

  lockAcquire(runId: string, projectId: number, p: LockAcquirePayload): void {
    emit(SWARM_EVENTS.LOCK_ACQUIRE, runId, projectId, "swarm.locking", p as unknown as Record<string, unknown>);
  }

  lockRelease(runId: string, projectId: number, p: LockReleasePayload): void {
    emit(SWARM_EVENTS.LOCK_RELEASE, runId, projectId, "swarm.locking", p as unknown as Record<string, unknown>);
  }

  mergeStart(runId: string, projectId: number, p: MergeStartPayload): void {
    emit(SWARM_EVENTS.MERGE_START, runId, projectId, "swarm.merge", p as unknown as Record<string, unknown>);
  }

  mergeComplete(runId: string, projectId: number, p: MergeCompletePayload): void {
    emit(SWARM_EVENTS.MERGE_COMPLETE, runId, projectId, "swarm.merge", p as unknown as Record<string, unknown>);
  }

  verificationStart(runId: string, projectId: number, p: VerificationStartPayload): void {
    emit(SWARM_EVENTS.VERIFICATION_START, runId, projectId, "swarm.verification", p as unknown as Record<string, unknown>);
  }

  verificationComplete(runId: string, projectId: number, p: VerificationCompletePayload): void {
    emit(SWARM_EVENTS.VERIFICATION_COMPLETE, runId, projectId, "swarm.verification", p as unknown as Record<string, unknown>);
  }

  orchestrationAbort(runId: string, projectId: number, p: OrchestrationAbortPayload): void {
    emit(SWARM_EVENTS.ORCHESTRATION_ABORT, runId, projectId, "orchestration", p as unknown as Record<string, unknown>);
    _correlations.delete(runId);
  }

  runtimeCrashed(runId: string, projectId: number, p: RuntimeCrashedPayload): void {
    emit(SWARM_EVENTS.RUNTIME_CRASHED, runId, projectId, "runtime", p as unknown as Record<string, unknown>);
  }

  recoveryStart(runId: string, projectId: number, p: RecoveryStartPayload): void {
    emit(SWARM_EVENTS.RECOVERY_START, runId, projectId, "recovery", p as unknown as Record<string, unknown>);
  }

  recoveryComplete(runId: string, projectId: number, p: RecoveryCompletePayload): void {
    emit(SWARM_EVENTS.RECOVERY_COMPLETE, runId, projectId, "recovery", p as unknown as Record<string, unknown>);
  }

  /** Release correlation state for a completed run. */
  clearRun(runId: string): void {
    _correlations.delete(runId);
  }
}

export const swarmTelemetryFabric = new SwarmTelemetryFabric();
