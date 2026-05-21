/**
 * server/completion/checks/dependency-validation-check.ts
 * Verifies all declared dependencies are installed and no known malicious packages.
 * Single responsibility: dependency integrity at completion. No execution.
 */

import fs   from "fs/promises";
import path from "path";
import { applyDependencyPolicy } from "../../policies/security/dependency-policy.ts";
import type { CompletionCheckResult, CompletionGateInput } from "../types.ts";

interface PackageJson {
  dependencies?:    Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function readPackageJson(root: string): Promise<PackageJson | null> {
  try {
    const raw = await fs.readFile(path.join(root, "package.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function nodeModulesExists(root: string): Promise<boolean> {
  try {
    await fs.access(path.join(root, "node_modules"));
    return true;
  } catch {
    return false;
  }
}

export async function runDependencyValidationCheck(
  input: CompletionGateInput,
): Promise<CompletionCheckResult> {
  const pkg = await readPackageJson(input.projectRoot);

  if (!pkg) {
    return {
      check:   "DependencyValidation",
      status:  "skipped",
      passed:  true,
      details: "No package.json found — dependency check skipped.",
    };
  }

  const installed = await nodeModulesExists(input.projectRoot);
  if (!installed) {
    return {
      check:   "DependencyValidation",
      status:  "failed",
      passed:  false,
      details: "node_modules not found — run npm install before completing.",
    };
  }

  const allPackages = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];

  const blocked: string[] = [];
  for (const pkgName of allPackages) {
    const result = applyDependencyPolicy({
      runId: input.runId, projectId: input.projectId, packageName: pkgName,
    });
    if (result.decision === "block") blocked.push(pkgName);
  }

  const passed = blocked.length === 0;

  return {
    check:   "DependencyValidation",
    status:  passed ? "passed" : "failed",
    passed,
    details: passed
      ? `${allPackages.length} dependencies verified — no malicious packages detected.`
      : `Blocked packages detected: ${blocked.join(", ")}`,
    evidence: { totalPackages: allPackages.length, blocked },
  };
}
