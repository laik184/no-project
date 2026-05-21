/**
 * server/policies/execution/safe-execution-policy.ts
 * Blocks dangerous shell commands from being executed.
 * Single responsibility: command safety enforcement. No side effects.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+\/(?!\w)/,        // rm -rf /
  /chmod\s+777/,                 // world-writable permissions
  /curl.*\|\s*(?:bash|sh|zsh)/,  // curl-pipe-execute
  /wget.*\|\s*(?:bash|sh|zsh)/,  // wget-pipe-execute
  />\s*\/etc\/(?:passwd|shadow)/, // overwrite system files
  /dd\s+if=.*of=\/dev/,          // disk write
  /mkfs/,                        // filesystem format
  /shutdown|reboot|halt/,        // system shutdown
  /sudo\s+su|sudo\s+-s/,        // privilege escalation
  /nc\s+-e|netcat.*-e/,         // netcat reverse shell
  /base64.*\|\s*(?:bash|sh)/,   // encoded payload execution
];

const HIGH_RISK_COMMANDS = [
  /npm\s+publish/,
  /git\s+push\s+--force/,
  /npx\s+--yes/,
  /rm\s+-rf/,
];

export function applySafeExecutionPolicy(ctx: PolicyContext): PolicyResult {
  const command = ctx.command ?? ctx.metadata?.command as string ?? "";

  if (!command) {
    return { policy: "SafeExecutionPolicy", decision: "allow", severity: "low", reason: "No command in context." };
  }

  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return {
        policy:   "SafeExecutionPolicy",
        decision: "block",
        severity: "critical",
        reason:   `Command blocked — matches dangerous pattern: ${pattern}`,
        remediation: "Do not execute system-destructive commands.",
      };
    }
  }

  for (const pattern of HIGH_RISK_COMMANDS) {
    if (pattern.test(command)) {
      return {
        policy:   "SafeExecutionPolicy",
        decision: "escalate",
        severity: "high",
        reason:   `High-risk command detected: "${command.slice(0, 60)}"`,
        remediation: "Confirm with user before executing this command.",
      };
    }
  }

  return { policy: "SafeExecutionPolicy", decision: "allow", severity: "low", reason: "Command is safe." };
}
