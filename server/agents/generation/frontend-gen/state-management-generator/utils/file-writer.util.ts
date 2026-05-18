import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { GenerationFile } from "../types.js";
import { emitFileChange } from "../../../../../infrastructure/events/file-change-emitter.ts";

export function writeGeneratedFiles(
  files: readonly GenerationFile[],
  projectId?: number,
): readonly string[] {
  const writtenPaths: string[] = [];

  for (const file of files) {
    const existed = existsSync(file.path);
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content, "utf8");
    writtenPaths.push(file.path);
    if (projectId !== undefined) {
      emitFileChange(projectId, existed ? "change" : "add", file.path);
    }
  }

  return Object.freeze([...writtenPaths]);
}
