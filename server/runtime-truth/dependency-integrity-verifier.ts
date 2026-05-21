/**
 * server/runtime-truth/dependency-integrity-verifier.ts
 *
 * DependencyIntegrityVerifier — checks node_modules integrity against
 * package.json declared dependencies. No npm subprocess. Pure filesystem.
 */

import fs from "fs";
import path from "path";
import type { DependencyIntegrityReport, EvidenceItem } from "./types.ts";

export class DependencyIntegrityVerifier {
  async verify(workspacePath: string): Promise<{
    report: DependencyIntegrityReport;
    evidence: readonly EvidenceItem[];
  }> {
    const t0 = Date.now();

    const pkgPath = path.join(workspacePath, "package.json");
    const lockPath = path.join(workspacePath, "package-lock.json");
    const nmPath   = path.join(workspacePath, "node_modules");

    const packageLockPresent = fs.existsSync(lockPath);
    const nodeModulesPresent = fs.existsSync(nmPath);

    const missing: string[] = [];

    if (nodeModulesPresent) {
      const declared = this._readDeclaredDeps(pkgPath);
      for (const dep of declared) {
        const depPath = path.join(nmPath, dep);
        if (!fs.existsSync(depPath)) {
          missing.push(dep);
          if (missing.length >= 20) break; // cap
        }
      }
    } else {
      missing.push("<node_modules directory missing>");
    }

    const intact = nodeModulesPresent && missing.length === 0;
    const durationMs = Date.now() - t0;
    const now = Date.now();

    const report: DependencyIntegrityReport = Object.freeze({
      intact,
      missingPackages: Object.freeze(missing),
      packageLockPresent,
      nodeModulesPresent,
      durationMs,
    });

    const evidence: EvidenceItem[] = [
      {
        kind: "DEPENDENCIES_INTACT",
        value: intact,
        detail: intact
          ? "All declared dependencies found in node_modules"
          : `Missing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
        collectedAt: now,
        ttlMs: 60_000,
      },
    ];

    return { report, evidence: Object.freeze(evidence) };
  }

  private _readDeclaredDeps(pkgPath: string): string[] {
    try {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      const deps = {
        ...(pkg.dependencies as Record<string, string> ?? {}),
        ...(pkg.devDependencies as Record<string, string> ?? {}),
      };
      return Object.keys(deps);
    } catch {
      return [];
    }
  }
}
