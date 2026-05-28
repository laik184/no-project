/**
 * server/agents/filesystem/core/filesystem-state.ts
 *
 * Manages the in-flight operation registry for a single agent run.
 * Tracks status transitions and provides a consistent view of operation state.
 * No filesystem access — pure in-process state.
 */

import type {
  FilesystemOperation,
  FilesystemOperationRequest,
  FilesystemOperationResult,
  FilesystemOperationStatus,
} from '../types/filesystem.types.ts';
import { generateOperationId, now } from '../utils/filesystem-utils.ts';

// ── Internal store ────────────────────────────────────────────────────────────

const _ops = new Map<string, FilesystemOperation>();

// ── Public API ────────────────────────────────────────────────────────────────

export function registerOperation(request: FilesystemOperationRequest): FilesystemOperation {
  const op: FilesystemOperation = {
    operationId: generateOperationId(),
    request,
    status:      'pending',
    retryCount:  0,
  };
  _ops.set(op.operationId, op);
  return op;
}

export function markRunning(operationId: string): void {
  const op = _ops.get(operationId);
  if (!op) return;
  op.status    = 'running';
  op.startedAt = now();
}

export function markRetrying(operationId: string): void {
  const op = _ops.get(operationId);
  if (!op) return;
  op.status = 'retrying';
  op.retryCount++;
}

export function markCompleted(operationId: string, result: FilesystemOperationResult): void {
  const op = _ops.get(operationId);
  if (!op) return;
  op.status      = 'completed';
  op.completedAt = now();
  op.result      = result;
}

export function markFailed(operationId: string, error: string): void {
  const op = _ops.get(operationId);
  if (!op) return;
  op.status      = 'failed';
  op.completedAt = now();
  op.error       = error;
}

export function markCancelled(operationId: string): void {
  const op = _ops.get(operationId);
  if (!op) return;
  op.status      = 'cancelled';
  op.completedAt = now();
}

export function getOperation(operationId: string): FilesystemOperation | undefined {
  return _ops.get(operationId);
}

export function listPending(): FilesystemOperation[] {
  return [..._ops.values()].filter((o) => o.status === 'pending');
}

export function listFailed(): FilesystemOperation[] {
  return [..._ops.values()].filter((o) => o.status === 'failed');
}

export function listCompleted(): FilesystemOperation[] {
  return [..._ops.values()].filter((o) => o.status === 'completed');
}

export function allOperations(): FilesystemOperation[] {
  return [..._ops.values()];
}

export function operationStatus(operationId: string): FilesystemOperationStatus | undefined {
  return _ops.get(operationId)?.status;
}

export function removeOperation(operationId: string): void {
  _ops.delete(operationId);
}

export function resetState(): void {
  _ops.clear();
}
