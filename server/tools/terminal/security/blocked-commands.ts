export interface BlockedPattern {
  pattern: RegExp;
  reason:  string;
}

export const BLOCKED_PATTERNS: BlockedPattern[] = [
  { pattern: /\brm\s+-rf\b/,               reason: 'recursive delete (rm -rf) is prohibited' },
  { pattern: /\bsudo\b/,                   reason: 'sudo elevation is prohibited' },
  { pattern: /\breboot\b|\bshutdown\b/,    reason: 'system control commands are prohibited' },
  { pattern: /curl\s+.*\|\s*(ba)?sh/,      reason: 'curl-pipe-shell pattern is prohibited' },
  { pattern: /wget\s+.*\|\s*(ba)?sh/,      reason: 'wget-pipe-shell pattern is prohibited' },
  { pattern: /\bchmod\s+777\b/,            reason: 'world-writable chmod is prohibited' },
  { pattern: /\bchown\b/,                  reason: 'chown is prohibited' },
  { pattern: /\bdd\s+if=/,                 reason: 'raw disk access (dd) is prohibited' },
  { pattern: />\s*\/dev\/(s?d[a-z])/,      reason: 'writing to raw devices is prohibited' },
  { pattern: /\bkillall\b|\bpkill\b/,      reason: 'mass process kill is prohibited' },
  { pattern: /\biptables\b|\bnft\b/,        reason: 'firewall manipulation is prohibited' },
  { pattern: /\beval\s+/,                  reason: 'eval execution is prohibited' },
  { pattern: /\bmkfs\b/,                   reason: 'filesystem creation is prohibited' },
  { pattern: /\bfdisk\b|\bparted\b/,       reason: 'disk partitioning is prohibited' },
];

export function isCommandBlocked(command: string): { blocked: boolean; reason?: string } {
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(command)) return { blocked: true, reason };
  }
  return { blocked: false };
}
