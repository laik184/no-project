import type { OverrideResult, RiskLevel } from "../types";
import { logEntry, logOverride } from "../utils/log-builder.util";

export interface OverrideControllerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  override?: OverrideResult;
}

const CRITICAL_THRESHOLD = 80;
const HIGH_THRESHOLD = 55;

export function checkOverride(
  isAdmin: boolean,
  riskScore: number,
  riskLevel: RiskLevel
): OverrideControllerOutput {
  const logs: string[] = [];
  try {
    logs.push(logEntry("override-controller", `isAdmin=${isAdmin} riskScore=${riskScore} riskLevel=${riskLevel}`));

    if (!isAdmin) {
      const result: OverrideResult = {
        overrideGranted: false,
        reason: "Override requires admin flag — caller is not admin",
      };
      logs.push(logOverride("override-controller", false, result.reason));
      return { success: true, logs, override: result };
    }

    if (riskLevel === "CRITICAL" || riskScore >= CRITICAL_THRESHOLD) {
      const result: OverrideResult = {
        overrideGranted: false,
        reason: `Override denied — riskLevel=${riskLevel} (score=${riskScore}) exceeds critical threshold (${CRITICAL_THRESHOLD})`,
      };
      logs.push(logOverride("override-controller", false, result.reason));
      return { success: true, logs, override: result };
    }

    if (riskLevel === "HIGH" && riskScore >= HIGH_THRESHOLD) {
      const result: OverrideResult = {
        overrideGranted: true,
        reason: `Admin override granted for HIGH risk (score=${riskScore}) — below critical threshold`,
      };
      logs.push(logOverride("override-controller", true, result.reason));
      return { success: true, logs, override: result };
    }

    const result: OverrideResult = {
      overrideGranted: true,
      reason: `Admin override granted — riskLevel=${riskLevel} (score=${riskScore}) is within acceptable override range`,
    };
    logs.push(logOverride("override-controller", true, result.reason));
    return { success: true, logs, override: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(logEntry("override-controller", `ERROR: ${message}`));
    return { success: false, logs, error: message };
  }
}
