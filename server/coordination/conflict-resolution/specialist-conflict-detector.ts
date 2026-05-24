/**
 * specialist-conflict-detector.ts
 *
 * Detects conflicts between specialist results before merge.
 * Single responsibility: identify files targeted by multiple specialists.
 *
 * Conflict types:
 *   CONTENT   — two specialists wrote different content to the same file
 *   OWNERSHIP — two specialists claim exclusive write rights to same file
 *   ORDERING  — dependency-violating patch order detected
 */

import type { SpecialistResult, FilePatch, SpecialistDomain }
  from "../contracts/specialist.contracts.ts";
import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConflictType = "CONTENT" | "OWNERSHIP" | "ORDERING";

export interface SpecialistConflict {
  filePath:    string;
  type:        ConflictType;
  patches:     FilePatch[];
  domains:     SpecialistDomain[];
  description: string;
}

export interface ConflictReport {
  runId:     string;
  conflicts: SpecialistConflict[];
  safe:      FilePatch[];
  hasConflicts: boolean;
}

// ── Telemetry helper ──────────────────────────────────────────────────────────

function emitConflict(runId: string, conflict: SpecialistConflict): void {
  bus.emit("agent.event", {
    runId,
    phase:     "coordination",
    agentName: "specialist-conflict-detector",
    eventType: "conflict.detected",
    payload:   {
      filePath:    conflict.filePath,
      type:        conflict.type,
      domains:     conflict.domains,
      description: conflict.description,
    },
    ts: Date.now(),
  });
}

// ── Detector ──────────────────────────────────────────────────────────────────

export class SpecialistConflictDetector {
  /**
   * Analyse all patches from successful specialist results.
   * Returns a ConflictReport separating conflicting patches from safe ones.
   */
  detect(runId: string, results: SpecialistResult[]): ConflictReport {
    // Index patches by file path
    const byFile = new Map<string, Array<{ patch: FilePatch; domain: SpecialistDomain }>>();

    for (const result of results) {
      if (!result.success) continue;
      for (const patch of result.patches) {
        if (!byFile.has(patch.filePath)) byFile.set(patch.filePath, []);
        byFile.get(patch.filePath)!.push({ patch, domain: result.domain });
      }
    }

    const conflicts: SpecialistConflict[] = [];
    const safePatchPaths = new Set<string>();

    for (const [filePath, entries] of byFile) {
      if (entries.length === 1) {
        safePatchPaths.add(filePath);
        continue;
      }

      // Multiple specialists touched same file — classify conflict
      const patches  = entries.map(e => e.patch);
      const domains  = entries.map(e => e.domain);
      const contents = new Set(entries.map(e => e.patch.content ?? ""));
      const ops      = new Set(entries.map(e => e.patch.operation));

      let type: ConflictType;
      let description: string;

      if (ops.size > 1) {
        type = "ORDERING";
        description = `Conflicting operations (${[...ops].join(", ")}) on ${filePath}`;
      } else if (contents.size > 1) {
        type = "CONTENT";
        description = `${entries.length} specialists wrote different content to ${filePath}`;
      } else {
        type = "OWNERSHIP";
        description = `Multiple specialists (${domains.join(", ")}) claim exclusive write to ${filePath}`;
      }

      const conflict: SpecialistConflict = { filePath, type, patches, domains, description };
      conflicts.push(conflict);
      emitConflict(runId, conflict);
    }

    // Safe patches: only one specialist touched the file
    const safe: FilePatch[] = [];
    for (const result of results) {
      if (!result.success) continue;
      for (const patch of result.patches) {
        if (safePatchPaths.has(patch.filePath)) safe.push(patch);
      }
    }

    return { runId, conflicts, safe, hasConflicts: conflicts.length > 0 };
  }
}

export const specialistConflictDetector = new SpecialistConflictDetector();
