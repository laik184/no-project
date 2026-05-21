/**
 * server/runtime-truth/checksum-engine.ts
 *
 * RuntimeChecksumEngine — deterministic content-addressable checksums.
 * Used for cache invalidation and drift detection.
 * Pure filesystem reads + crypto. No mutable state.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { RuntimeChecksums, EvidenceItem } from "./types.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".data", ".cache"]);
const TS_EXTS   = /\.(ts|tsx|js|jsx|json)$/;
const MAX_FILES  = 3000;

export class RuntimeChecksumEngine {
  computeAll(workspacePath: string): RuntimeChecksums {
    return {
      workspaceChecksum: this.workspaceChecksum(workspacePath),
      tsconfigHash: this.fileHash(path.join(workspacePath, "tsconfig.json")) ?? "",
      packageLockHash: this.fileHash(path.join(workspacePath, "package-lock.json")) ?? "",
      nodeModulesHash: this.shallowNodeModulesHash(workspacePath),
    };
  }

  workspaceChecksum(workspacePath: string): string {
    const files = this._collect(workspacePath, []);
    const h = crypto.createHash("sha256");
    for (const f of files.sort()) {
      try {
        const s = fs.statSync(f);
        h.update(`${f}:${s.mtimeMs}:${s.size}`);
      } catch {
        h.update(`${f}:missing`);
      }
    }
    return h.digest("hex");
  }

  fileHash(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash("sha256").update(content).digest("hex");
    } catch {
      return null;
    }
  }

  shallowNodeModulesHash(workspacePath: string): string {
    const nmPath = path.join(workspacePath, "node_modules");
    try {
      const entries = fs.readdirSync(nmPath);
      const h = crypto.createHash("sha256");
      for (const e of entries.sort()) h.update(e);
      return h.digest("hex");
    } catch {
      return "";
    }
  }

  buildFilesystemEvidence(
    workspacePath: string,
    previousChecksum: string | null
  ): EvidenceItem {
    const current = this.workspaceChecksum(workspacePath);
    const drifted = previousChecksum !== null && current !== previousChecksum;
    return {
      kind: "FILESYSTEM_INTACT",
      value: !drifted,
      detail: drifted
        ? `Filesystem drifted — checksum changed since last snapshot`
        : `Filesystem stable (checksum: ${current.slice(0, 12)}…)`,
      collectedAt: Date.now(),
      ttlMs: 30_000,
    };
  }

  private _collect(dir: string, acc: string[]): string[] {
    if (acc.length >= MAX_FILES) return acc;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return acc;
    }
    for (const e of entries) {
      if (acc.length >= MAX_FILES) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) this._collect(full, acc);
      } else if (e.isFile() && TS_EXTS.test(e.name)) {
        acc.push(full);
      }
    }
    return acc;
  }
}
