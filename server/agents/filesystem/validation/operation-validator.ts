/**
 * server/agents/filesystem/validation/operation-validator.ts
 *
 * Validates filesystem operation requests at the agent boundary.
 * Catches malformed requests, invalid state, and missing context
 * before any dispatch reaches the tool layer.
 */

import type {
  FilesystemOperationRequest,
  FilesystemExecutionContext,
  ReadOperationRequest,
  WriteOperationRequest,
  PatchOperationRequest,
  DeleteOperationRequest,
  SearchOperationRequest,
} from '../types/filesystem.types.ts';

// ── Error type ────────────────────────────────────────────────────────────────

export class OperationValidationError extends Error {
  constructor(message: string) {
    super(`[operation-validator] ${message}`);
    this.name = 'OperationValidationError';
  }
}

// ── Validation result ─────────────────────────────────────────────────────────

export interface OperationValidationResult {
  ok:      boolean;
  reason?: string;
}

// ── Context validation ────────────────────────────────────────────────────────

export function validateContext(ctx: FilesystemExecutionContext): OperationValidationResult {
  if (!ctx.runId?.trim())       return { ok: false, reason: 'runId is missing or empty.' };
  if (!ctx.projectId?.trim())   return { ok: false, reason: 'projectId is missing or empty.' };
  if (!ctx.sandboxRoot?.trim()) return { ok: false, reason: 'sandboxRoot is missing or empty.' };
  if (!ctx.sessionId?.trim())   return { ok: false, reason: 'sessionId is missing or empty.' };
  return { ok: true };
}

// ── Per-kind validators ───────────────────────────────────────────────────────

function validateRead(req: ReadOperationRequest): OperationValidationResult {
  if (!req.path?.trim()) return { ok: false, reason: 'read: path is required.' };
  if (req.startLine !== undefined && req.startLine < 1) {
    return { ok: false, reason: 'read: startLine must be >= 1.' };
  }
  if (req.endLine !== undefined && req.startLine !== undefined && req.endLine < req.startLine) {
    return { ok: false, reason: 'read: endLine must be >= startLine.' };
  }
  return { ok: true };
}

function validateWrite(req: WriteOperationRequest): OperationValidationResult {
  if (!req.path?.trim())           return { ok: false, reason: 'write: path is required.' };
  if (req.content === undefined)   return { ok: false, reason: 'write: content is required.' };
  return { ok: true };
}

function validatePatch(req: PatchOperationRequest): OperationValidationResult {
  if (!req.path?.trim())          return { ok: false, reason: 'patch: path is required.' };
  if (!Array.isArray(req.hunks))  return { ok: false, reason: 'patch: hunks must be an array.' };
  if (req.hunks.length === 0)     return { ok: false, reason: 'patch: hunks must not be empty.' };
  for (const hunk of req.hunks) {
    if (typeof hunk.oldText !== 'string') return { ok: false, reason: 'patch: each hunk must have oldText.' };
    if (typeof hunk.newText !== 'string') return { ok: false, reason: 'patch: each hunk must have newText.' };
  }
  return { ok: true };
}

function validateDelete(req: DeleteOperationRequest): OperationValidationResult {
  if (!req.path?.trim() && (!req.multiple || req.multiple.length === 0)) {
    return { ok: false, reason: 'delete: path or multiple paths are required.' };
  }
  return { ok: true };
}

function validateSearch(req: SearchOperationRequest): OperationValidationResult {
  if (!req.query?.trim())      return { ok: false, reason: 'search: query is required.' };
  if (!req.searchKind)         return { ok: false, reason: 'search: searchKind is required.' };
  return { ok: true };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function validateOperation(
  req: FilesystemOperationRequest,
): OperationValidationResult {
  switch (req.kind) {
    case 'read':   return validateRead(req);
    case 'write':  return validateWrite(req);
    case 'patch':  return validatePatch(req);
    case 'delete': return validateDelete(req);
    case 'search': return validateSearch(req);
    default: {
      const _exhaustive: never = req;
      return { ok: false, reason: `Unknown operation kind: ${(_exhaustive as FilesystemOperationRequest).kind}` };
    }
  }
}

export function assertOperation(req: FilesystemOperationRequest): void {
  const result = validateOperation(req);
  if (!result.ok) throw new OperationValidationError(result.reason!);
}

export function assertContext(ctx: FilesystemExecutionContext): void {
  const result = validateContext(ctx);
  if (!result.ok) throw new OperationValidationError(result.reason!);
}
