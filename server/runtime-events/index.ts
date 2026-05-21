/**
 * server/runtime-events/index.ts
 * Wires all system bus events to telemetry, graph, and SSE pipelines.
 * Single responsibility: event routing at startup. No business logic.
 */

import { wireTelemetryBus }  from "../telemetry/telemetry-collector.ts";
import { wireGraphBus }      from "../execution-graph/graph-builder.ts";

export function initRuntimeEvents(): void {
  wireTelemetryBus();
  wireGraphBus();
  console.log("[runtime-events] Telemetry and execution-graph bus wiring active.");
}
