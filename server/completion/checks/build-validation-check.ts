/**
 * server/completion/checks/build-validation-check.ts
 * Verifies the project build succeeds before completion is allowed.
 * Single responsibility: build pass/fail determination. No policy logic.
 */

import { execSync }         from "child_process";
import path                 from "path";
import type { CompletionCheckResult, CompletionGateInput } from "../types.ts";

const BUILD_TIMEOUT_MS = 60_000;
const TS_CHECK_CMD     = "npx tsc --noEmit --skipLibCheck 2>&1";

function runTypeCheck(cwd: string): { passed: boolean; output: string } {
  try {
    const output = execSync(TS_CHECK_CMD, { cwd, timeout: BUILD_TIMEOUT_MS, encoding: "utf-8" });
    return { passed: true, output: output.slice(0, 2000) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const output = (err as any)?.stdout ?? msg;
    return { passed: false, output: String(output).slice(0, 2000) };
  }
}

function hasTsConfig(projectRoot: string): boolean {
  try {
    const fs = require("fs");
    return fs.existsSync(path.join(projectRoot, "tsconfig.json"));
  } catch {
    return false;
  }
}

export async function runBuildValidationCheck(
  input: CompletionGateInput,
): Promise<CompletionCheckResult> {
  const { projectRoot } = input;

  if (!hasTsConfig(projectRoot)) {
    return {
      check:   "BuildValidation",
      status:  "skipped",
      passed:  true,
      details: "No tsconfig.json found — TypeScript check skipped.",
    };
  }

  const result = runTypeCheck(projectRoot);

  return {
    check:   "BuildValidation",
    status:  result.passed ? "passed" : "failed",
    passed:  result.passed,
    details: result.passed
      ? "TypeScript check passed — no type errors."
      : `TypeScript errors found:\n${result.output}`,
    evidence: { output: result.output },
  };
}
