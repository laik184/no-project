/**
 * server/fail-closed/audit/verification-audit-log.ts
 *
 * VerificationAuditLog — immutable, append-only record of all verification
 * decisions in a single run. Provides a tamper-evident chain for post-mortem.
 *
 * Each entry is stamped with a sequence number.
 * The log can be replayed to reconstruct any run's decision history.
 * Inject one instance per run — do NOT share across runs.
 */

import { randomUUID } from "crypto";
import type {
  AuditEntry,
  AuditEventKind,
  VerificationStage,
  Evidence,
} from "../contracts/types.ts";

export class VerificationAuditLog {
  private readonly _entries: AuditEntry[] = [];
  private _seq = 0;

  constructor(private readonly _runId: string) {}

  record(
    kind: AuditEventKind,
    detail: string,
    opts?: { stage?: VerificationStage; evidence?: readonly Evidence[] },
  ): AuditEntry {
    const entry: AuditEntry = Object.freeze({
      id:         randomUUID().replace(/-/g, "").slice(0, 16),
      sequenceNo: ++this._seq,
      kind,
      runId:      this._runId,
      stage:      opts?.stage,
      detail,
      timestamp:  Date.now(),
      evidence:   opts?.evidence ? Object.freeze([...opts.evidence]) : undefined,
    });
    this._entries.push(entry);
    return entry;
  }

  pipelineStarted(detail: string):   AuditEntry { return this.record("PIPELINE_STARTED",   detail); }
  stageStarted(stage: VerificationStage):        AuditEntry { return this.record("STAGE_STARTED",   `Stage ${stage} started`, { stage }); }
  stagePassed(stage: VerificationStage, evidence: readonly Evidence[]):  AuditEntry { return this.record("STAGE_PASSED",   `Stage ${stage} PASSED`, { stage, evidence }); }
  stageFailed(stage: VerificationStage, reason: string):    AuditEntry { return this.record("STAGE_FAILED",   `Stage ${stage} FAILED: ${reason}`, { stage }); }
  gateBlocked(detail: string, stage?: VerificationStage):   AuditEntry { return this.record("GATE_BLOCKED",   detail, { stage }); }
  completionProposed(detail: string): AuditEntry { return this.record("COMPLETION_PROPOSED", detail); }
  completionAuthorized(evidence: readonly Evidence[]): AuditEntry { return this.record("COMPLETION_AUTHORIZED", "Completion authorized", { evidence }); }
  completionDenied(reason: string):  AuditEntry { return this.record("COMPLETION_DENIED",   reason); }
  retryScheduled(detail: string, stage: VerificationStage): AuditEntry { return this.record("RETRY_SCHEDULED",  detail, { stage }); }
  retryBlacklisted(detail: string):  AuditEntry { return this.record("RETRY_BLACKLISTED", detail); }
  recoveryStarted(detail: string):   AuditEntry { return this.record("RECOVERY_STARTED",  detail); }
  rollbackExecuted(detail: string):  AuditEntry { return this.record("ROLLBACK_EXECUTED", detail); }
  systemHalted(reason: string):      AuditEntry { return this.record("SYSTEM_HALTED",     reason); }

  getAll(): readonly AuditEntry[] { return Object.freeze([...this._entries]); }

  getSince(seq: number): readonly AuditEntry[] {
    return this._entries.filter((e) => e.sequenceNo > seq);
  }

  getByKind(kind: AuditEventKind): readonly AuditEntry[] {
    return this._entries.filter((e) => e.kind === kind);
  }

  summary(): {
    runId: string;
    totalEntries: number;
    stagesPassed: number;
    stagesFailed: number;
    gatesBlocked: number;
    retriesScheduled: number;
    outcome: "authorized" | "denied" | "halted" | "in-progress";
  } {
    const authorized = this._entries.some((e) => e.kind === "COMPLETION_AUTHORIZED");
    const halted     = this._entries.some((e) => e.kind === "SYSTEM_HALTED");
    const denied     = this._entries.some((e) => e.kind === "COMPLETION_DENIED");

    return {
      runId:            this._runId,
      totalEntries:     this._entries.length,
      stagesPassed:     this._entries.filter((e) => e.kind === "STAGE_PASSED").length,
      stagesFailed:     this._entries.filter((e) => e.kind === "STAGE_FAILED").length,
      gatesBlocked:     this._entries.filter((e) => e.kind === "GATE_BLOCKED").length,
      retriesScheduled: this._entries.filter((e) => e.kind === "RETRY_SCHEDULED").length,
      outcome: authorized ? "authorized" : halted ? "halted" : denied ? "denied" : "in-progress",
    };
  }

  get runId(): string { return this._runId; }
  get length(): number { return this._entries.length; }
}
