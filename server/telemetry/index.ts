/**
 * server/telemetry/index.ts
 *
 * Run-level telemetry — collects and summarizes events per agent run.
 * Exposes summarizeRun() and getViolations() used by the API layer.
 */

export interface TelemetryEvent {
  runId:     string;
  type:      string;
  payload:   unknown;
  ts:        number;
}

export interface TelemetryViolation {
  runId:     string;
  rule:      string;
  severity:  'critical' | 'high' | 'medium' | 'low';
  message:   string;
  ts:        number;
}

export interface RunSummary {
  runId:       string;
  eventCount:  number;
  firstEvent?: number;
  lastEvent?:  number;
  types:       Record<string, number>;
  violations:  number;
}

const events     = new Map<string, TelemetryEvent[]>();
const violations = new Map<string, TelemetryViolation[]>();

const MAX_EVENTS_PER_RUN = 5_000;

export function recordEvent(event: TelemetryEvent): void {
  if (!events.has(event.runId)) events.set(event.runId, []);
  const list = events.get(event.runId)!;
  if (list.length >= MAX_EVENTS_PER_RUN) list.shift();
  list.push(event);
}

export function recordViolation(violation: TelemetryViolation): void {
  if (!violations.has(violation.runId)) violations.set(violation.runId, []);
  violations.get(violation.runId)!.push(violation);
}

export function summarizeRun(runId: string): RunSummary {
  const runEvents = events.get(runId) ?? [];
  const types: Record<string, number> = {};
  for (const e of runEvents) {
    types[e.type] = (types[e.type] ?? 0) + 1;
  }
  return {
    runId,
    eventCount: runEvents.length,
    firstEvent: runEvents[0]?.ts,
    lastEvent:  runEvents[runEvents.length - 1]?.ts,
    types,
    violations: (violations.get(runId) ?? []).length,
  };
}

export function getViolations(runId: string): TelemetryViolation[] {
  return [...(violations.get(runId) ?? [])];
}

export function clearRun(runId: string): void {
  events.delete(runId);
  violations.delete(runId);
}
