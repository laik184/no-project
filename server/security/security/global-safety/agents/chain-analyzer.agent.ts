import type { ChainRisk } from "../types";
import { logEntry } from "../utils/log-builder.util";
import { clamp, chainLengthPenalty } from "../utils/risk-score.util";

export interface ChainAnalyzerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  chainRisk?: ChainRisk;
}

const RISKY_STEP_PATTERNS: Array<{ label: string; pattern: RegExp; weight: number }> = [
  { label: "delete step",        pattern: /\b(delete|drop|remove|destroy|purge)\b/i, weight: 20 },
  { label: "write step",         pattern: /\b(write|overwrite|update|insert|replace)\b/i, weight: 10 },
  { label: "exec step",          pattern: /\b(exec|run|execute|invoke|call)\b/i,     weight: 8  },
  { label: "auth step",          pattern: /\b(login|auth|authenticate|sudo|su)\b/i,  weight: 12 },
  { label: "network step",       pattern: /\b(send|upload|post|fetch|curl|wget)\b/i, weight: 8  },
  { label: "permission step",    pattern: /\b(chmod|chown|setuid|grant|revoke)\b/i,  weight: 15 },
  { label: "secret access step", pattern: /\b(secret|key|token|password|cred)\b/i,  weight: 12 },
  { label: "irreversible step",  pattern: /\b(permanent|irreversible|no.?undo|no.?rollback)\b/i, weight: 25 },
];

function scoreStep(step: string): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];
  for (const { label, pattern, weight } of RISKY_STEP_PATTERNS) {
    if (pattern.test(step)) {
      score += weight;
      flags.push(label);
    }
  }
  return { score, flags };
}

export function analyzeChain(chain: string[]): ChainAnalyzerOutput {
  const logs: string[] = [];
  try {
    logs.push(logEntry("chain-analyzer", `analyzing ${chain.length} step(s)`));

    if (chain.length === 0) {
      logs.push(logEntry("chain-analyzer", "no chain steps — risk=0"));
      return {
        success: true,
        logs,
        chainRisk: { hasCompoundingRisk: false, compoundScore: 0, flaggedSteps: [], reason: "No chain steps provided" },
      };
    }

    const flaggedSteps: string[] = [];
    let rawScore = chainLengthPenalty(chain.length);
    let prevWasRisky = false;

    for (let i = 0; i < chain.length; i++) {
      const step = chain[i] ?? "";
      const { score, flags } = scoreStep(step);
      if (flags.length > 0) {
        flaggedSteps.push(`step[${i}]: ${flags.join(", ")}`);
        logs.push(logEntry("chain-analyzer", `step[${i}] flags=${flags.join(",")} score+=${score}`));
        // Compounding: consecutive risky steps add extra penalty
        if (prevWasRisky) rawScore += Math.round(score * 0.5);
        rawScore += score;
        prevWasRisky = true;
      } else {
        prevWasRisky = false;
      }
    }

    const compoundScore = clamp(rawScore, 0, 100);
    const hasCompoundingRisk = flaggedSteps.length >= 2 || compoundScore > 30;
    const reason = flaggedSteps.length === 0
      ? "No risky steps detected in chain"
      : `${flaggedSteps.length} risky step(s) detected with compound score ${compoundScore}`;

    logs.push(logEntry("chain-analyzer", `complete — compoundScore=${compoundScore} hasRisk=${hasCompoundingRisk}`));

    return {
      success: true,
      logs,
      chainRisk: { hasCompoundingRisk, compoundScore, flaggedSteps, reason },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(logEntry("chain-analyzer", `ERROR: ${message}`));
    return { success: false, logs, error: message };
  }
}
