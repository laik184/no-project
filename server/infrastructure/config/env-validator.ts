/**
 * Responsibility: Validates required and recommended environment variables at
 *                 server startup. Emits actionable warnings to logs and the
 *                 telemetry bus. Single responsibility: env-var validation only.
 * Dependencies: bus
 * Failure: warns on missing optional vars; never throws — callers decide severity.
 * Telemetry: emits env.validated / env.missing on boot.
 */

import { bus } from "../events/bus.ts";

// ── Checks ────────────────────────────────────────────────────────────────────

interface EnvCheck {
  readonly key:      string;
  readonly severity: "critical" | "warn";
  readonly howToFix: string;
}

const CHECKS: EnvCheck[] = [
  {
    key:      "OPENROUTER_API_KEY",
    severity: "warn",
    howToFix: "Add OPENROUTER_API_KEY in Replit Secrets, or use the Replit AI Integrations "
            + "(AI_INTEGRATIONS_OPENROUTER_API_KEY is set automatically when the OpenRouter "
            + "integration is active).",
  },
  {
    key:      "REDIS_URL",
    severity: "warn",
    howToFix: "Go to Replit Secrets and add REDIS_URL=redis://<host>:<port>. "
            + "Without it all distributed systems (BullMQ, pub/sub, locks, "
            + "barriers, aggregation persistence) run in single-node in-process "
            + "mode. Use Upstash free tier (https://upstash.com) for zero-cost "
            + "Redis in Replit.",
  },
];

// ── Result ────────────────────────────────────────────────────────────────────

export interface EnvValidationResult {
  /** true when no CRITICAL vars are missing */
  valid:           boolean;
  missingCritical: string[];
  missingWarn:     string[];
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function validateEnv(): EnvValidationResult {
  const missingCritical: string[] = [];
  const missingWarn:     string[] = [];

  for (const check of CHECKS) {
    const present = !!(process.env[check.key]?.trim());
    if (present) continue;

    if (check.severity === "critical") {
      missingCritical.push(check.key);
      console.error(
        `[env-validator] ❌ CRITICAL — ${check.key} is not set.\n`
        + `               → ${check.howToFix}`,
      );
    } else {
      missingWarn.push(check.key);
      console.warn(
        `[env-validator] ⚠️  MISSING  — ${check.key} is not set.\n`
        + `               → ${check.howToFix}`,
      );
    }
  }

  const result: EnvValidationResult = {
    valid:           missingCritical.length === 0,
    missingCritical,
    missingWarn,
  };

  if (missingCritical.length === 0 && missingWarn.length === 0) {
    console.log("[env-validator] ✅ All environment variables validated.");
  }

  emitResult(result);
  return result;
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emitResult(r: EnvValidationResult): void {
  try {
    bus.emit("agent.event", {
      runId:     "system",
      projectId: 0,
      phase:     "startup.env-validation",
      agentName: "env-validator",
      eventType: r.valid ? ("env.validated" as any) : ("env.invalid" as any),
      payload: {
        missingCritical: r.missingCritical,
        missingWarn:     r.missingWarn,
      },
      ts: Date.now(),
    });
  } catch { /* bus may not be ready at earliest startup */ }
}
