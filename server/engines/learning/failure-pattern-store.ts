/**
 * server/engines/learning/failure-pattern-store.ts
 * Persists and retrieves failure patterns from .nura/failure-patterns.json.
 * Single responsibility: read/write failure patterns. No business logic.
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import type { FailurePattern } from "./types.ts";

function patternsPath(projectId: number): string {
  return path.join(getProjectDir(projectId), ".nura", "failure-patterns.json");
}

async function loadPatterns(projectId: number): Promise<FailurePattern[]> {
  try {
    const raw = await fs.readFile(patternsPath(projectId), "utf8");
    return JSON.parse(raw) as FailurePattern[];
  } catch {
    return [];
  }
}

async function savePatterns(projectId: number, patterns: FailurePattern[]): Promise<void> {
  const filePath = patternsPath(projectId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(patterns, null, 2), "utf8");
}

export async function recordFailurePattern(
  projectId:   number,
  pattern:     string,
  failureType: string,
  knownFix?:   string,
): Promise<void> {
  const patterns = await loadPatterns(projectId);
  const existing = patterns.find(p => p.pattern === pattern);

  if (existing) {
    existing.occurrences += 1;
    existing.lastSeen     = Date.now();
    if (knownFix) existing.knownFix = knownFix;
  } else {
    patterns.push({
      pattern,
      failureType,
      occurrences: 1,
      lastSeen:    Date.now(),
      knownFix,
    });
  }

  // Keep last 50 patterns
  const trimmed = patterns
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 50);

  await savePatterns(projectId, trimmed);
}

export async function getKnownFix(
  projectId:   number,
  pattern:     string,
): Promise<string | undefined> {
  const patterns = await loadPatterns(projectId);
  return patterns.find(p => p.pattern === pattern)?.knownFix;
}
