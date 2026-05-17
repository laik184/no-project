/**
 * server/execution-history/timeline/timeline-builder.ts
 *
 * Builds a human-readable, ordered execution timeline from DB records.
 * Decoupled from both DB reads and API routing.
 */

import type { ToolExecution } from "../schema/tool-executions.schema.ts";

export interface TimelineStep {
  index:       number;
  executionId: string;
  toolName:    string;
  status:      string;
  durationMs:  number | null;
  startedAt:   string;
  endedAt:     string | null;
  error:       string | null;
  retryCount:  number;
  hasResult:   boolean;
}

export interface ExecutionTimeline {
  runId:        string;
  totalSteps:   number;
  totalDurationMs: number;
  successCount: number;
  errorCount:   number;
  steps:        TimelineStep[];
  startedAt:    string | null;
  endedAt:      string | null;
}

/**
 * Convert an ordered list of ToolExecution rows into a structured timeline.
 */
export function buildTimeline(
  runId: string,
  rows: ToolExecution[],
): ExecutionTimeline {
  const steps: TimelineStep[] = rows.map((row, i) => ({
    index:       row.stepIndex ?? i,
    executionId: row.executionId,
    toolName:    row.toolName,
    status:      row.status,
    durationMs:  row.durationMs,
    startedAt:   row.startedAt.toISOString(),
    endedAt:     row.endedAt?.toISOString() ?? null,
    error:       row.errorText ?? null,
    retryCount:  row.retryCount,
    hasResult:   row.resultJson !== null,
  }));

  const totalDurationMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const successCount    = steps.filter((s) => s.status === "success").length;
  const errorCount      = steps.filter((s) => s.status === "error" || s.status === "timeout").length;

  const startedAt = steps.length > 0 ? steps[0].startedAt : null;
  const endedAt   = steps.length > 0 ? steps[steps.length - 1].endedAt : null;

  return {
    runId,
    totalSteps:      steps.length,
    totalDurationMs,
    successCount,
    errorCount,
    steps,
    startedAt,
    endedAt,
  };
}

/**
 * Build a compact summary string for logging / LLM injection.
 */
export function formatTimelineSummary(timeline: ExecutionTimeline): string {
  const lines: string[] = [
    `Run ${timeline.runId}: ${timeline.totalSteps} steps, ${timeline.successCount} ok, ${timeline.errorCount} errors, ${timeline.totalDurationMs}ms total`,
  ];
  for (const step of timeline.steps) {
    const icon   = step.status === "success" ? "✓" : step.status === "running" ? "⋯" : "✗";
    const dur    = step.durationMs != null ? `${step.durationMs}ms` : "—";
    const retry  = step.retryCount > 0 ? ` [retry×${step.retryCount}]` : "";
    lines.push(`  ${icon} [${step.index}] ${step.toolName}  ${dur}${retry}${step.error ? `  ERR: ${step.error.slice(0, 80)}` : ""}`);
  }
  return lines.join("\n");
}
