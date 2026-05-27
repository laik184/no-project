/** Fail-closed command safety validator. */

const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s+-rf?\b/i,
  /\bsudo\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\bpoweroff\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bwget\s+.*\|\s*(ba)?sh\b/i,
  /\bcurl\s+.*\|\s*(ba)?sh\b/i,
  /\beval\b.*base64/i,
  />\s*\/dev\/sd[a-z]/i,
  /\bchmod\s+777\b/i,
  /\bchown\s+-R\s+root\b/i,
  /\bpasswd\b/i,
  /\badduser\b/i,
  /\buseradd\b/i,
  /\bkill\s+-9\s+1\b/,
  /\/etc\/shadow/,
  /\/etc\/passwd/,
];

const ALLOWED_EXECUTABLES = new Set([
  'npm', 'npx', 'pnpm', 'node', 'tsc', 'tsx',
  'ls', 'cat', 'echo', 'mkdir', 'cp', 'mv', 'touch',
  'git', 'grep', 'find', 'which', 'env',
]);

export function isCommandSafe(command: string): boolean {
  if (!command || command.trim().length === 0) return false;

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) return false;
  }

  const executable = extractCommandName(command);
  if (!executable) return false;

  return ALLOWED_EXECUTABLES.has(executable);
}

export function extractCommandName(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}

export interface CommandValidationResult {
  safe:   boolean;
  reason: string;
}

export function validateShellCommand(command: string): CommandValidationResult {
  if (!command || command.trim().length === 0) {
    return { safe: false, reason: 'Empty command' };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `Blocked pattern: ${pattern.source}` };
    }
  }

  const executable = extractCommandName(command);
  if (!executable) {
    return { safe: false, reason: 'Cannot extract executable name' };
  }

  if (!ALLOWED_EXECUTABLES.has(executable)) {
    return { safe: false, reason: `Executable not in allowlist: ${executable}` };
  }

  return { safe: true, reason: 'ok' };
}
