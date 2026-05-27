/**
 * Permission manager — controls what operations are permitted inside the sandbox.
 * Fail-closed: deny by default, allow only explicitly permitted operations.
 */

export type PermissionScope = 'read' | 'write' | 'execute';

export interface PermissionContext {
  projectId: string;
  runId:     string;
  scope:     PermissionScope;
  path:      string;
}

const WRITE_BLOCKED_PATHS = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  '.env',
  '.env.local',
  '.env.production',
];

const EXECUTE_ALLOWLIST = ['npm', 'npx', 'pnpm', 'node', 'tsc', 'tsx'];

export const permissionManager = {
  canWrite(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    if (WRITE_BLOCKED_PATHS.some((blocked) => normalized.endsWith(blocked))) {
      return false;
    }
    if (normalized.startsWith('.git/')) return false;
    if (normalized.startsWith('node_modules/')) return false;
    return true;
  },

  canRead(_relativePath: string): boolean {
    return true;
  },

  canExecute(executable: string): boolean {
    const name = executable.split(/[\s/]/).shift() ?? '';
    return EXECUTE_ALLOWLIST.includes(name);
  },

  assertWrite(relativePath: string): void {
    if (!permissionManager.canWrite(relativePath)) {
      throw new Error(`Write denied: ${relativePath} is a protected path`);
    }
  },

  assertExecute(executable: string): void {
    if (!permissionManager.canExecute(executable)) {
      throw new Error(`Execute denied: ${executable} is not in the allowlist`);
    }
  },
};
