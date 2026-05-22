/**
 * memory-recovery.ts
 *
 * Automatic recovery for corrupted or partially-written memory files.
 * Scans for temp / backup artifacts left by interrupted transactions
 * and restores the last known-good state.
 *
 * Responsibilities:
 *   ✅ detect corrupted memory files
 *   ✅ recover from orphaned .tmp files
 *   ✅ restore from .bak backup files
 *   ✅ quarantine unrecoverable files
 *   ✅ emit recovery telemetry
 *
 * Called automatically at system startup and can be triggered on demand.
 */

import fs   from "fs/promises";
import path from "path";

import { validateContent, computeChecksum } from "./memory-validator.ts";
import { emitRecovery }                     from "./memory-telemetry.ts";
import type { MemoryFileType, RecoveryResult } from "./memory-types.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const QUARANTINE_SUFFIX = ".quarantine";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Inspect a single file path for corruption and recover if possible.
 * Returns a RecoveryResult describing what action was taken.
 */
export async function recoverFile(
  filePath: string,
  fileType: MemoryFileType = "text",
): Promise<RecoveryResult> {
  const tempPath    = filePath + ".tmp";
  const backupPath  = filePath + ".bak";

  // ── Check for orphaned temp file first ────────────────────────────────────
  const tempExists = await fileExists(tempPath);
  if (tempExists) {
    const tempContent = await readSafe(tempPath);
    const validation  = validateContent(tempContent, fileType);

    if (validation.valid) {
      // Temp is valid — a crash interrupted the rename; complete it now
      await fs.rename(tempPath, filePath);
      emitRecovery(filePath, "restored_from_temp", "orphaned .tmp was valid — rename completed");
      return { action: "restored_from_temp", filePath, reason: "orphaned temp file recovered" };
    } else {
      // Temp is corrupt — quarantine it, don't touch the original
      await quarantine(tempPath);
      emitRecovery(filePath, "quarantined", `orphaned .tmp corrupt: ${validation.reason}`);
    }
  }

  // ── Validate current file ─────────────────────────────────────────────────
  const currentExists = await fileExists(filePath);
  if (!currentExists) {
    // File simply doesn't exist yet — no recovery needed
    return { action: "none", filePath, reason: "file does not exist yet" };
  }

  const content    = await readSafe(filePath);
  const validation = validateContent(content, fileType);

  if (validation.valid) {
    // File is healthy — nothing to do
    return { action: "none", filePath, reason: "file is valid" };
  }

  // ── File is corrupt — attempt restore from backup ─────────────────────────
  const backupExists = await fileExists(backupPath);
  if (backupExists) {
    const backupContent    = await readSafe(backupPath);
    const backupValidation = validateContent(backupContent, fileType);

    if (backupValidation.valid) {
      await quarantine(filePath);
      await fs.copyFile(backupPath, filePath);
      emitRecovery(filePath, "restored_from_backup", `corrupt file replaced from .bak (${validation.reason})`);
      return {
        action:   "restored_from_backup",
        filePath,
        reason:   `restored from backup — original was corrupt: ${validation.reason}`,
      };
    }
  }

  // ── No valid backup — quarantine corrupt file ─────────────────────────────
  await quarantine(filePath);
  emitRecovery(filePath, "quarantined", `unrecoverable: ${validation.reason}`);
  return {
    action:   "quarantined",
    filePath,
    reason:   `quarantined — unrecoverable corruption: ${validation.reason}`,
  };
}

/**
 * Scan a directory for memory artifact files and recover each one.
 * Processes only known memory file extensions (.json, .jsonl, .md).
 */
export async function recoverDirectory(dirPath: string): Promise<RecoveryResult[]> {
  const results: RecoveryResult[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(dirPath);
  } catch {
    return results; // Directory doesn't exist yet — nothing to recover
  }

  for (const entry of entries) {
    if (entry.endsWith(".tmp") || entry.endsWith(".bak") || entry.endsWith(QUARANTINE_SUFFIX)) {
      continue; // Will be handled via the target file scan
    }

    const fileType = inferFileType(entry);
    if (!fileType) continue;

    const result = await recoverFile(path.join(dirPath, entry), fileType);
    if (result.action !== "none") {
      results.push(result);
    }
  }

  return results;
}

/**
 * Clean up stale backup files older than maxAgeMs (default: 1 hour).
 */
export async function cleanStaleBackups(
  dirPath:   string,
  maxAgeMs = 3_600_000,
): Promise<number> {
  let cleaned = 0;
  let entries: string[];

  try {
    entries = await fs.readdir(dirPath);
  } catch {
    return 0;
  }

  const cutoff = Date.now() - maxAgeMs;

  for (const entry of entries) {
    if (!entry.endsWith(".bak")) continue;
    const filePath = path.join(dirPath, entry);
    try {
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(filePath);
        cleaned++;
      }
    } catch { /* file may have been removed already */ }
  }

  return cleaned;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

async function quarantine(filePath: string): Promise<void> {
  const dest = filePath + QUARANTINE_SUFFIX + "." + Date.now();
  try {
    await fs.rename(filePath, dest);
  } catch {
    // If rename fails, try copy + delete
    try {
      await fs.copyFile(filePath, dest);
      await fs.unlink(filePath);
    } catch { /* best effort */ }
  }
}

function inferFileType(filename: string): MemoryFileType | null {
  if (filename.endsWith(".jsonl")) return "jsonl";
  if (filename.endsWith(".json"))  return "json";
  if (filename.endsWith(".md"))    return "markdown";
  if (filename.endsWith(".txt"))   return "text";
  return null;
}
