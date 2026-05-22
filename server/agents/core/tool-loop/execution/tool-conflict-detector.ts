/**
 * server/agents/core/tool-loop/execution/tool-conflict-detector.ts
 *
 * Detects resource conflicts between a batch of classified tool calls.
 * Used by the group builder to serialize or block conflicting calls.
 *
 * Conflict types
 * ──────────────
 *   SAME_FILE_WRITE   — two calls mutate the same file path
 *   RUNTIME_CONFLICT  — two calls restart/stop the same runtime
 *   PACKAGE_OVERLAP   — two calls install/uninstall packages simultaneously
 *   DUPLICATE_CALL    — identical tool name + args (idempotency guard)
 */

import type { ClassifiedCall } from "../types/parallel-execution.types.ts";

export type ConflictType =
  | "SAME_FILE_WRITE"
  | "RUNTIME_CONFLICT"
  | "PACKAGE_OVERLAP"
  | "DUPLICATE_CALL";

export interface ConflictEntry {
  type:        ConflictType;
  callIds:     [string, string];
  resourceKey: string;
  resolution:  "serialize" | "block";
}

export interface ConflictReport {
  hasConflicts: boolean;
  conflicts:    ConflictEntry[];
}

export function detectConflicts(calls: ClassifiedCall[]): ConflictReport {
  const conflicts: ConflictEntry[] = [];

  // Track resource key → first callId that claims it
  const resourceOwners = new Map<string, string>();
  // Track call fingerprint → first callId (duplicate detection)
  const fingerprints   = new Map<string, string>();

  for (const call of calls) {
    // Resource conflict detection
    for (const key of call.resourceKeys) {
      if (resourceOwners.has(key)) {
        conflicts.push({
          type:        resolveConflictType(key),
          callIds:     [resourceOwners.get(key)!, call.callId],
          resourceKey: key,
          resolution:  "serialize",
        });
      } else {
        resourceOwners.set(key, call.callId);
      }
    }

    // Duplicate call detection — same tool + same args
    const fp = `${call.name}::${call.args}`;
    if (fingerprints.has(fp)) {
      conflicts.push({
        type:        "DUPLICATE_CALL",
        callIds:     [fingerprints.get(fp)!, call.callId],
        resourceKey: fp.slice(0, 80),
        resolution:  "block",
      });
    } else {
      fingerprints.set(fp, call.callId);
    }
  }

  return { hasConflicts: conflicts.length > 0, conflicts };
}

function resolveConflictType(resourceKey: string): ConflictType {
  if (resourceKey.startsWith("FILE:"))    return "SAME_FILE_WRITE";
  if (resourceKey.startsWith("RUNTIME:")) return "RUNTIME_CONFLICT";
  if (resourceKey.startsWith("PACKAGE:")) return "PACKAGE_OVERLAP";
  return "SAME_FILE_WRITE";
}
