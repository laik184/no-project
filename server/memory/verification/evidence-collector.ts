/**
 * server/memory/verification/evidence-collector.ts
 *
 * EvidenceCollector — assembles Evidence records from raw tool/runtime output.
 * Evidence is the atomic unit that feeds the PromotionPipeline.
 * Evidence is checksummed at creation so tampering is detectable downstream.
 * No I/O. Inject tool output; get back an immutable Evidence record.
 */

import type { Evidence } from "../contracts/types.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";
import type { IdGenerator } from "../infrastructure/id-generator.ts";
import type { Clock } from "../infrastructure/clock.ts";

export type EvidenceInput = {
  source: string;
  data: unknown;
  ttlMs?: number;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes

export class EvidenceCollector {
  constructor(
    private readonly _checksum: ChecksumEngine,
    private readonly _ids:      IdGenerator,
    private readonly _clock:    Clock,
  ) {}

  collect(input: EvidenceInput): Evidence {
    const id = this._ids.generate("evid");
    return Object.freeze({
      id,
      source:       input.source,
      collectedAt:  this._clock.now(),
      data:         input.data,
      checksum:     this._checksum.compute(input.data),
      ttlMs:        input.ttlMs ?? DEFAULT_TTL_MS,
    });
  }

  collectMany(inputs: readonly EvidenceInput[]): readonly Evidence[] {
    return Object.freeze(inputs.map((i) => this.collect(i)));
  }

  /**
   * Verifies that evidence has not been tampered with since collection.
   */
  verify(evidence: Evidence): boolean {
    return this._checksum.verify(evidence.data, evidence.checksum);
  }

  /**
   * Checks whether evidence is still within its TTL.
   */
  isFresh(evidence: Evidence): boolean {
    return this._clock.now() < evidence.collectedAt + evidence.ttlMs;
  }

  /**
   * Filters an evidence array to only fresh, unmodified items.
   */
  filterValid(evidenceList: readonly Evidence[]): readonly Evidence[] {
    return Object.freeze(
      evidenceList.filter((e) => this.verify(e) && this.isFresh(e))
    );
  }

  /**
   * Build a server-running evidence item from an HTTP health check result.
   */
  fromHttpCheck(url: string, statusCode: number, latencyMs: number): Evidence {
    return this.collect({
      source: "http-health-check",
      data:   { url, statusCode, latencyMs, success: statusCode >= 200 && statusCode < 400 },
      ttlMs:  15_000,
    });
  }

  /**
   * Build a TypeScript-valid evidence item from tsc output.
   */
  fromTscRun(exitCode: number, errorCount: number, workspacePath: string): Evidence {
    return this.collect({
      source: "tsc-process-runner",
      data:   { exitCode, errorCount, workspacePath, passed: exitCode === 0 },
      ttlMs:  30_000,
    });
  }

  /**
   * Build a file-exists evidence item.
   */
  fromFileCheck(filePath: string, exists: boolean, sizeBytes?: number): Evidence {
    return this.collect({
      source: "filesystem-check",
      data:   { filePath, exists, sizeBytes },
      ttlMs:  10_000,
    });
  }
}
