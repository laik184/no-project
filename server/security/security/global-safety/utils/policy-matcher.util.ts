import type { PolicyRule, RiskLevel } from "../types";

const SYSTEM_POLICIES: PolicyRule[] = [
  {
    id: "POL-001",
    name: "Destructive File Operation",
    pattern: /\b(rm\s+-rf|rmdir|unlink|truncate|shred|wipe)\b/i,
    riskLevel: "CRITICAL",
    description: "Destructive file system operations that cannot be undone",
    blockByDefault: true,
  },
  {
    id: "POL-002",
    name: "System Process Kill",
    pattern: /\b(kill\s+-9|killall|pkill|shutdown|halt|reboot|init\s+0)\b/i,
    riskLevel: "CRITICAL",
    description: "Commands that terminate processes or shut down the system",
    blockByDefault: true,
  },
  {
    id: "POL-003",
    name: "Credential or Secret Exposure",
    pattern: /\b(password|secret|api[_-]?key|private[_-]?key|token|auth[_-]?token|bearer)\s*[=:]/i,
    riskLevel: "HIGH",
    description: "Potential exposure of secrets or credentials in plain text",
    blockByDefault: true,
  },
  {
    id: "POL-004",
    name: "Mass Write Operation",
    pattern: /\b(write\s+all|overwrite\s+all|batch\s+write|mass\s+update|bulk\s+delete)\b/i,
    riskLevel: "HIGH",
    description: "Mass write or delete operations with broad scope",
    blockByDefault: true,
  },
  {
    id: "POL-005",
    name: "Infinite Loop Pattern",
    pattern: /\b(while\s*\(\s*true\s*\)|for\s*\(\s*;;\s*\)|loop\s+forever|infinite\s+loop)\b/i,
    riskLevel: "HIGH",
    description: "Patterns that may cause infinite execution loops",
    blockByDefault: true,
  },
  {
    id: "POL-006",
    name: "Unsafe Shell Execution",
    pattern: /\b(exec\s*\(|shell\s*\(|eval\s*\(|system\s*\(|popen\s*\(|subprocess\.call)\b/i,
    riskLevel: "HIGH",
    description: "Dynamic shell or system command execution",
    blockByDefault: true,
  },
  {
    id: "POL-007",
    name: "Database Drop or Truncate",
    pattern: /\b(drop\s+table|drop\s+database|truncate\s+table|delete\s+from\s+\w+\s*;?\s*$)\b/i,
    riskLevel: "CRITICAL",
    description: "Irreversible database destruction operations",
    blockByDefault: true,
  },
  {
    id: "POL-008",
    name: "Network Exfiltration",
    pattern: /\b(curl\s+.*\|\s*bash|wget\s+.*\|\s*sh|nc\s+-e|netcat\s+-e|base64\s+.*\|\s*bash)\b/i,
    riskLevel: "CRITICAL",
    description: "Potential data exfiltration or remote code execution via network",
    blockByDefault: true,
  },
  {
    id: "POL-009",
    name: "Permission Escalation",
    pattern: /\b(sudo\s+su|chmod\s+777|chown\s+root|setuid|setgid|sudo\s+bash|sudo\s+-i)\b/i,
    riskLevel: "CRITICAL",
    description: "Attempts to escalate system permissions",
    blockByDefault: true,
  },
  {
    id: "POL-010",
    name: "Sensitive Path Access",
    pattern: /\b(\/etc\/passwd|\/etc\/shadow|\/etc\/sudoers|\/proc\/self|\/sys\/kernel|\.ssh\/id_rsa)\b/i,
    riskLevel: "HIGH",
    description: "Access to sensitive system file paths",
    blockByDefault: true,
  },
];

export function getSystemPolicies(): readonly PolicyRule[] {
  return Object.freeze([...SYSTEM_POLICIES]);
}

export function matchPolicies(text: string): PolicyRule[] {
  return SYSTEM_POLICIES.filter((rule) => rule.pattern.test(text));
}

export function highestRiskLevel(levels: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  let max = 0;
  for (const level of levels) {
    const idx = order.indexOf(level);
    if (idx > max) max = idx;
  }
  return order[max] ?? "LOW";
}
