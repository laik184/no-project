/**
 * server/verifiers/build-verifier.ts
 * Verifies TypeScript compiles without errors in the project sandbox.
 * Single responsibility: validate build status. Never executes tools.
 */

import { execFile }      from "child_process";
import { promisify }     from "util";
import path              from "path";
import { getProjectDir } from "../infrastructure/sandbox/sandbox.util.ts";
import type { VerifierResult } from "./types.ts";

const execFileAsync = promisify(execFile);
const TSC_TIMEOUT_MS = 15_000;

export async function runBuildVerifier(
  projectId: number,
): Promise<VerifierResult> {
  const projectDir = getProjectDir(projectId);
  const tsconfig   = path.join(projectDir, "tsconfig.json");

  // Only run if project has a tsconfig
  try {
    const { default: fs } = await import("fs/promises");
    await fs.access(tsconfig);
  } catch {
    return {
      verifier: "build",
      status:   "skipped",
      message:  "No tsconfig.json found — skipping TypeScript check.",
      blocksExecution: false,
    };
  }

  try {
    await execFileAsync(
      "npx", ["tsc", "--noEmit", "--skipLibCheck"],
      { cwd: projectDir, timeout: TSC_TIMEOUT_MS },
    );

    return {
      verifier: "build",
      status:   "passed",
      message:  "TypeScript compilation succeeded (no errors).",
      blocksExecution: false,
    };
  } catch (err: any) {
    const stderr = (err.stderr ?? err.stdout ?? "").slice(0, 500);
    const errorCount = (stderr.match(/error TS/g) ?? []).length;

    return {
      verifier: "build",
      status:   "failed",
      message:  `TypeScript compilation failed — ${errorCount} error(s) found.`,
      detail:   stderr.slice(0, 300),
      blocksExecution: true,
    };
  }
}
