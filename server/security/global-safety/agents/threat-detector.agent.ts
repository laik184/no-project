import type { ThreatReport, RiskLevel } from "../types";
import { logEntry, logThreat } from "../utils/log-builder.util";

export interface ThreatDetectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  report?: ThreatReport;
}

const THREAT_PATTERNS: Array<{ label: string; pattern: RegExp; severity: RiskLevel }> = [
  { label: "recursive deletion",       pattern: /\brm\s+-rf\b/i,                          severity: "CRITICAL" },
  { label: "system shutdown",          pattern: /\b(shutdown|halt|poweroff|reboot)\b/i,    severity: "CRITICAL" },
  { label: "process kill",             pattern: /\b(kill\s+-9|killall|pkill)\b/i,          severity: "CRITICAL" },
  { label: "drop database",            pattern: /\b(drop\s+(table|database|schema))\b/i,   severity: "CRITICAL" },
  { label: "permission escalation",    pattern: /\b(sudo\s+su|sudo\s+bash|sudo\s+-i)\b/i,  severity: "CRITICAL" },
  { label: "chmod 777",                pattern: /\bchmod\s+777\b/i,                        severity: "CRITICAL" },
  { label: "remote code execution",    pattern: /\|\s*(bash|sh|zsh|ksh)/i,                severity: "CRITICAL" },
  { label: "credential in plaintext",  pattern: /\b(password|secret|api[_-]?key)\s*[=:]/i, severity: "HIGH"  },
  { label: "shell eval",               pattern: /\beval\s*\(/i,                            severity: "HIGH"   },
  { label: "dynamic exec",             pattern: /\b(exec|system|popen)\s*\(/i,             severity: "HIGH"   },
  { label: "infinite loop",            pattern: /\bwhile\s*\(\s*true\s*\)/i,               severity: "HIGH"   },
  { label: "mass delete",              pattern: /\b(bulk|mass)\s+(delete|drop|purge)\b/i,  severity: "HIGH"   },
  { label: "sensitive path access",    pattern: /\/etc\/(passwd|shadow|sudoers)/i,         severity: "HIGH"   },
  { label: "data exfiltration",        pattern: /\bnc\s+-e\b|\bnetcat\s+-e\b/i,            severity: "HIGH"   },
  { label: "environment variable dump",pattern: /\bprintenv\b|\benv\b\s*>/i,               severity: "MEDIUM" },
  { label: "overwrite all",            pattern: /\boverwrite\s+all\b/i,                    severity: "MEDIUM" },
  { label: "disable logging",          pattern: /\b(disable|turn.?off)\s+(log|audit|monitor)/i, severity: "MEDIUM" },
  { label: "bypass safety check",      pattern: /\b(bypass|skip|ignore)\s+(safety|guard|check|policy)/i, severity: "MEDIUM" },
];

function highestSeverity(severities: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  let max = 0;
  for (const s of severities) {
    const idx = order.indexOf(s);
    if (idx > max) max = idx;
  }
  return order[max] ?? "LOW";
}

export function detectThreats(action: string, context = ""): ThreatDetectorOutput {
  const logs: string[] = [];
  try {
    const combined = `${action} ${context}`;
    logs.push(logEntry("threat-detector", `scanning ${combined.length} chars`));

    const matched: Array<{ label: string; severity: RiskLevel }> = [];
    const matchedPatterns: string[] = [];

    for (const { label, pattern, severity } of THREAT_PATTERNS) {
      if (pattern.test(combined)) {
        matched.push({ label, severity });
        matchedPatterns.push(label);
        logs.push(logThreat("threat-detector", label, severity));
      }
    }

    const detected = matched.length > 0;
    const severity = detected
      ? highestSeverity(matched.map((m) => m.severity))
      : "LOW";

    logs.push(logEntry("threat-detector", `scan complete — threats=${matched.length} severity=${severity}`));

    return {
      success: true,
      logs,
      report: {
        detected,
        threats: matched.map((m) => m.label),
        severity,
        matchedPatterns,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(logEntry("threat-detector", `ERROR: ${message}`));
    return { success: false, logs, error: message };
  }
}
