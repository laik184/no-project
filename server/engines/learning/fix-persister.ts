/**
 * server/engines/learning/fix-persister.ts
 * Persists successful fix records to .nura/fixes.jsonl per project.
 * Single responsibility: write fix records. No orchestration logic.
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import type { FixRecord } from "./types.ts";

function fixesPath(projectId: number): string {
  return path.join(getProjectDir(projectId), ".nura", "fixes.jsonl");
}

export async function persistFix(
  projectId: number,
  record:    FixRecord,
): Promise<void> {
  const filePath = fixesPath(projectId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify(record) + "\n";
  await fs.appendFile(filePath, line, "utf8");
}

export async function loadRecentFixes(
  projectId: number,
  limit = 10,
): Promise<FixRecord[]> {
  const filePath = fixesPath(projectId);
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines   = content.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map(l => JSON.parse(l) as FixRecord);
  } catch {
    return [];
  }
}
