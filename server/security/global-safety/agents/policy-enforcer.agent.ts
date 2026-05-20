import type { PolicyResult, RiskLevel } from "../types";
import { logEntry, logPolicy } from "../utils/log-builder.util";
import { matchPolicies, highestRiskLevel } from "../utils/policy-matcher.util";

export interface PolicyEnforcerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  policyResult?: PolicyResult;
}

export function enforcePolicy(action: string, context = ""): PolicyEnforcerOutput {
  const logs: string[] = [];
  try {
    const combined = `${action} ${context}`;
    logs.push(logEntry("policy-enforcer", `evaluating ${SYSTEM_POLICIES_COUNT} policies`));

    const matched = matchPolicies(combined);
    const violated = matched.filter((p) => p.blockByDefault);
    const applied = matched.filter((p) => !p.blockByDefault);

    for (const p of matched) {
      logs.push(logPolicy("policy-enforcer", p.id, p.name, !p.blockByDefault));
    }

    const allowed = violated.length === 0;
    const violatedLevels: RiskLevel[] = violated.map((p) => p.riskLevel);
    const highestViolation = violatedLevels.length > 0 ? highestRiskLevel(violatedLevels) : "LOW";

    const reason = allowed
      ? `All ${matched.length} matched policy rule(s) are non-blocking`
      : `${violated.length} blocking policy violation(s): ${violated.map((p) => p.id).join(", ")} — highest=${highestViolation}`;

    logs.push(logEntry("policy-enforcer", `result: allowed=${allowed} violations=${violated.length}`));

    return {
      success: true,
      logs,
      policyResult: {
        allowed,
        violatedPolicies: violated,
        appliedPolicies: applied,
        reason,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(logEntry("policy-enforcer", `ERROR: ${message}`));
    return { success: false, logs, error: message };
  }
}

const SYSTEM_POLICIES_COUNT = 10;
