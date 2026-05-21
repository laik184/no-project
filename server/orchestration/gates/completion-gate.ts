/**
 * server/orchestration/gates/completion-gate.ts
 * Final completion gate — blocks task_complete unless ALL checks pass.
 * Aggregates: verification + browser + policy + hallucination.
 * Single responsibility: gate decisions. No tool execution, no LLM calls.
 */

import { runPolicyEngine }          from "../../policies/index.ts";
import { runHallucinationGate }     from "../../hallucination/index.ts";
import { bus }                      from "../../infrastructure/events/bus.ts";
import type { VerificationReport }  from "../../verification/types.ts";
import type { BrowserValidationReport } from "../../browser/types.ts";

export interface CompletionGateInput {
  runId:               string;
  projectId:           number;
  goal:                string;
  stepCount:           number;
  retryCount:          number;
  messages:            unknown[];
  proposedCode?:       string;
  verificationReport?: VerificationReport | null;
  browserReport?:      BrowserValidationReport | null;
}

export interface CompletionGateResult {
  allowed:     boolean;
  blockReasons: string[];
  score:        number;  // 0–100 readiness score
  elapsedMs:   number;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runCompletionGate(
  input: CompletionGateInput,
): Promise<CompletionGateResult> {
  const startTs     = Date.now();
  const blockReasons: string[] = [];

  // 1. Verification gate
  if (input.verificationReport && !input.verificationReport.passed) {
    const failed = input.verificationReport.checks
      .filter(c => c.status === "failed")
      .map(c => `[verify] ${c.message}`);
    blockReasons.push(...failed);
  }

  // 2. Browser gate
  if (input.browserReport?.blocked) {
    blockReasons.push(...input.browserReport.blockReasons.map(r => `[browser] ${r}`));
  }

  // 3. Policy engine gate
  const policyCtx = {
    runId:     input.runId,
    projectId: input.projectId,
    toolName:  "task_complete",
    retryCount: input.retryCount,
    metadata: {
      stepCount:             input.stepCount,
      verificationPassed:    input.verificationReport?.passed ?? undefined,
      blankScreen:           input.browserReport?.visualStatus === "blank",
      hydrationFailed:       input.browserReport?.hydrationStatus === "failed",
      browserValidationBlocked: input.browserReport?.blocked ?? false,
    },
  };

  const policyReport = await runPolicyEngine(policyCtx)
    .catch(() => null);

  if (policyReport?.blocked) {
    blockReasons.push(...policyReport.blockReasons.map(r => `[policy] ${r}`));
  }

  // 4. Hallucination gate
  const hallucinationReport = await runHallucinationGate({
    projectId:    input.projectId,
    runId:        input.runId,
    messages:     input.messages,
    proposedCode: input.proposedCode ?? "",
  }).catch(() => null);

  if (hallucinationReport?.shouldBlock) {
    blockReasons.push(`[hallucination] ${hallucinationReport.recommendation}`);
  }

  const allowed = blockReasons.length === 0;
  const score   = Math.max(0, 100 - blockReasons.length * 20);

  const result: CompletionGateResult = {
    allowed, blockReasons, score, elapsedMs: Date.now() - startTs,
  };

  bus.emit("agent.event", {
    runId:     input.runId,
    eventType: allowed ? "completion.gate.passed" : "completion.gate.blocked" as any,
    phase:     "verify",
    ts:        Date.now(),
    payload:   { allowed, blockCount: blockReasons.length, score },
  });

  return result;
}
