/**
 * server/verifiers/dependency-verifier.ts
 * Verifies that claimed npm packages are present in node_modules.
 * Single responsibility: validate dependency installation. Never executes tools.
 */

import fs   from "fs/promises";
import path from "path";
import type { VerifierResult } from "./types.ts";

const NODE_MODULES = path.join(process.cwd(), "node_modules");

async function packageExists(name: string): Promise<boolean> {
  // Scoped packages e.g. @org/pkg
  const pkgPath = path.join(NODE_MODULES, ...name.split("/").slice(0, name.startsWith("@") ? 2 : 1));
  try {
    await fs.access(pkgPath);
    return true;
  } catch {
    return false;
  }
}

export async function runDependencyVerifier(
  claimedPackages: string[],
): Promise<VerifierResult> {
  if (claimedPackages.length === 0) {
    return {
      verifier: "dependency",
      status:   "skipped",
      message:  "No packages to verify.",
      blocksExecution: false,
    };
  }

  const results = await Promise.all(
    claimedPackages.map(async (pkg) => ({ pkg, exists: await packageExists(pkg) })),
  );

  const missing = results.filter(r => !r.exists).map(r => r.pkg);

  if (missing.length === 0) {
    return {
      verifier: "dependency",
      status:   "passed",
      message:  `All ${claimedPackages.length} claimed package(s) are installed.`,
      blocksExecution: false,
    };
  }

  return {
    verifier: "dependency",
    status:   "failed",
    message:  `${missing.length} package(s) not found in node_modules: ${missing.slice(0, 3).join(", ")}`,
    detail:   `Run npm install for: ${missing.join(", ")}`,
    blocksExecution: true,
  };
}
