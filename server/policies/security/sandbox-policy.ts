/**
 * server/policies/security/sandbox-policy.ts
 * Validates that execution stays within sandbox constraints.
 * Single responsibility: sandbox boundary enforcement. No execution.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

const FORBIDDEN_COMMANDS: RegExp[] = [
  /rm\s+-rf\s+\//,                      // destroy root
  /sudo\s+(?:su|bash|sh|-s)/,           // privilege escalation
  /chmod\s+(?:777|a\+(?:rwx|x))/,       // world-executable
  /chown\s+root/,                        // root ownership change
  /mount\s+/,                            // filesystem mount
  /iptables|ufw\s+disable/,              // firewall manipulation
  /crontab\s+-[re]/,                     // cron modification
  /kill\s+-9\s+1\b/,                     // kill init/PID1
  />\s*\/(?:etc|proc|sys|dev)\//,        // redirect to system dirs
  /python.*-c.*(?:socket|subprocess)/,   // python reverse shell
  /perl\s+-e.*socket/,                   // perl reverse shell
];

const RESTRICTED_NETWORK_COMMANDS: RegExp[] = [
  /curl.*-o\s*\/(?:usr|bin|sbin)/,       // download to system dirs
  /wget.*-O\s*\/(?:usr|bin|sbin)/,
  /ssh\s+-[Ro]/,                         // port forwarding / tunneling
];

function checkForbidden(command: string): string | null {
  for (const pattern of FORBIDDEN_COMMANDS) {
    if (pattern.test(command)) return `Matches forbidden pattern: ${pattern.toString()}`;
  }
  return null;
}

function checkNetwork(command: string): string | null {
  for (const pattern of RESTRICTED_NETWORK_COMMANDS) {
    if (pattern.test(command)) return `Restricted network operation: ${pattern.toString()}`;
  }
  return null;
}

export function applySandboxPolicy(ctx: PolicyContext): PolicyResult {
  const command = ctx.command ?? (ctx.metadata?.command as string) ?? "";

  if (!command) {
    return {
      policy: "SafeExecutionPolicy",
      decision: "allow",
      severity: "low",
      reason: "No command to validate against sandbox policy.",
    };
  }

  const forbidden = checkForbidden(command);
  if (forbidden) {
    return {
      policy: "SafeExecutionPolicy",
      decision: "block",
      severity: "critical",
      reason: `Sandbox violation — ${forbidden}`,
      remediation: "This command is forbidden inside the isolated sandbox.",
    };
  }

  const networkIssue = checkNetwork(command);
  if (networkIssue) {
    return {
      policy: "SafeExecutionPolicy",
      decision: "block",
      severity: "high",
      reason: `Sandbox network restriction — ${networkIssue}`,
      remediation: "Network operations outside project scope are not permitted.",
    };
  }

  return {
    policy: "SafeExecutionPolicy",
    decision: "allow",
    severity: "low",
    reason: "Command passes sandbox policy checks.",
  };
}
