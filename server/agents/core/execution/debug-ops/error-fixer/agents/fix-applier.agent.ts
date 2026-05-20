import { writeGeneratedFiles } from "../../../../../../services/file-writer/index.js";
import type { FixResult, Patch } from "../types.js";

export async function applyFixPatches(
  projectRoot: string,
  patches: readonly Patch[],
): Promise<FixResult> {
  if (patches.length === 0) {
    return Object.freeze({
      applied: false,
      patches: Object.freeze([]),
      rollbackSnapshot: Object.freeze([]),
      logs: Object.freeze(["No patches to apply."]),
      error: "No generated patches.",
    });
  }

  const report = await writeGeneratedFiles({
    files: patches.map((patch) => ({
      path: patch.filePath,
      action: "update",
      content: patch.after,
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
    patches,
    rollbackSnapshot: patches,
    logs: Object.freeze(report.logs.map((log) => `${log.level}:${log.code}:${log.message}`)),
    error: failed ? "File writer failed to apply all patches." : undefined,
  });
}
