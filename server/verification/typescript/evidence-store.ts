/**
 * server/verification/typescript/evidence-store.ts
 *
 * RuntimeEvidenceStore — immutable, append-only audit trail of all
 * verification sessions. In-process store; survives for server lifetime.
 * Thread-safe for single-process Node.js event loop.
 */

import { randomUUID } from "crypto";
import type {
  EvidenceRecord,
  VerificationResult,
  FailureClass,
} from "./types.ts";

const MAX_RECORDS = 1000;

export class RuntimeEvidenceStore {
  private _records: EvidenceRecord[] = [];

  append(result: VerificationResult, failureClass: FailureClass | null): EvidenceRecord {
    const record: EvidenceRecord = Object.freeze({
      id: randomUUID(),
      sessionId: result.sessionId,
      workspacePath: result.workspacePath,
      tsconfigHash: result.tsconfigHash,
      compilerVersion: result.compilerVersion,
      exitCode: result.execution.exitCode,
      diagnosticCount: result.diagnostics.length,
      passed: result.passed,
      durationMs: result.durationMs,
      timestamp: result.timestamp,
      retryCount: result.retryCount,
      failureClass,
    });

    this._records.push(record);

    // Rolling window — drop oldest records to cap memory
    if (this._records.length > MAX_RECORDS) {
      this._records = this._records.slice(this._records.length - MAX_RECORDS);
    }

    return record;
  }

  getAll(): ReadonlyArray<EvidenceRecord> {
    return Object.freeze([...this._records]);
  }

  getBySession(sessionId: string): EvidenceRecord | undefined {
    return this._records.find((r) => r.sessionId === sessionId);
  }

  getByWorkspace(workspacePath: string): ReadonlyArray<EvidenceRecord> {
    return Object.freeze(
      this._records.filter((r) => r.workspacePath === workspacePath)
    );
  }

  lastPassedAt(workspacePath: string): number | null {
    const passed = this._records
      .filter((r) => r.workspacePath === workspacePath && r.passed)
      .sort((a, b) => b.timestamp - a.timestamp);
    return passed[0]?.timestamp ?? null;
  }

  stats(): {
    total: number;
    passed: number;
    failed: number;
    avgDurationMs: number;
  } {
    const total = this._records.length;
    const passed = this._records.filter((r) => r.passed).length;
    const avgDurationMs =
      total === 0
        ? 0
        : Math.round(
            this._records.reduce((s, r) => s + r.durationMs, 0) / total
          );
    return { total, passed, failed: total - passed, avgDurationMs };
  }
}

// ─── Process-scoped singleton ──────────────────────────────────────────────────

export const evidenceStore = new RuntimeEvidenceStore();
