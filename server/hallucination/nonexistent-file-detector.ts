/**
 * server/hallucination/nonexistent-file-detector.ts
 * Detects when LLM references file paths that do not exist on disk.
 * Single responsibility: detect nonexistent file claims. Read-only.
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir } from "../infrastructure/sandbox/sandbox.util.ts";
import type { HallucinationSignal } from "./types.ts";

// Extract relative file paths from import statements and read_file calls
function extractFilePaths(content: string): string[] {
  const imports = [...content.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map(m => m[1]!);
  const reads   = [...content.matchAll(/read_file.*?["']([^"']+)['"]/g)].map(m => m[1]!);
  return [...imports, ...reads];
}

export async function detectNonexistentFiles(
  projectId: number,
  content:   string,
): Promise<HallucinationSignal[]> {
  if (!content) return [];

  const projectDir = getProjectDir(projectId);
  const paths      = extractFilePaths(content);
  const signals:   HallucinationSignal[] = [];

  for (const rel of new Set(paths)) {
    try {
      const abs = path.resolve(projectDir, rel);
      if (!abs.startsWith(path.resolve(projectDir))) continue;
      await fs.access(abs);
    } catch {
      signals.push({
        type:       "nonexistent_file",
        confidence: 0.70,
        evidence:   `File path "${rel}" does not exist in sandbox`,
        location:   rel,
      });
    }
  }

  return signals;
}
