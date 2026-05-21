/**
 * server/agents/security/security-agent.ts
 * Orchestrates security scanning for generated code before execution.
 * Single responsibility: security scan → response. No tool execution.
 * Communicates via typed AgentMessage contracts.
 */

import { v4 as uuidv4 }      from "uuid";
import { runSecurityScan }    from "../../security/scanners/security-scanner.ts";
import { bus }               from "../../infrastructure/events/bus.ts";
import type { AgentMessage, SecurityScanRequest, SecurityScanResponse } from "../contracts/types.ts";

// ── Public API ────────────────────────────────────────────────────────────────

export async function handleSecurityScanRequest(
  message: AgentMessage<SecurityScanRequest>,
): Promise<AgentMessage<SecurityScanResponse>> {
  const { runId, projectId, payload } = message;

  const report = await runSecurityScan(
    payload.code,
    payload.filePath,
    runId,
    projectId,
  );

  const response: SecurityScanResponse = {
    blocked:  report.blocked,
    severity: worstSeverity(report),
    findings: report.findings.map(f => `[${f.severity}] ${f.evidence}`),
  };

  if (report.blocked) {
    bus.emit("agent.event", {
      runId, eventType: "security.blocked" as any, phase: "tool-loop",
      ts: Date.now(),
      payload: { riskScore: report.riskScore, findingCount: report.findings.length },
    });
  }

  return {
    messageId:     uuidv4(),
    type:          "security.scan.response",
    from:          "security",
    to:            message.from,
    runId, projectId,
    payload:       response,
    ts:            Date.now(),
    correlationId: message.messageId,
  };
}

function worstSeverity(
  report: import("../../security/detectors/types.ts").SecurityReport,
): SecurityScanResponse["severity"] {
  const order = ["low", "medium", "high", "critical"] as const;
  return report.findings.reduce(
    (worst, f) => (order.indexOf(f.severity) > order.indexOf(worst) ? f.severity : worst),
    "low" as SecurityScanResponse["severity"],
  );
}
