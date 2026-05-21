/**
 * server/verification/typescript/tsconfig-resolver.ts
 *
 * TSConfigResolver — locates tsconfig.json and computes a deterministic hash.
 * No subprocess. No mutable state. Pure filesystem reads.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ─── Result ───────────────────────────────────────────────────────────────────

export interface ResolvedTSConfig {
  readonly absolutePath: string;
  readonly hash: string;
  readonly raw: string;
}

// ─── Candidate search order ───────────────────────────────────────────────────

const CANDIDATES = [
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.base.json",
];

// ─── Resolver ────────────────────────────────────────────────────────────────

export class TSConfigResolver {
  resolve(
    workspacePath: string,
    explicitPath?: string
  ): ResolvedTSConfig | null {
    if (explicitPath) {
      return this._readConfig(path.resolve(workspacePath, explicitPath));
    }

    for (const candidate of CANDIDATES) {
      const resolved = this._readConfig(path.join(workspacePath, candidate));
      if (resolved) return resolved;
    }

    return null;
  }

  private _readConfig(absolutePath: string): ResolvedTSConfig | null {
    try {
      const raw = fs.readFileSync(absolutePath, "utf-8");
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      return { absolutePath, hash, raw };
    } catch {
      return null;
    }
  }

  hashFile(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash("sha256").update(content).digest("hex");
    } catch {
      return null;
    }
  }

  computeWorkspaceChecksum(workspacePath: string): string {
    const tsFiles = this._collectTSFiles(workspacePath, []);
    const hash = crypto.createHash("sha256");
    for (const f of tsFiles.sort()) {
      try {
        const stat = fs.statSync(f);
        hash.update(`${f}:${stat.mtimeMs}:${stat.size}`);
      } catch {
        hash.update(`${f}:missing`);
      }
    }
    return hash.digest("hex");
  }

  private _collectTSFiles(dir: string, acc: string[]): string[] {
    const MAX_FILES = 2000;
    if (acc.length >= MAX_FILES) return acc;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return acc;
    }

    for (const entry of entries) {
      if (acc.length >= MAX_FILES) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        this._collectTSFiles(fullPath, acc);
      } else if (entry.isFile() && TS_EXTS.test(entry.name)) {
        acc.push(fullPath);
      }
    }
    return acc;
  }
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".data", ".cache", "coverage"]);
const TS_EXTS = /\.(ts|tsx)$/;
