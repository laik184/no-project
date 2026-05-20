import type { SafetyDecision, RiskLevel } from "../types";
import type { PolicyResult } from "../types";
import type { OverrideResult } from "../types";
import { logEntry, logBlock, logAllow } from "../utils/log-builder.util";

export interface ActionGuardOutput {
  success: boolean;
  logs: string[];
  error?: string;
  decision?: SafetyDecision;
  blockedBy?: string;
}

export function guardAction(
  riskScore: number,
  riskLevel: RiskLevel,
  policyResult: PolicyResult,
  override: OverrideResult,
  threatsDetected: boolean
): ActionGuardOutput {
  const logs: string[] = [];
  try {
    logs.push(logEntry("action-guard", `evaluating — riskScore=${riskScore} riskLevel=${riskLevel} policyAllowed=${policyResult.allowed} overrideGranted=${override.overrideGranted}`));

    // CRITICAL risk always blocked — no override possible
    if (riskLevel === "CRITICAL" && !override.overrideGranted) {
      const reason = `Critical risk level (score=${riskScore}) — action is categorically unsafe`;
      logs.push(logBlock("action-guard", reason));
      return { success: true, logs, decision: "BLOCK", blockedBy: reason };
    }

    // Policy violation without override
    if (!policyResult.allowed && !override.overrideGranted) {
      const violated = policyResult.violatedPolicies.map((p) => p.id).join(", ");
      const reason = `Policy violation(s): ${violated} — ${policyResult.reason}`;
      logs.push(logBlock("action-guard", reason));
      return { success: true, logs, decision: "BLOCK", blockedBy: reason };
    }

    // Threats detected at HIGH+ without override
    if (threatsDetected && riskLevel !== "LOW" && !override.overrideGranted) {
      const reason = `Threats detected at ${riskLevel} severity without override — blocking for safety`;
      logs.push(logBlock("action-guard", reason));
      return { success: true, logs, decision: "BLOCK", blockedBy: reason };
    }

    // Override granted — allow with note
    if (override.overrideGranted && (!policyResult.allowed || threatsDetected)) {
      const reason = `Admin override applied — ${override.reason}`;
      logs.push(logAllow("action-guard", reason));
      return { success: true, logs, decision: "ALLOW" };
    }

    // All clear
    const reason = `riskLevel=${riskLevel} score=${riskScore} — no violations, no threats`;
    logs.push(logAllow("action-guard", reason));
    return { success: true, logs, decision: "ALLOW" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(logEntry("action-guard", `ERROR: ${message}`));
    return { success: false, logs, error: message };
  }
}
