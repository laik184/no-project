/**
 * debug-session-builder.ts
 *
 * Build a rich DebugSession from a crash event.
 *
 * Steps:
 *   1. Collect recent log lines from logBuffer
 *   2. Extract structured errors via stack-trace-extractor
 *   3. Correlate errors to actionable hints via error-correlator
 *   4. Snapshot affected files via file-checkpoint
 *
 * Returns a fully populated DebugSession ready for goal-building.
 *
 * Ownership: autonomous-debug/core — single responsibility: session construction.
 * No LLM calls, no bus access.
 */

import { randomUUID }            from "crypto";
import { logBuffer }             from "../../runtime/observer/log-buffer.ts";
import { getProjectDir }         from "../../infrastructure/sandbox/sandbox.util.ts";
import { extractErrors, extractAffectedFiles } from "../analyzers/stack-trace-extractor.ts";
import { correlateErrors }       from "../analyzers/error-correlator.ts";
import { createCheckpoint }      from "../patchers/file-checkpoint.ts";
import { emitCheckpointCreated } from "../events/debug-event-emitter.ts";
import type { DebugSession }     from "../types/debug-types.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const LOG_TAIL_LINES = 100;

// ─── Builder ──────────────────────────────────────────────────────────────────

export async function buildDebugSession(
  projectId: number,
  errorType: string,
  existingLogLines?: string[],
): Promise<DebugSession> {
  const sessionId  = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const startedAt  = Date.now();

  // 1. Collect logs
  const buffered   = logBuffer.tail(projectId, LOG_TAIL_LINES);
  const logLines   = existingLogLines?.length
    ? existingLogLines
    : buffered.map(l => l.text);

  // 2. Extract structured errors
  const extractedErrors = extractErrors(logLines);

  // 3. Correlate to fix hints
  const correlations = correlateErrors(extractedErrors);

  // 4. Identify files to checkpoint
  const affectedFiles = extractAffectedFiles(extractedErrors);

  // 5. Create file checkpoint (non-blocking failure is acceptable)
  let checkpointCreated = false;
  if (affectedFiles.length > 0) {
    try {
      const sandboxRoot = getProjectDir(projectId);
      const cp = await createCheckpoint(projectId, sessionId, affectedFiles, sandboxRoot);
      checkpointCreated = cp !== null;
      if (checkpointCreated) {
        emitCheckpointCreated(projectId, sessionId, Object.keys(cp!.files).length);
      }
    } catch (err: any) {
      console.warn(`[debug-session-builder] Checkpoint failed: ${err.message}`);
    }
  }

  return {
    projectId,
    sessionId,
    startedAt,
    errorType,
    logSnapshot:      logLines.slice(-50),
    extractedErrors,
    correlations,
    checkpointCreated,
  };
}
