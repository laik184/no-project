/**
 * server/runtime-truth/snapshot-builder.ts
 *
 * RuntimeSnapshotBuilder — assembles an immutable RuntimeSnapshot from
 * completed stage results and collected evidence.
 * Does NOT run any verification itself. Pure composition.
 */

import type {
  RuntimeSnapshot,
  StageResult,
  EvidenceItem,
  VerificationStage,
  RuntimeHealthState,
  RuntimeChecksums,
} from "./types.ts";
import type { RuntimeChecksumEngine } from "./checksum-engine.ts";
import type { RuntimeEvidenceCollector } from "./evidence-collector.ts";
import { randomUUID } from "crypto";

export class RuntimeSnapshotBuilder {
  private readonly _checksumEngine: RuntimeChecksumEngine;
  private readonly _evidenceCollector: RuntimeEvidenceCollector;

  constructor(
    checksumEngine: RuntimeChecksumEngine,
    evidenceCollector: RuntimeEvidenceCollector
  ) {
    this._checksumEngine = checksumEngine;
    this._evidenceCollector = evidenceCollector;
  }

  build(opts: {
    projectId: number;
    state: RuntimeHealthState;
    stateVersion: number;
    stages: readonly StageResult[];
    workspacePath: string;
    externalEvidence?: readonly EvidenceItem[];
  }): RuntimeSnapshot {
    const { projectId, state, stateVersion, stages, workspacePath } = opts;

    // Determine overall pass/fail and which stage failed first
    const failedStage = this._firstFailedStage(stages);
    const passed = failedStage === null && stages.every(
      (s) => s.status === "PASSED" || s.status === "SKIPPED"
    );

    // Compute checksums (may be slow — called once per pipeline run)
    let checksums: RuntimeChecksums;
    try {
      checksums = this._checksumEngine.computeAll(workspacePath);
    } catch {
      checksums = {
        workspaceChecksum: "",
        tsconfigHash: "",
        packageLockHash: "",
        nodeModulesHash: "",
      };
    }

    // Merge fresh evidence from collector with any externally supplied evidence
    const evidence = [
      ...this._evidenceCollector.fresh(),
      ...(opts.externalEvidence ?? []),
    ];

    return Object.freeze({
      snapshotId: randomUUID(),
      timestamp: Date.now(),
      state,
      stateVersion,
      projectId,
      stages: Object.freeze([...stages]),
      evidence: Object.freeze(evidence),
      checksums,
      passed,
      failedStage,
    });
  }

  summarise(snapshot: RuntimeSnapshot): string {
    const lines: string[] = [
      `Snapshot ${snapshot.snapshotId.slice(0, 8)} @ ${new Date(snapshot.timestamp).toISOString()}`,
      `State: ${snapshot.state} | Passed: ${snapshot.passed}`,
    ];
    for (const s of snapshot.stages) {
      const icon = s.status === "PASSED" ? "✓" : s.status === "FAILED" ? "✗" : "–";
      lines.push(`  ${icon} ${s.stage}: ${s.status} (${s.durationMs}ms)`);
      if (s.failureReason) lines.push(`      → ${s.failureReason}`);
    }
    return lines.join("\n");
  }

  private _firstFailedStage(
    stages: readonly StageResult[]
  ): VerificationStage | null {
    for (const s of stages) {
      if (s.status === "FAILED") return s.stage;
    }
    return null;
  }
}
