/**
 * server/runtime-truth/policy-engine.ts
 *
 * VerificationPolicyEngine — decides which stages to run, in what order,
 * with what timeouts, and whether to short-circuit after a failure.
 * No I/O. Pure decision logic based on options and policy tables.
 */

import type { VerificationStage, VerificationOptions } from "./types.ts";

export interface StagePolicy {
  readonly stage: VerificationStage;
  readonly timeoutMs: number;
  readonly required: boolean;   // false = skip failure does NOT abort pipeline
  readonly shortCircuit: boolean; // true = abort remaining stages on failure
}

// ─── Default pipeline order and policy ───────────────────────────────────────

const DEFAULT_PIPELINE: readonly StagePolicy[] = [
  { stage: "filesystem",       timeoutMs: 10_000, required: true,  shortCircuit: false },
  { stage: "import_graph",     timeoutMs: 30_000, required: true,  shortCircuit: true  },
  { stage: "typescript",       timeoutMs: 60_000, required: true,  shortCircuit: true  },
  { stage: "dependencies",     timeoutMs: 15_000, required: true,  shortCircuit: true  },
  { stage: "process_health",   timeoutMs: 10_000, required: true,  shortCircuit: true  },
  { stage: "http_health",      timeoutMs: 20_000, required: true,  shortCircuit: true  },
  { stage: "preview_behavior", timeoutMs: 20_000, required: false, shortCircuit: false },
];

export class VerificationPolicyEngine {
  buildPipeline(opts: VerificationOptions): readonly StagePolicy[] {
    const skip = new Set(opts.skipStages ?? []);

    return DEFAULT_PIPELINE
      .filter((p) => !skip.has(p.stage))
      .map((p) => Object.freeze({ ...p }));
  }

  shouldAbort(
    policy: StagePolicy,
    stagePassed: boolean
  ): boolean {
    if (stagePassed) return false;
    return policy.required && policy.shortCircuit;
  }

  totalTimeoutBudget(pipeline: readonly StagePolicy[]): number {
    return pipeline.reduce((sum, p) => sum + p.timeoutMs, 0);
  }

  stageTimeout(pipeline: readonly StagePolicy[], stage: VerificationStage): number {
    return pipeline.find((p) => p.stage === stage)?.timeoutMs ?? 30_000;
  }

  describeSkips(opts: VerificationOptions): string {
    const skipped = opts.skipStages ?? [];
    return skipped.length === 0
      ? "All stages enabled"
      : `Skipping: ${skipped.join(", ")}`;
  }
}
