import { normalizePath, basename, extname, isAbsolutePath, resolvePath, relativePath as relPath } from './utils/path-utils.ts';
import { hasTraversal } from './utils/traversal-utils.ts';

// ── Access Policy ─────────────────────────────────────────────────────────────

export interface AccessPolicy {
  protectedPaths: string[];
  readOnlyPaths: string[];
  blockedExtensions: string[];
  blockedPatterns: RegExp[];
}

export const DEFAULT_POLICY: AccessPolicy = {
  protectedPaths: [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    '.env',
    '.env.local',
    '.env.production',
    '.gitignore',
    '.git',
  ],
  readOnlyPaths: ['node_modules'],
  blockedExtensions: ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.bash'],
  blockedPatterns: [
    /^\.git\//,
    /^node_modules\//,
    /\/\.git\//,
    /\/node_modules\//,
  ],
};

export function isProtectedPath(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const normalized = normalizePath(p);
  const name = basename(normalized);
  return policy.protectedPaths.some(
    pp => name === pp || normalized === pp || normalized.endsWith('/' + pp),
  );
}

export function isReadOnlyPath(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const normalized = normalizePath(p);
  return policy.readOnlyPaths.some(
    rp => normalized === rp || normalized.startsWith(rp + '/') || normalized.includes('/' + rp + '/'),
  );
}

export function isBlockedExtension(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const ext = extname(p).toLowerCase();
  return policy.blockedExtensions.includes(ext);
}

export function isBlockedByPattern(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  const normalized = normalizePath(p);
  return policy.blockedPatterns.some(re => re.test(normalized));
}

export function canWrite(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  if (isProtectedPath(p, policy)) return false;
  if (isReadOnlyPath(p, policy)) return false;
  if (isBlockedByPattern(p, policy)) return false;
  return true;
}

export function canDelete(p: string, policy: AccessPolicy = DEFAULT_POLICY): boolean {
  if (isProtectedPath(p, policy)) return false;
  if (isReadOnlyPath(p, policy)) return false;
  if (isBlockedByPattern(p, policy)) return false;
  return true;
}

export function canRead(_p: string, _policy: AccessPolicy = DEFAULT_POLICY): boolean {
  return true;
}

// ── Command Safety ────────────────────────────────────────────────────────────

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
  if (!command || !command.trim()) return { safe: false, reason: 'Empty command' };
  const trimmed = command.trim();
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) return { safe: false, reason };
  }
  const binary = trimmed.split(/\s+/)[0].replace(/^.*\//, '');
  if (!ALLOWED_COMMANDS.has(binary)) {
    return { safe: false, reason: `Command "${binary}" is not in the allowed list` };
  }
  return { safe: true };
}

export function validateShellCommand(command: string): void {
  const result = isCommandSafe(command);
  if (!result.safe) throw new UnsafeCommandError(result.reason!, command);
}

export function getAllowedCommands(): string[] {
  return Array.from(ALLOWED_COMMANDS).sort();
}

// ── Operation Guard ───────────────────────────────────────────────────────────

export class DangerousOperationError extends Error {
  constructor(message: string, public readonly operation: string, public readonly path: string) {
    super(`[operation-guard] Blocked dangerous ${operation}: ${message} (path: "${path}")`);
    this.name = 'DangerousOperationError';
  }
}

const ROOT_PATHS = ['/', '/home', '/usr', '/etc', '/bin', '/root', '/var', '/tmp', '/proc', '/sys'];
const MAX_BULK_DELETE = 100;

export function guardDelete(p: string): void {
  const normalized = normalizePath(p);
  if (ROOT_PATHS.includes(normalized)) {
    throw new DangerousOperationError('Cannot delete root or critical system path', 'delete', p);
  }
  if (normalized === '.' || normalized === '') {
    throw new DangerousOperationError('Cannot delete working directory', 'delete', p);
  }
  if (hasTraversal(p)) {
    throw new DangerousOperationError('Traversal detected in delete path', 'delete', p);
  }
}

export function guardWrite(p: string, content?: string): void {
  if (hasTraversal(p)) {
    throw new DangerousOperationError('Traversal detected in write path', 'write', p);
  }
  if (isAbsolutePath(p)) {
    throw new DangerousOperationError('Absolute path writes are not allowed', 'write', p);
  }
  if (content !== undefined && content.length > 10 * 1024 * 1024) {
    throw new DangerousOperationError('Content too large (>10 MB)', 'write', p);
  }
}

