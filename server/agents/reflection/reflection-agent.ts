/**
 * server/agents/reflection/reflection-agent.ts
 * Analyzes retry loops and generates corrective strategy.
 * Single responsibility: reflection → corrective response. No tool execution.
 * Communicates via typed AgentMessage contracts.
 */

import { v4 as uuidv4 }          from "uuid";
import { runReflectionEngine }    from "../../engines/reflection/index.ts";
import { runHallucinationGate }   from "../../hallucination/index.ts";
import { bus }                    from "../../infrastructure/events/bus.ts";
import type { AgentMessage }      from "../contracts/types.ts";
import type { VerificationReport } from "../../verification/types.ts";

export interface ReflectionRequest {
  verificationReport: VerificationReport;
  messages:           unknown[];
  proposedCode?:      string;
}

export interface ReflectionResponse {
  strategy:          string;
  actions:           string[];
  loopDetected:      boolean;
  hallucinationRisk: number;   // 0–1
  shouldStop:        boolean;  // true = escalate to user
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function handleReflectionRequest(
  message: AgentMessage<ReflectionRequest>,
): Promise<AgentMessage<ReflectionResponse>> {
  const { runId, projectId, payload } = message;

  const [reflectionResult, hallucinationReport] = await Promise.all([
    runReflectionEngine(projectId, runId, payload.verificationReport, payload.messages),
    runHallucinationGate({
      projectId, runId,
      messages:     payload.messages,
      proposedCode: payload.proposedCode ?? "",
    }),
  ]);

  const shouldStop =
    reflectionResult.retryLoop.detected &&
    (reflectionResult.retryLoop.count ?? 0) >= 5;

  const response: ReflectionResponse = {
    strategy:          reflectionResult.recommendation.strategy,
    actions:           reflectionResult.recommendation.actions,
    loopDetected:      reflectionResult.retryLoop.detected,
    hallucinationRisk: hallucinationReport.overallConfidence,
    shouldStop,
  };

  bus.emit("agent.event", {
    runId, eventType: "reflection.agent.completed" as any, phase: "reflect",
    ts: Date.now(),
    payload: { strategy: response.strategy, shouldStop, hallucinationRisk: response.hallucinationRisk },
  });

  return {
    messageId:     uuidv4(),
    type:          "reflection.response",
    from:          "reflection",
    to:            message.from,
    runId, projectId,
    payload:       response,
    ts:            Date.now(),
    correlationId: message.messageId,
  };
}
