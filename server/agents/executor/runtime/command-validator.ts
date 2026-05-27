import { validateShellCommand } from '../validation/command-safety.ts';

export interface ValidatedCommand {
  executable: string;
  args:       string[];
  raw:        string;
}

const ALLOWED_COMMANDS: Record<string, string[]> = {
  npm:  ['install', 'run', 'test', 'build', 'ci', 'ls', 'audit'],
  npx:  [],
  pnpm: ['install', 'run', 'add', 'remove', 'build', 'test'],
  node: [],
  tsc:  ['--build', '--watch', '--noEmit', '--version'],
  tsx:  [],
  git:  ['status', 'log', 'diff', 'show'],
  ls:   [],
  mkdir:['-p'],
  echo: [],
  cat:  [],
};

export function validateCommand(command: string): ValidatedCommand {
  const check = validateShellCommand(command);
  if (!check.safe) {
    throw new Error(`Command blocked: ${check.reason} — "${command}"`);
  }

  const parts = command.trim().split(/\s+/);
  const executable = parts[0];
  const args       = parts.slice(1);

  if (!executable) {
    throw new Error('Cannot parse command: empty executable');
  }

  const allowedArgs = ALLOWED_COMMANDS[executable];
  if (allowedArgs !== undefined && allowedArgs.length > 0) {
    const firstArg = args[0];
    if (firstArg && !allowedArgs.includes(firstArg) && !firstArg.startsWith('-')) {
      throw new Error(
        `Subcommand '${firstArg}' not allowed for '${executable}'. Allowed: ${allowedArgs.join(', ')}`,
      );
    }
  }

  return { executable, args, raw: command };
}

export function isNpmInstall(command: string): boolean {
  return /^(npm|pnpm)\s+install\b/.test(command.trim());
}

export function isNpmRun(command: string): boolean {
  return /^(npm|pnpm)\s+run\s+\w+/.test(command.trim());
}
