import type { ExecutionAdapter, Patch } from "../types.js";

export class NoopExecutionAdapter implements ExecutionAdapter {
  async applyPatches(_patches: readonly Patch[]): Promise<{ applied: boolean; warnings: readonly string[] }> {
    return Object.freeze({
      applied: false,
      warnings: Object.freeze([
        "Execution adapter is running in dry-run mode; patches were not written to filesystem.",
      ]),
    });
  }
}
