export class UnsafeCommandError extends Error {
  constructor(message: string, public readonly command: string) {
    super(`[command-safety] Blocked unsafe command: ${message} — "${command}"`);
    this.name = 'UnsafeCommandError';
  }
}

export interface CommandValidationResult {
  safe: boolean;
  reason?: string;
}

const ALLOWED_COMMANDS = new Set([
  'node', 'npm', 'npx', 'pnpm', 'yarn',
  'tsc', 'tsx', 'ts-node',
  'git',
  'ls', 'cat', 'echo', 'pwd', 'find', 'grep', 'wc',
  'mkdir', 'cp', 'mv',
  'python', 'python3', 'pip', 'pip3',
  'go', 'cargo', 'rustc',
  'curl', 'wget',
  'which', 'env', 'printenv',
  'test', 'true', 'false',
]);

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /rm\s+-rf?\s+\//, reason: 'Recursive delete of root or system path' },
  { pattern: />\s*\/dev\/sd/, reason: 'Writing to raw block device' },
  { pattern: /curl.*\|\s*(?:bash|sh|zsh)/, reason: 'Curl-pipe-to-shell attack vector' },
  { pattern: /wget.*\|\s*(?:bash|sh|zsh)/, reason: 'Wget-pipe-to-shell attack vector' },
  { pattern: /\bdd\s+if=/, reason: 'Raw disk access via dd' },
  { pattern: /chmod\s+[0-7]*7[0-7]*\s+\//, reason: 'Setting world-writable permissions on system path' },
  { pattern: /chown\s+root/, reason: 'Changing ownership to root' },
  { pattern: /sudo\s+rm/, reason: 'Privileged delete' },
  { pattern: /mkfs\./, reason: 'Filesystem formatting' },
  { pattern: />\s*\/etc\//, reason: 'Writing to /etc directly' },
  { pattern: /eval\s+\$\(/, reason: 'Command injection via eval' },
  { pattern: /base64\s+.*\|\s*(?:bash|sh)/, reason: 'Encoded command execution' },
];

export function isCommandSafe(command: string): CommandValidationResult {
  if (!command || !command.trim()) {
    return { safe: false, reason: 'Empty command' };
  }

  const trimmed = command.trim();

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason };
    }
  }

  const binary = trimmed.split(/\s+/)[0].replace(/^.*\//, '');
  if (!ALLOWED_COMMANDS.has(binary)) {
    return { safe: false, reason: `Command "${binary}" is not in the allowed list` };
  }

  return { safe: true };
}

export function validateShellCommand(command: string): void {
  const result = isCommandSafe(command);
  if (!result.safe) {
    throw new UnsafeCommandError(result.reason!, command);
  }
}

export function getAllowedCommands(): string[] {
  return Array.from(ALLOWED_COMMANDS).sort();
}
