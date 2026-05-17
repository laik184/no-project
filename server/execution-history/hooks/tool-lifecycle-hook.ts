/**
 * server/execution-history/hooks/tool-lifecycle-hook.ts
 *
 * Bus subscriber that bridges tool.execution events to the persistence layer.
 *
 * Design:
 *  - Listens to the dedicated "tool.execution" bus channel (not agent.event)
 *  - Opens a DB record on phase=start, closes it on phase=success|error
 *  - Maintains an in-memory Map<executionId, true> to avoid duplicate opens
 *  - All DB writes are fire-and-forget with error logging (never throws)
 *  - Idempotent: safe to call attachToolExecutionHook() multiple times
 */

import { bus } from "../../infrastructure/events/bus.ts";
import { openExecution, closeExecution } from "../core/execution-recorder.ts";

let attached = false;

// Lightweight guard against duplicate open calls for the same executionId
const openSet = new Set<string>();

export function attachToolExecutionHook(): void {
  if (attached) return;
  attached = true;

  bus.on("tool.execution", (evt) => {
    if (evt.phase === "start") {
      if (openSet.has(evt.executionId)) return;
      openSet.add(evt.executionId);

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
      openSet.delete(evt.executionId);

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
  });
}

/** Remove all tracked open executions (call on server shutdown). */
export function detachToolExecutionHook(): void {
  openSet.clear();
}
