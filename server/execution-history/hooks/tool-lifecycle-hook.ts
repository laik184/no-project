/**
 * server/execution-history/hooks/tool-lifecycle-hook.ts
 *
 * Bus subscriber that bridges tool.execution events to the persistence layer.
 *
 * Design:
 *  - Listens to the dedicated "tool.execution" bus channel (not agent.event)
 *  - Opens a DB record on phase=start, closes it on phase=success|error
 *  - Maintains an in-memory Map<executionId, openedAt> to track open calls
 *  - All DB writes are fire-and-forget with error logging (never throws)
 *  - Idempotent: safe to call attachToolExecutionHook() multiple times
 *
 * L5 fix: store the handler reference so detachToolExecutionHook() can call
 *   bus.off() and actually remove the listener (previously only cleared openSet).
 * L6 fix: openSet replaced with a TTL Map — entries older than OPEN_TTL_MS are
 *   pruned every TTL period, preventing unbounded growth when tools crash before
 *   emitting a success/error phase.
 */

import { bus, type ToolExecutionEvent } from "../../infrastructure/events/bus.ts";
import { openExecution, closeExecution } from "../core/execution-recorder.ts";

const OPEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Map: executionId → timestamp when "start" was received
const openMap = new Map<string, number>();

// Prune stale entries once per TTL window
const pruneTimer = setInterval(() => {
  const cutoff = Date.now() - OPEN_TTL_MS;
  for (const [id, ts] of openMap) {
    if (ts < cutoff) openMap.delete(id);
  }
}, OPEN_TTL_MS);
pruneTimer.unref(); // don't prevent process exit

let attached = false;
let attachedHandler: ((evt: ToolExecutionEvent) => void) | null = null;

export function attachToolExecutionHook(): void {
  if (attached) return;
  attached = true;

  attachedHandler = (evt: ToolExecutionEvent) => {
    if (evt.phase === "start") {
      if (openMap.has(evt.executionId)) return;
      openMap.set(evt.executionId, Date.now());

      void openExecution({
        executionId:  evt.executionId,
        runId:        evt.runId,
        projectId:    evt.projectId,
        stepIndex:    evt.stepIndex,
        toolName:     evt.toolName,
        toolCategory: evt.toolCategory,
        args:         evt.args,
        replaySafe:   evt.replaySafe,
      }).catch((err: unknown) => {
        console.error("[exec-history] Failed to open execution:", evt.executionId, err);
      });
      return;
    }

    if (evt.phase === "success" || evt.phase === "error") {
      openMap.delete(evt.executionId);

      void closeExecution({
        executionId: evt.executionId,
        status:      evt.phase === "success" ? "success" : (evt.timedOut ? "timeout" : "error"),
        result:      evt.result,
        error:       evt.error,
        durationMs:  evt.durationMs ?? 0,
      }).catch((err: unknown) => {
        console.error("[exec-history] Failed to close execution:", evt.executionId, err);
      });
    }
  };

  bus.on("tool.execution", attachedHandler);
}

/** Remove the bus listener and clear all tracked open executions. */
export function detachToolExecutionHook(): void {
  openMap.clear();
  if (attachedHandler) {
    bus.off("tool.execution", attachedHandler);
    attachedHandler = null;
    attached = false;
  }
}
