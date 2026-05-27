import { canWrite, canDelete, canRead, DEFAULT_POLICY, type AccessPolicy } from './access-policy.ts';
import { guardWrite, guardDelete, guardMove, guardRename } from './operation-guard.ts';

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