export function guardMove(src: string, dest: string): void {
  if (hasTraversal(src)) {
    throw new DangerousOperationError('Traversal detected in source path', 'move', src);
  }
  if (hasTraversal(dest)) {
    throw new DangerousOperationError('Traversal detected in destination path', 'move', dest);
  }
  if (isAbsolutePath(dest)) {
    throw new DangerousOperationError('Cannot move to absolute path outside sandbox', 'move', dest);
  }
}

export function guardRename(oldPath: string, newName: string): void {
  if (newName.includes('/') || newName.includes('\\')) {
    throw new DangerousOperationError('New name must not contain path separators', 'rename', newName);
  }
  if (newName === '.' || newName === '..') {
    throw new DangerousOperationError('Invalid rename target', 'rename', newName);
  }
  if (hasTraversal(oldPath)) {
    throw new DangerousOperationError('Traversal detected in rename source', 'rename', oldPath);
  }
}

export function guardBulkDelete(paths: string[]): void {
  if (paths.length > MAX_BULK_DELETE) {
    throw new DangerousOperationError(
      `Bulk delete exceeds maximum of ${MAX_BULK_DELETE} files`,
      'bulk-delete',
      `[${paths.length} paths]`,
    );
  }
  paths.forEach(p => guardDelete(p));
}

// ── Permission Manager ────────────────────────────────────────────────────────

export class PermissionDeniedError extends Error {
  constructor(operation: string, path: string, reason: string) {
    super(`[permission-manager] ${operation} denied for "${path}": ${reason}`);
    this.name = 'PermissionDeniedError';
  }
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export class PermissionManager {
  constructor(private readonly policy: AccessPolicy = DEFAULT_POLICY) {}

  checkWrite(path: string, content?: string): PermissionCheckResult {
    if (!canWrite(path, this.policy)) {
      return { allowed: false, reason: 'Path is protected or read-only' };
    }
    try {
      guardWrite(path, content);
    } catch (err) {
      return { allowed: false, reason: (err as Error).message };
    }
    return { allowed: true };
  }

  assertWrite(path: string, content?: string): void {
    const result = this.checkWrite(path, content);
    if (!result.allowed) throw new PermissionDeniedError('write', path, result.reason!);
  }

  checkDelete(path: string): PermissionCheckResult {
    if (!canDelete(path, this.policy)) {
      return { allowed: false, reason: 'Path is protected or read-only' };
    }
    try {
      guardDelete(path);
    } catch (err) {
      return { allowed: false, reason: (err as Error).message };
    }
    return { allowed: true };
  }

  assertDelete(path: string): void {
    const result = this.checkDelete(path);
    if (!result.allowed) throw new PermissionDeniedError('delete', path, result.reason!);
  }

  checkRead(path: string): PermissionCheckResult {
    if (!canRead(path, this.policy)) {
      return { allowed: false, reason: 'Read access denied' };
    }
    return { allowed: true };
  }

  assertRead(path: string): void {
    const result = this.checkRead(path);
    if (!result.allowed) throw new PermissionDeniedError('read', path, result.reason!);
  }

  checkMove(src: string, dest: string): PermissionCheckResult {
    if (!canDelete(src, this.policy)) {
      return { allowed: false, reason: 'Source path is protected' };
    }
    if (!canWrite(dest, this.policy)) {
      return { allowed: false, reason: 'Destination path is protected' };
    }
    try {
      guardMove(src, dest);
    } catch (err) {
      return { allowed: false, reason: (err as Error).message };
    }
    return { allowed: true };
  }

  assertMove(src: string, dest: string): void {
    const result = this.checkMove(src, dest);
    if (!result.allowed) throw new PermissionDeniedError('move', `${src} → ${dest}`, result.reason!);
  }

  checkRename(path: string, newName: string): PermissionCheckResult {
    if (!canDelete(path, this.policy)) {
      return { allowed: false, reason: 'Path is protected' };
    }
    try {
      guardRename(path, newName);
    } catch (err) {
      return { allowed: false, reason: (err as Error).message };
    }
    return { allowed: true };
  }

  assertRename(path: string, newName: string): void {
    const result = this.checkRename(path, newName);
    if (!result.allowed) throw new PermissionDeniedError('rename', path, result.reason!);
  }
}

export const permissionManager = new PermissionManager();
