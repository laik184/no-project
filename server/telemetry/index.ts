/**
 * server/telemetry/index.ts
 * Public API surface for the telemetry system.
 */

export { record, getEvents, clearEvents, wireTelemetryBus } from "./telemetry-collector.ts";
export { queryEvents, summarizeRun, getViolations }         from "./telemetry-query.ts";
export type { TelemetryEvent, TelemetryQuery, TelemetrySummary, TelemetryEventType } from "./types.ts";
