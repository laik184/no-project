import { writeGeneratedFiles } from "../../../../../../services/file-writer/index.js";
import type { FixResult, Patch } from "../types.js";

export async function rollbackFix(
  projectRoot: string,
  rollbackSnapshot: readonly Patch[],
  reason: string,
): Promise<FixResult> {
  if (rollbackSnapshot.length === 0) {
    return Object.freeze({
      applied: false,
      patches: Object.freeze([]),
      rollbackSnapshot: Object.freeze([]),
      logs: Object.freeze([`Rollback skipped: ${reason}`]),
      error: "No rollback snapshot available.",
    });
  }

  const report = await writeGeneratedFiles({
    files: rollbackSnapshot.map((patch) => ({
      path: patch.filePath,
      action: "update",
      content: patch.before,
    })),
    options: {
      rootDir: projectRoot,
      overwrite: true,
      backup: true,
      mergeMode: "overwrite",
    },
  });

  const failed = report.failedFiles.length > 0;
  return Object.freeze({
    applied: !failed,
    patches: Object.freeze([]),
    rollbackSnapshot,
    logs: Object.freeze([
      ...report.logs.map((log) => `${log.level}:${log.code}:${log.message}`),
      `Rollback reason: ${reason}`,
    ]),
    error: failed ? "Rollback encountered write failures." : undefined,
  });
}
