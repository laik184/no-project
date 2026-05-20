/**
 * execution-checkpoints.ts
 *
 * Bridges orchestration checkpoints with the infrastructure checkpoint system.
 * Ensures orchestration phase snapshots are persisted alongside file checkpoints.
 */

import { captureCheckpoint, listCheckpoints } from "../core/orchestration-replay.ts";
import { emitOrchestrationCheckpoint }        from "../core/orchestration-events.ts";
import { bus }                                from "../../infrastructure/events/bus.ts";
import type { OrchestrationPhase }            from "../core/orchestration-types.ts";

// Lazy-import checkpoint service to avoid startup ordering issues
async function getCheckpointStore() {
  const m = await import("../../infrastructure/checkpoints/checkpoint.service.ts");
  return m.checkpointStore;
}

// ── Create a synchronized checkpoint ─────────────────────────────────────────

export async function createSyncedCheckpoint(opts: {
  runId:     string;
  projectId: number;
  phase:     OrchestrationPhase;
  trigger?:  string;
}): Promise<string | null> {
  const { runId, projectId, phase, trigger } = opts;

  try {
    // 1. Capture orchestration-layer checkpoint (in-memory)
    const orchCp = captureCheckpoint(runId, projectId, phase);
    if (!orchCp) return null;

    // 2. Trigger infrastructure-level file checkpoint (best-effort)
    let gitSha: string | undefined;
    try {
      const store  = await getCheckpointStore();
      const fileCp = await store.create({
        projectId,
        runId,
        trigger: trigger ?? `phase:${phase}`,
      });
      gitSha = fileCp?.gitCommitSha ?? undefined;
    } catch (cpErr) {
      console.warn(`[execution-checkpoints] Infrastructure checkpoint skipped: ${cpErr}`);
    }

    // 3. Emit unified event
    emitOrchestrationCheckpoint({ runId, projectId, checkpointId: orchCp.checkpointId, phase });

    bus.emit("checkpoint.event", {
      eventType:    "execution.checkpoint.synced",
      checkpointId: orchCp.checkpointId,
      projectId,
      runId,
      trigger:      trigger ?? `phase:${phase}`,
      gitSha,
      success:      true,
      ts:           Date.now(),
    });

    console.log(`[execution-checkpoints] Synced checkpoint ${orchCp.checkpointId} at phase=${phase}`);
    return orchCp.checkpointId;

  } catch (err) {
    console.error(`[execution-checkpoints] Failed to create synced checkpoint: ${err}`);
    bus.emit("checkpoint.event", {
      eventType: "execution.checkpoint.failed",
      projectId,
      runId,
      error:     String(err),
      reason:    `phase:${phase}`,
      success:   false,
      ts:        Date.now(),
    });
    return null;
  }
}

// ── List orchestration checkpoints for a run ──────────────────────────────────

export function getRunCheckpoints(runId: string) {
  return listCheckpoints(runId);
}

// ── Checkpoint health ─────────────────────────────────────────────────────────

export async function getCheckpointHealth(projectId: number): Promise<{
  total:      number;
  replayable: number;
}> {
  try {
    const store = await getCheckpointStore();
    // checkpointStore.listForProject(projectId)
    const all   = await store.listForProject(projectId);
    return { total: all.length, replayable: all.length };
  } catch {
    return { total: 0, replayable: 0 };
  }
}
