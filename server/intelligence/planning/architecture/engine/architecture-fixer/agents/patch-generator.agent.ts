import type { Patch, TransformResult } from "../types.js";

let patchCounter = 0;

function nextPatchId(): string {
  patchCounter += 1;
  return `patch-${String(patchCounter).padStart(4, "0")}`;
}

function toUnifiedDiff(path: string, before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const removed = beforeLines.filter((line) => !afterLines.includes(line)).map((line) => `-${line}`).join("\n");
  const added = afterLines.filter((line) => !beforeLines.includes(line)).map((line) => `+${line}`).join("\n");
  return [`--- a/${path}`, `+++ b/${path}`, "@@", removed, added].filter(Boolean).join("\n");
}

export function generatePatches(results: readonly TransformResult[]): readonly Patch[] {
  const patches: Patch[] = [];

  for (const result of results) {
    for (const change of result.changes) {
      if (change.previousContent === change.nextContent) continue;
      patches.push(Object.freeze({
        id: nextPatchId(),
        filePath: change.path,
        diff: toUnifiedDiff(change.path, change.previousContent, change.nextContent),
        reversible: true,
      }));
    }
  }

  return Object.freeze(patches.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.id.localeCompare(b.id)));
}

export function resetPatchGeneratorState(): void {
  patchCounter = 0;
}
