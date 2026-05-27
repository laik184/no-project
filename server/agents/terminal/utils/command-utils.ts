import type { ValidatedCommand } from '../types/execution.types.ts';

export function parseCommand(command: string): ValidatedCommand {
  const parts = command.trim().split(/\s+/);
  const executable = parts[0];
  if (!executable) throw new Error('Empty command string');
  return { executable, args: parts.slice(1), raw: command };
}

export function isNpmInstall(command: string): boolean {
  return /^(npm|pnpm)\s+install\b/.test(command.trim());
}

export function isNpmRun(command: string): boolean {
  return /^(npm|pnpm)\s+run\s+\w+/.test(command.trim());
}

export function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

export function extractPackageNames(command: string): string[] {
  const parts = command.trim().split(/\s+/);
  const installIdx = parts.findIndex((p) => p === 'install' || p === 'add');
  if (installIdx === -1) return [];
  return parts.slice(installIdx + 1).filter((p) => !p.startsWith('-'));
}

export function buildNpmCommand(packages: string[], dev: boolean): string {
  const flag = dev ? ' --save-dev' : '';
  return packages.length > 0
    ? `npm install ${packages.join(' ')}${flag}`
    : 'npm install';
}
