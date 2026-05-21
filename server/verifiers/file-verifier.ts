/**
 * server/verifiers/file-verifier.ts
 * Verifies that files claimed to exist actually exist on disk.
 * Single responsibility: validate file existence. Never executes tools.
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir } from "../infrastructure/sandbox/sandbox.util.ts";
import type { VerifierResult } from "./types.ts";

export async function runFileVerifier(
  projectId:     number,
  claimedPaths:  string[],   // relative paths the LLM claimed to write/read
): Promise<VerifierResult> {
  if (claimedPaths.length === 0) {
    return {
      verifier: "file",
      status:   "skipped",
      message:  "No file paths to verify.",
      blocksExecution: false,
    };
  }

  const projectDir = getProjectDir(projectId);
  const missing: string[] = [];

  for (const rel of claimedPaths) {
    try {
      const abs = path.resolve(projectDir, rel);
      // Security: must stay within sandbox
      if (!abs.startsWith(path.resolve(projectDir))) continue;
      await fs.access(abs);
    } catch {
      missing.push(rel);
    }
  }

  if (missing.length === 0) {
    return {
      verifier: "file",
      status:   "passed",
      message:  `All ${claimedPaths.length} claimed file(s) exist on disk.`,
      blocksExecution: false,
    };
  }

  return {
    verifier: "file",
    status:   "failed",
    message:  `${missing.length} claimed file(s) do not exist: ${missing.slice(0, 3).join(", ")}`,
    detail:   `Missing files: ${missing.join(", ")}`,
    blocksExecution: true,
  };
}
