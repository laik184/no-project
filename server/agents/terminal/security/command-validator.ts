import type { ValidatedCommand, ValidationResult } from '../types/execution.types.ts';
import { parseCommand } from '../utils/command-utils.ts';
import { checkCommandSafety } from './command-safety.ts';

const ALLOWED_EXECUTABLES: Record<string, string[] | null> = {
  npm:   ['install', 'run', 'test', 'build', 'ci', 'ls', 'audit', 'init'],
  npx:   null,
  pnpm:  ['install', 'run', 'add', 'remove', 'build', 'test', 'init'],
  node:  null,
  tsx:   null,
  tsc:   ['--build', '--watch', '--noEmit', '--version'],
  git:   ['status', 'log', 'diff', 'show', 'branch'],
  ls:    null,
  mkdir: null,
  echo:  null,
  cat:   null,
};

export function validateCommand(command: string): ValidatedCommand {
  const safety = checkCommandSafety(command);
  if (!safety.allowed) {
    throw new Error(`[command-validator] Blocked: ${safety.reason} — "${command}"`);
  }

  const parsed = parseCommand(command);

  if (!(parsed.executable in ALLOWED_EXECUTABLES)) {
    throw new Error(
      `[command-validator] Executable not whitelisted: "${parsed.executable}"`,
    );
  }

  const allowedSubcmds = ALLOWED_EXECUTABLES[parsed.executable];
  if (allowedSubcmds !== null && allowedSubcmds.length > 0 && parsed.args.length > 0) {
    const sub = parsed.args[0];
    if (!sub.startsWith('-') && !allowedSubcmds.includes(sub)) {
      throw new Error(
        `[command-validator] Subcommand "${sub}" not allowed for "${parsed.executable}". Allowed: ${allowedSubcmds.join(', ')}`,
      );
    }
  }

  return parsed;
}

export function validateCommandSafe(command: string): ValidationResult {
  try {
    validateCommand(command);
    return { valid: true, errors: [], warnings: [] };
  } catch (err: any) {
    return { valid: false, errors: [err.message], warnings: [] };
  }
}
