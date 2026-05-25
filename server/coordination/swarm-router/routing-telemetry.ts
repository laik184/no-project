/**
 * routing-telemetry.ts
 *
 * Telemetry helpers scoped to the DynamicSwarmRouter.
 * Single responsibility: routing-layer event emission only.
 *
 * Delegates all emission to swarmTelemetryFabric — never touches bus directly.
 */

import { swarmTelemetryFabric } from "../../infrastructure/telemetry/swarm/swarm-telemetry-fabric.ts";
import type { SpecialistDomain } from "../contracts/specialist.contracts.ts";

// ── Routing phase telemetry ───────────────────────────────────────────────────

export function emitRouteStart(
  runId:      string,
  projectId:  number,
  domains:    SpecialistDomain[],
  nodeCount:  number,
  waves:      number,
  strategy:   string,
): void {
  swarmTelemetryFabric.routeStart(runId, projectId, {
    strategy,
    domainCount: domains.length,
    nodeCount,
    waves,
  });
}

export function emitRouteComplete(
  runId:      string,
  projectId:  number,
  strategy:   string,
  success:    boolean,
  durationMs: number,
  patchCount: number,
): void {
  swarmTelemetryFabric.routeComplete(runId, projectId, {
    strategy,
    success,
    durationMs,
    patchCount,
  });
}

// ── Dispatch phase telemetry ──────────────────────────────────────────────────

export function emitDispatch(
  runId:     string,
  projectId: number,
  taskId:    string,
  domain:    SpecialistDomain,
  priority:  string,
  goal:      string,
): void {
  swarmTelemetryFabric.specialistDispatch(runId, projectId, {
    taskId,
    domain,
    priority,
    goal: goal.slice(0, 120),
  });
}

export function emitDispatchComplete(
  runId:      string,
  projectId:  number,
  taskId:     string,
  domain:     SpecialistDomain,
  success:    boolean,
  patches:    number,
  durationMs: number,
): void {
  swarmTelemetryFabric.specialistComplete(runId, projectId, {
    taskId,
    domain,
    success,
    patches,
    durationMs,
  });
}

export function emitDispatchFailed(
  runId:     string,
  projectId: number,
  taskId:    string,
  domain:    SpecialistDomain,
  error:     string,
  retryable: boolean,
): void {
  swarmTelemetryFabric.specialistFailed(runId, projectId, {
    taskId,
    domain,
    error,
    retryable,
  });
}

// ── Abort telemetry ───────────────────────────────────────────────────────────

export function emitRoutingAbort(
  runId:     string,
  projectId: number,
  reason:    string,
  phase:     string,
): void {
  swarmTelemetryFabric.orchestrationAbort(runId, projectId, {
    reason,
    phase,
    runId,
  });
}
