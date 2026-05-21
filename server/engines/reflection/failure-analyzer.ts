/**
 * server/engines/reflection/failure-analyzer.ts
 * Classifies failure types from a verification report.
 * Single responsibility: analyze → FailureAnalysis. No side effects.
 */

import type { VerificationReport } from "../../verification/types.ts";
import type { FailureAnalysis, FailureType } from "./types.ts";

// ── Severity mapping ──────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<FailureType, "low" | "medium" | "high" | "critical"> = {
  typescript_error:    "high",
  runtime_crash:       "critical",
  missing_dependency:  "high",
  missing_file:        "medium",
  preview_unreachable: "medium",
  tool_misuse:         "low",
  repeated_strategy:   "medium",
  unknown:             "low",
};

function pickWorstSeverity(
  types: FailureType[],
): "low" | "medium" | "high" | "critical" {
  const order = ["low", "medium", "high", "critical"] as const;
  let worst: (typeof order)[number] = "low";
  for (const t of types) {
    const s = SEVERITY_MAP[t];
    if (order.indexOf(s) > order.indexOf(worst)) worst = s;
  }
  return worst;
}

// ── Check name → failure type ─────────────────────────────────────────────────

function classifyCheck(name: string, message: string): FailureType {
  if (name === "typescript_errors")  return "typescript_error";
  if (name === "package_install")    return "missing_dependency";
  if (name === "process_alive")      return "runtime_crash";
  if (name === "preview_http")       return "preview_unreachable";
  if (name === "runtime_logs") {
    if (/cannot find module/i.test(message)) return "missing_dependency";
    if (/enoent|no such file/i.test(message)) return "missing_file";
    if (/crash|killed|segfault/i.test(message)) return "runtime_crash";
  }
  return "unknown";
}

// ── Public API ────────────────────────────────────────────────────────────────

export function analyzeFailures(report: VerificationReport): FailureAnalysis {
  if (report.passed) {
    return {
      failureTypes: [],
      severity:     "low",
      summary:      "No failures detected.",
      details:      [],
    };
  }

  const failedChecks = report.checks.filter(c => c.status === "failed");
  const types = failedChecks.map(c => classifyCheck(c.name, c.message));
  const unique = [...new Set(types)] as FailureType[];
  const severity = pickWorstSeverity(unique);

  const details = failedChecks.map(
    c => `[${c.name}] ${c.message}${c.detail ? ` — ${c.detail}` : ""}`,
  );

  const summary = unique.length === 0
    ? "Verification failed with unknown cause."
    : `Detected: ${unique.join(", ")}`;

  return { failureTypes: unique, severity, summary, details };
}
