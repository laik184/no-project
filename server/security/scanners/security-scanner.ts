/**
 * server/security/scanners/security-scanner.ts
 * Runs all detectors on a code block and produces a SecurityReport.
 * Single responsibility: orchestrate scanners. No file I/O, no side effects.
 */

import { detectSecretLeaks }          from "../detectors/secret-leak-detector.ts";
import { detectUnsafeEval }           from "../detectors/unsafe-eval-detector.ts";
import { detectCommandInjection }     from "../detectors/command-injection-detector.ts";
import { detectSSRF }                 from "../detectors/ssrf-detector.ts";
import { detectPathTraversal }        from "../detectors/path-traversal-detector.ts";
import { detectEnvMutation }          from "../detectors/env-mutation-detector.ts";
import { detectPrivilegeEscalation }  from "../detectors/privilege-escalation-detector.ts";
import { detectDangerousDependency }  from "../detectors/dangerous-dependency-detector.ts";
import { bus }                        from "../../infrastructure/events/bus.ts";
import type { SecurityFinding, SecurityReport } from "../detectors/types.ts";

// ── Risk score ─────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHTS = { critical: 30, high: 15, medium: 8, low: 3 };

function computeRiskScore(findings: SecurityFinding[]): number {
  const raw = findings.reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] ?? 0), 0);
  return Math.min(100, raw);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function runSecurityScan(
  code:     string,
  filePath: string,
  runId:    string,
  projectId: number,
): Promise<SecurityReport> {
  const startTs = Date.now();

  const findings: SecurityFinding[] = [
    ...detectSecretLeaks(code, filePath),
    ...detectUnsafeEval(code, filePath),
    ...detectCommandInjection(code, filePath),
    ...detectSSRF(code, filePath),
    ...detectPathTraversal(code, filePath),
    ...detectEnvMutation(code, filePath),
    ...detectPrivilegeEscalation(code, filePath),
    ...detectDangerousDependency(code, filePath),
  ];

  const riskScore   = computeRiskScore(findings);
  const blocked     = findings.some(f => f.blocked);
  const blockReasons = findings.filter(f => f.blocked).map(f => f.evidence);

  const report: SecurityReport = {
    runId, projectId, findings, riskScore,
    blocked, blockReasons,
    elapsedMs: Date.now() - startTs,
  };

  if (findings.length > 0) {
    bus.emit("agent.event", {
      runId,
      eventType: "security.scan.completed" as any,
      phase:     "tool-loop",
      ts:        Date.now(),
      payload:   { findingCount: findings.length, riskScore, blocked },
    });
  }

  return report;
}
