import { fileWriter } from '../filesystem/file-writer.ts';
import { fileReader } from '../filesystem/file-reader.ts';
import { checkpointManager } from './checkpoint-manager.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';

export interface RollbackResult {
  ok:           boolean;
  filesRestored: number;
  error?:        string;
}

export const rollbackManager = {
  async rollbackToCheckpoint(
    runId:        string,
    projectId:    string,
    checkpointId: string,
  ): Promise<RollbackResult> {
    const ckpt = checkpointManager.get(checkpointId);
    if (!ckpt) {
      return { ok: false, filesRestored: 0, error: `Checkpoint ${checkpointId} not found` };
    }

    executorLogger.info(runId, `Rolling back to checkpoint ${checkpointId}`, {
      files: ckpt.filesSnapshot.length,
    });

    let filesRestored = 0;
    const errors: string[] = [];

    for (const { path: filePath, content } of ckpt.filesSnapshot) {
      try {
        await fileWriter.write(projectId, filePath, content);
        filesRestored++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${filePath}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      executorLogger.warn(runId, `Rollback partial — ${errors.length} file(s) failed`);
    } else {
      executorLogger.info(runId, `Rollback complete — ${filesRestored} file(s) restored`);
    }

    return {
      ok:           errors.length === 0,
      filesRestored,
      error:        errors.length > 0 ? errors.join('; ') : undefined,
    };
  },

  async rollbackFile(
    runId:        string,
    projectId:    string,
    checkpointId: string,
    filePath:     string,
  ): Promise<boolean> {
    const ckpt = checkpointManager.get(checkpointId);
    if (!ckpt) return false;

    const snapshot = ckpt.filesSnapshot.find((f) => f.path === filePath);
    if (!snapshot) return false;

    try {
      await fileWriter.write(projectId, filePath, snapshot.content);
      executorLogger.info(runId, `File rolled back: ${filePath}`);
      return true;
    } catch {
      return false;
    }
  },
};
