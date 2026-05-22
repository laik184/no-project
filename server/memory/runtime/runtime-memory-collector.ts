/**
 * runtime-memory-collector.ts
 *
 * Listens to the event bus and converts runtime events into memory entries.
 * Captures: crashes, port issues, startup times, preview stability, recovery.
 *
 * Single responsibility: bus → memory observation. No orchestration logic.
 */

import { bus }           from "../../infrastructure/events/bus.ts";
import { observe }       from "../pipeline/memory-pipeline.ts";
import { memoryTelemetry } from "../telemetry/memory-telemetry.ts";
import { classifyRuntimeEvent } from "../classifier/memory-classifier.ts";

// ── Event types the runtime emits ──────────────────────────────────────────────

interface RuntimeCrashEvent {
  runId?:       string;
  projectId?:   number;
  processName?: string;
  exitCode?:    number;
  signal?:      string;
  stderr?:      string;
}

interface RunLifecycleEvent {
  runId:     string;
  projectId: number;
  phase:     string;
  status?:   string;
  durationMs?: number;
  error?:    string;
}

interface AgentEvent {
  runId?:    string;
  projectId?: number;
  eventType: string;
  phase?:    string;
  payload?:  Record<string, unknown>;
  ts?:       number;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCrash(ev: RuntimeCrashEvent): string {
  const parts: string[] = [`Runtime crash`];
  if (ev.processName) parts.push(`process=${ev.processName}`);
  if (ev.exitCode !== undefined) parts.push(`exit=${ev.exitCode}`);
  if (ev.signal)     parts.push(`signal=${ev.signal}`);
  if (ev.stderr)     parts.push(`stderr=${ev.stderr.slice(0, 300)}`);
  return parts.join(" | ");
}

function formatLifecycle(ev: RunLifecycleEvent): string {
  return [
    `Run lifecycle: phase=${ev.phase} status=${ev.status ?? "unknown"}`,
    ev.durationMs ? `duration=${ev.durationMs}ms` : "",
    ev.error       ? `error=${ev.error.slice(0, 200)}` : "",
  ].filter(Boolean).join(" | ");
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCrash(ev: RuntimeCrashEvent): Promise<void> {
  const projectId = ev.projectId ?? 0;
  const content   = formatCrash(ev);
  const classification = classifyRuntimeEvent(content);

  try {
    await observe({
      content,
      projectId,
      runId:  ev.runId,
      hint:   { success: false, fromRuntime: true },
    });
  } catch (err) {
    memoryTelemetry.failed({
      operation: "runtime-crash-observe",
      projectId,
      reason:    (err as Error).message,
    });
  }
}

async function handleRecoverySuccess(ev: RunLifecycleEvent): Promise<void> {
  if (!ev.durationMs) return;

  const content = `Recovery succeeded: phase=${ev.phase} duration=${ev.durationMs}ms — runtime is stable after recovery`;
  try {
    await observe({
      content,
      projectId: ev.projectId,
      runId:     ev.runId,
      hint:      { success: true, fromRuntime: true },
    });
  } catch {
    // Non-fatal
  }
}

async function handleVerificationFail(runId: string, projectId: number, payload: Record<string, unknown>): Promise<void> {
  const errors = (payload?.errors as string[])?.slice(0, 5).join("; ") ?? "unknown errors";
  const content = `Verification failed: ${errors}`;
  try {
    await observe({
      content,
      projectId,
      runId,
      hint: { success: false },
    });
  } catch {
    // Non-fatal
  }
}

async function handlePreviewFail(runId: string, projectId: number, detail: string): Promise<void> {
  const content = `Preview failed: ${detail.slice(0, 300)}`;
  try {
    await observe({
      content,
      projectId,
      runId,
      hint: { success: false, fromRuntime: true },
    });
  } catch {
    // Non-fatal
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────────

let _initialized = false;

export function initRuntimeMemoryCollector(): void {
  if (_initialized) return;
  _initialized = true;

  // Process crash events
  bus.on("process.crashed" as any, (ev: RuntimeCrashEvent) => {
    handleCrash(ev).catch(() => {});
  });

  // Run lifecycle events
  bus.on("run.lifecycle" as any, (ev: RunLifecycleEvent) => {
    if (!ev.projectId) return;

    if (ev.status === "failed" || ev.phase === "failed") {
      const content = formatLifecycle(ev);
      observe({
        content,
        projectId: ev.projectId,
        runId:     ev.runId,
        hint:      { success: false },
      }).catch(() => {});
    }

    if (ev.phase === "recovery" && ev.status === "complete") {
      handleRecoverySuccess(ev).catch(() => {});
    }
  });

  // Agent events — verification failures, preview failures
  bus.on("agent.event" as any, (ev: AgentEvent) => {
    if (!ev.projectId || !ev.runId) return;
    const projectId = ev.projectId;
    const runId     = ev.runId;
    const payload   = ev.payload ?? {};

    switch (ev.eventType) {
      case "verification.failed":
        handleVerificationFail(runId, projectId, payload).catch(() => {});
        break;
      case "preview.failed":
        handlePreviewFail(runId, projectId, String(payload.error ?? "Preview failed")).catch(() => {});
        break;
      case "build.failed":
        observe({
          content:   `Build failed: ${String(payload.error ?? "unknown").slice(0, 300)}`,
          projectId,
          runId,
          hint:      { success: false },
        }).catch(() => {});
        break;
      case "hydration.failed":
        observe({
          content:   `Hydration failed: ${String(payload.error ?? "unknown").slice(0, 300)}`,
          projectId,
          runId,
          hint:      { success: false, fromRuntime: true },
        }).catch(() => {});
        break;
    }
  });

  console.log("[runtime-memory-collector] Initialized — wired to process.crashed, run.lifecycle, agent.event");
}
