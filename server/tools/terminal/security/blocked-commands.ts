/**
 * server/tools/terminal/security/blocked-commands.ts
 *
 * Production-grade command safety checks.
 *
 * TWO validation layers:
 *   1. isCommandBlocked(rawString)  — fast regex pre-check on raw input
 *   2. isArgsBlocked(parsedArgs[])  — thorough check on parsed arg tokens
 *
 * Always call BOTH — use parsed args whenever available
 * (after parseShellArgs()) for complete protection.
 */

export interface BlockedPattern {
  pattern: RegExp;
  reason:  string;
}

// ── Layer 1: raw-string regex checks ─────────────────────────────────────────
// Catches obvious injections before full parsing. Not exhaustive on its own.

export const BLOCKED_PATTERNS: BlockedPattern[] = [
  { pattern: /\bsudo\b/,                   reason: 'sudo elevation is prohibited' },
  { pattern: /\breboot\b|\bshutdown\b/,    reason: 'system control commands are prohibited' },
  { pattern: /curl\s+.*\|\s*(ba)?sh/,      reason: 'curl-pipe-shell pattern is prohibited' },
  { pattern: /wget\s+.*\|\s*(ba)?sh/,      reason: 'wget-pipe-shell pattern is prohibited' },
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

// ── Layer 2: parsed-args checks ───────────────────────────────────────────────
// Called AFTER parseShellArgs() for complete protection.
// Catches `rm -r -f`, `rm --recursive`, and other flag-split variants
// that naive regex cannot detect.

const DANGEROUS_RM_FLAGS = new Set([
  '-r', '-R', '--recursive',
  '-f', '--force',
]);

// Any combination of recursive + force on `rm` is blocked
const FORCE_FLAGS    = new Set(['-f', '--force']);
const RECURSIVE_FLAGS = new Set(['-r', '-R', '--recursive']);

export function isArgsBlocked(args: string[]): { blocked: boolean; reason?: string } {
  if (args.length === 0) return { blocked: false };

  const [exe, ...rest] = args;
  const cmd = exe.toLowerCase();

  // rm with any dangerous flag
  if (cmd === 'rm') {
    const flags = rest.filter(a => a.startsWith('-'));
    const hasForce     = flags.some(f => FORCE_FLAGS.has(f));
    const hasRecursive = flags.some(f => RECURSIVE_FLAGS.has(f));

    if (hasForce && hasRecursive) {
      return { blocked: true, reason: 'recursive + force delete (rm -rf equivalent) is prohibited' };
    }
    // Also block combined short flags like -rf, -fr, -Rf
    const combinedFlags = flags.filter(f => /^-[a-zA-Z]{2,}$/.test(f));
    for (const flag of combinedFlags) {
      const chars = flag.slice(1).split('');
      if (chars.includes('f') && (chars.includes('r') || chars.includes('R'))) {
        return { blocked: true, reason: 'recursive + force delete (rm -rf equivalent) is prohibited' };
      }
    }
    // Block standalone --recursive on rm as it can still cause damage
    if (hasRecursive && rest.includes('/') || rest.some(a => a === '/' || a === '~' || a === '.')) {
      return { blocked: true, reason: 'recursive delete on root/home/current directory is prohibited' };
    }
  }

  // chmod 777 / world-writable
  if (cmd === 'chmod') {
    const modeArg = rest.find(a => !a.startsWith('-'));
    if (modeArg && /^[0-9]{3,4}$/.test(modeArg)) {
      const others = parseInt(modeArg.slice(-1), 8);
      if (others >= 6) {
        return { blocked: true, reason: 'world-writable or world-executable chmod is prohibited' };
      }
    }
    if (modeArg && /a\+w|o\+w|ugo\+w/.test(modeArg)) {
      return { blocked: true, reason: 'world-writable chmod is prohibited' };
    }
  }

  // sudo in parsed args (catches `sudo -u root npm ...` variants)
  if (cmd === 'sudo') {
    return { blocked: true, reason: 'sudo elevation is prohibited' };
  }

  return { blocked: false };
}

// ── Combined check ────────────────────────────────────────────────────────────

export function validateCommand(
  rawCommand: string,
  parsedArgs: string[],
): { blocked: boolean; reason?: string } {
  const raw = isCommandBlocked(rawCommand);
  if (raw.blocked) return raw;
  return isArgsBlocked(parsedArgs);
}
