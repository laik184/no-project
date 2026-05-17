/**
 * restore/restore-run.service.ts
 * Restore an entire agent run — rolls back all file changes made during that run.
 * Finds the pre-run checkpoint and restores to it.
 */

import { getProjectDir }          from "../../sandbox/sandbox.util.ts";
import { checkpointStore }        from "../checkpoint.service.ts";
import { rollbackToCheckpoint }   from "../rollback.service.ts";
import type { RollbackResult }    from "../checkpoint.types.ts";

export interface RestoreRunResult {
  success:      boolean;
  runId:        string;
  projectId:    number;
  checkpointId: string | null;
  rollback:     RollbackResult | null;
  error?:       string;
}

/**
 * Restore a project to the state just before `runId` started.
 * Looks for the most recent "run_start" checkpoint for that run.
 */
export async function restoreRun(
  runId:     string,
  projectId: number,
): Promise<RestoreRunResult> {
  const sandboxRoot = getProjectDir(projectId);
  const all         = await checkpointStore.listForProject(projectId);

  // Find the pre-run checkpoint (trigger = run_start, matching runId)
  const candidates = all.filter(
    (m) => m.runId === runId && m.trigger === "run_start" && m.status === "stable",
  );

  if (candidates.length === 0) {
    return {
      success:      false,
      runId,
      projectId,
      checkpointId: null,
      rollback:     null,
      error:        `No stable run_start checkpoint found for run ${runId}`,
    };
  }

  // Take the earliest one (start of run)
  const checkpoint = candidates.sort((a, b) => a.createdAt - b.createdAt)[0];

  const rollback = await rollbackToCheckpoint({
    checkpointId: checkpoint.checkpointId,
    projectId,
    sandboxRoot,
    scope: "full_run",
  });

  return {
    success:      rollback.success,
    runId,
    projectId,
    checkpointId: checkpoint.checkpointId,
    rollback,
    error:        rollback.error,
  };
}

/**
 * List all runs that have restorable checkpoints for a project.
 */
export async function listRestorableRuns(
  projectId: number,
): Promise<Array<{ runId: string; checkpointId: string; createdAt: number }>> {
  const all    = await checkpointStore.listForProject(projectId);
  const stable = all.filter((m) => m.trigger === "run_start" && m.status === "stable" && m.runId);

  const seen  = new Set<string>();
  const items: Array<{ runId: string; checkpointId: string; createdAt: number }> = [];
  for (const m of stable.sort((a, b) => b.createdAt - a.createdAt)) {
    if (m.runId && !seen.has(m.runId)) {
      seen.add(m.runId);
      items.push({ runId: m.runId!, checkpointId: m.checkpointId, createdAt: m.createdAt });
    }
  }
  return items;
}
