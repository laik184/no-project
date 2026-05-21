/**
 * server/telemetry/telemetry-query.ts
 * Provides query and aggregation over collected telemetry events.
 * Single responsibility: event retrieval and summarization. No collection logic.
 */

import { getEvents }   from "./telemetry-collector.ts";
import type { TelemetryEvent, TelemetryQuery, TelemetrySummary } from "./types.ts";

export function queryEvents(query: TelemetryQuery): TelemetryEvent[] {
  const runId = query.runId;
  if (!runId) return [];

  let events = getEvents(runId);

  if (query.types?.length)    events = events.filter(e => query.types!.includes(e.type));
  if (query.severity)         events = events.filter(e => e.severity === query.severity);
  if (query.fromTs)           events = events.filter(e => e.ts >= query.fromTs!);
  if (query.toTs)             events = events.filter(e => e.ts <= query.toTs!);
  if (query.limit)            events = events.slice(-query.limit);

  return events;
}

export function summarizeRun(runId: string): TelemetrySummary {
  const events = getEvents(runId);

  const byType: Record<string, number>     = {};
  const bySeverity: Record<string, number> = {};

  for (const e of events) {
    byType[e.type]         = (byType[e.type] ?? 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
  }

  const completionPassed = events.find(e => e.type === "completion.passed")
    ? true
    : events.find(e => e.type === "completion.rejected")
    ? false
    : null;

  return {
    totalEvents:      events.length,
    byType,
    bySeverity,
    policyBlocks:     byType["policy.blocked"]   ?? 0,
    verifierFailures: byType["verifier.failed"]  ?? 0,
    sandboxBlocks:    byType["sandbox.blocked"]  ?? 0,
    retryCount:       byType["retry.triggered"]  ?? 0,
    completionPassed,
  };
}

export function getViolations(runId: string): TelemetryEvent[] {
  return queryEvents({
    runId,
    types: ["policy.blocked", "sandbox.blocked", "security.violation", "hallucination.detected"],
  });
}
