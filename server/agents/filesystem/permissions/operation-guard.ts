import { normalizePath, isAbsolutePath } from '../utils/path-utils.ts';
import { hasTraversal } from '../utils/traversal-utils.ts';

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
