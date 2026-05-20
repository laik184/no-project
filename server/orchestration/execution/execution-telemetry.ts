/**
 * execution-telemetry.ts
 *
 * Collects telemetry during execution phases.
 * Wires tool.execution bus events into orchestration metrics.
 */

import { bus }                from "../../infrastructure/events/bus.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import { recordSpanStart, recordSpanEnd }   from "../telemetry/orchestration-trace.ts";

// ── Active spans per tool execution ──────────────────────────────────────────

const _toolSpans = new Map<string, string>(); // executionId → spanId

// ── Setup bus wiring ──────────────────────────────────────────────────────────

let _initialized = false;

export function initExecutionTelemetry(): void {
  if (_initialized) return;
  _initialized = true;

  // Wire tool execution events into orchestration telemetry
  bus.subscribe("tool.execution", (e) => {
    const tags = {
      tool:     e.toolName,
      category: e.toolCategory ?? "unknown",
      runId:    e.runId,
    };

    if (e.phase === "start") {
      const spanId = recordSpanStart(e.runId, `tool.${e.toolName}`, {
        tool:      e.toolName,
        projectId: String(e.projectId ?? 0),
        step:      String(e.stepIndex ?? 0),
      });
      _toolSpans.set(e.executionId, spanId);
      incrementCounter("tool.executions.started", tags);

    } else if (e.phase === "success") {
      const spanId = _toolSpans.get(e.executionId);
      if (spanId) {
        recordSpanEnd(spanId, "ok");
        _toolSpans.delete(e.executionId);
      }
      incrementCounter("tool.executions.succeeded", tags);
      if (e.durationMs) recordDuration("tool.execution.duration", e.durationMs, tags);

    } else if (e.phase === "error") {
      const spanId = _toolSpans.get(e.executionId);
      if (spanId) {
        recordSpanEnd(spanId, e.timedOut ? "timeout" : "error");
        _toolSpans.delete(e.executionId);
      }
      incrementCounter("tool.executions.failed", tags);
      incrementCounter(
        e.timedOut ? "tool.executions.timedout" : "tool.executions.errored",
        tags,
      );
    }
  });

  // Wire run lifecycle into orchestration counters
  bus.subscribe("run.lifecycle", (e) => {
    incrementCounter(`run.lifecycle.${e.status}`, { projectId: String(e.projectId) });
  });

  // Wire runtime crashes into recovery counters
  bus.subscribe("agent.event", (e) => {
    if (e.phase === "runtime" && e.eventType === "process.crashed") {
      incrementCounter("runtime.crashes", { projectId: String(e.projectId ?? 0) });
    }
    if (e.phase === "orchestration" && e.eventType === "orchestration.error") {
      incrementCounter("orchestration.errors", { projectId: String(e.projectId ?? 0) });
    }
  });

  // Wire checkpoint events
  bus.subscribe("checkpoint.event", (e) => {
    if (e.eventType.includes("created") || e.eventType.includes("synced")) {
      incrementCounter("checkpoints.created", { projectId: String(e.projectId) });
    }
    if (e.eventType.includes("restored")) {
      incrementCounter("checkpoints.restored", { projectId: String(e.projectId) });
    }
  });

  console.log("[execution-telemetry] Bus wiring active — collecting orchestration telemetry.");
}

// ── Status ─────────────────────────────────────────────────────────────────────

export function telemetryStatus(): { initialized: boolean; activeToolSpans: number } {
  return { initialized: _initialized, activeToolSpans: _toolSpans.size };
}
