import type { PolicyDecision } from '../types/execution.types.ts';

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+-rf\b/,                   reason: 'recursive delete (rm -rf) is prohibited' },
  { pattern: /\bsudo\b/,                        reason: 'sudo elevation is prohibited' },
  { pattern: /\breboot\b|\bshutdown\b/,         reason: 'system control commands are prohibited' },
  { pattern: /curl\s+.*\|\s*(ba)?sh/,           reason: 'curl-pipe-shell pattern is prohibited' },
  { pattern: /wget\s+.*\|\s*(ba)?sh/,           reason: 'wget-pipe-shell pattern is prohibited' },
  { pattern: /\bchmod\s+777\b/,                 reason: 'world-writable chmod is prohibited' },
  { pattern: /\bchown\b/,                       reason: 'chown is prohibited' },
  { pattern: /\bdd\s+if=/,                      reason: 'raw disk access (dd) is prohibited' },
  { pattern: />\s*\/dev\/(s?d[a-z]|null\s*&&)/, reason: 'writing to raw devices is prohibited' },
  { pattern: /\bkillall\b|\bpkill\b/,           reason: 'mass process kill is prohibited' },
  { pattern: /\biptables\b|\bnft\b/,            reason: 'firewall manipulation is prohibited' },
  { pattern: /\beval\s+/,                       reason: 'eval execution is prohibited' },
];

export function checkCommandSafety(command: string): PolicyDecision {
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { allowed: false, reason };
    }
  }
  return { allowed: true };
}

export function containsShellMeta(command: string): boolean {
  return /[;&|`$(){}[\]<>]/.test(command);
}

export function isReadOnlyGit(command: string): boolean {
  return /^git\s+(status|log|diff|show|branch)\b/.test(command.trim());
}
