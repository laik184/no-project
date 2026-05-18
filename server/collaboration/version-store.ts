/**
 * server/collaboration/version-store.ts
 *
 * Lightweight in-memory file version tracker.
 * Tracks SHA-256 checksum + monotonic version counter per project+file.
 * Updated after every successful write (approval or direct save).
 *
 * Responsibilities:
 *  - Provide a stable checksum for each file after every write
 *  - Detect when two concurrent writers collide (checksum mismatch)
 *  - Record who last touched a file (agent | user | system)
 *
 * Intentionally simple — no DB, no external deps, < 100 lines.
 */

import crypto from "crypto";

export interface FileVersion {
  version:   number;
  checksum:  string;                          // SHA-256 hex of file content
  updatedAt: number;                          // unix ms
  updatedBy: "agent" | "user" | "system";
}

type StoreKey = string; // `${projectId}:${filePath}`

class VersionStore {
  private map = new Map<StoreKey, FileVersion>();

  private key(projectId: number | string, filePath: string): StoreKey {
    return `${projectId}:${filePath}`;
  }

  /** SHA-256 hex digest of UTF-8 string content */
  checksum(content: string): string {
    return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
  }

  /**
   * Record a successful write.
   * Increments the version counter and stores a fresh checksum.
   * Returns the new FileVersion so callers can attach it to SSE events.
   */
  record(
    projectId: number | string,
    filePath:  string,
    content:   string,
    updatedBy: FileVersion["updatedBy"] = "system",
  ): FileVersion {
    const k    = this.key(projectId, filePath);
    const prev = this.map.get(k);
    const next: FileVersion = {
      version:   (prev?.version ?? 0) + 1,
      checksum:  this.checksum(content),
      updatedAt: Date.now(),
      updatedBy,
    };
    this.map.set(k, next);
    return next;
  }

  /** Current version record, or null if this file has never been tracked. */
  get(projectId: number | string, filePath: string): FileVersion | null {
    return this.map.get(this.key(projectId, filePath)) ?? null;
  }

  /**
   * Returns true when the client's checksum differs from the stored one —
   * meaning the file was written by someone else since the client last read it.
   * Returns false for untracked files (no recorded writes yet).
   */
  hasConflict(
    projectId:      number | string,
    filePath:       string,
    clientChecksum: string,
  ): boolean {
    const v = this.get(projectId, filePath);
    if (!v) return false;
    return v.checksum !== clientChecksum;
  }

  /** Remove tracking entry (e.g. after file deletion). */
  remove(projectId: number | string, filePath: string): void {
    this.map.delete(this.key(projectId, filePath));
  }

  /** Snapshot for debugging / health endpoints. */
  snapshot(): Record<string, FileVersion> {
    return Object.fromEntries(this.map);
  }
}

export const versionStore = new VersionStore();
