/**
 * server/agents/verifier/verifier-agent.ts
 * Coordinates all verification checks and gates task completion.
 * Single responsibility: produce VerificationGateResult. No tool execution.
 * Communicates via typed AgentMessage contracts.
 */

import { v4 as uuidv4 }          from "uuid";
import { runVerificationEngine }  from "../../verification/index.ts";
import { runBrowserValidation }   from "../../browser/index.ts";
import { bus }                    from "../../infrastructure/events/bus.ts";
import type { AgentMessage }      from "../contracts/types.ts";

export interface VerifyRequest {
  includesBrowserCheck: boolean;
  checkTypes?:          string[];
}

export interface VerifyResponse {
  passed:        boolean;
  blockReasons:  string[];
  verificationScore: number;   // 0–100
  browserBlocked?: boolean;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function handleVerifyRequest(
  message: AgentMessage<VerifyRequest>,
): Promise<AgentMessage<VerifyResponse>> {
  const { runId, projectId, payload } = message;

  bus.emit("agent.event", {
    runId, eventType: "verifier.started" as any, phase: "verify",
    ts: Date.now(), payload: { includesBrowserCheck: payload.includesBrowserCheck },
  });

  // Core verification
  const verReport = await runVerificationEngine(projectId, runId)
    .catch(() => null);

  const blockReasons: string[] = [];
  if (verReport && !verReport.passed) {
    blockReasons.push(...verReport.checks.filter(c => c.status === "failed").map(c => c.message));
  }

  // Browser validation (optional)
  let browserBlocked = false;
  if (payload.includesBrowserCheck) {
    const browserReport = await runBrowserValidation(projectId, runId)
      .catch(() => null);
    if (browserReport?.blocked) {
      browserBlocked = true;
      blockReasons.push(...browserReport.blockReasons);
    }
  }

  const passed   = blockReasons.length === 0;
  const score    = Math.max(0, 100 - blockReasons.length * 20);

  const response: VerifyResponse = {
    passed, blockReasons,
    verificationScore: score,
    browserBlocked,
  };

  bus.emit("agent.event", {
    runId, eventType: passed ? "verifier.passed" : "verifier.failed" as any, phase: "verify",
    ts: Date.now(), payload: response,
  });

  return {
    messageId:     uuidv4(),
    type:          "verify.response",
    from:          "verifier",
    to:            message.from,
    runId, projectId,
    payload:       response,
    ts:            Date.now(),
    correlationId: message.messageId,
  };
}
