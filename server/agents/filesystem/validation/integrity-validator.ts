/**
 * server/agents/filesystem/validation/integrity-validator.ts
 *
 * Validates execution flow integrity.
 * Catches corrupted operation state and invalid lifecycle transitions.
 */

import type {
  FilesystemOperation,
  FilesystemOperationStatus,
} from '../types/filesystem.types.ts';

// ── Error type ────────────────────────────────────────────────────────────────

export class IntegrityValidationError extends Error {
  constructor(message: string) {
    super(`[integrity-validator] ${message}`);
    this.name = 'IntegrityValidationError';
  }
}

// ── Allowed transitions ───────────────────────────────────────────────────────
//
//   pending  → running | cancelled
//   running  → completed | failed | retrying
//   retrying → running | failed | cancelled
//   completed → (terminal)
//   failed    → (terminal)
//   cancelled → (terminal)

const ALLOWED_TRANSITIONS: Record<FilesystemOperationStatus, FilesystemOperationStatus[]> = {
  pending:   ['running', 'cancelled'],
  running:   ['completed', 'failed', 'retrying'],
  retrying:  ['running', 'failed', 'cancelled'],
  completed: [],
  failed:    [],
  cancelled: [],
};

// ── Validation result ─────────────────────────────────────────────────────────

export interface IntegrityValidationResult {
  ok:      boolean;
  reason?: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function validateTransition(
  operationId: string,
  from:        FilesystemOperationStatus,
  to:          FilesystemOperationStatus,
): IntegrityValidationResult {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, reason: `Unknown status "${from}" for operation ${operationId}.` };
  }
  if (!allowed.includes(to)) {
    return {
      ok:     false,
      reason: `Invalid transition [${from}→${to}] for operation ${operationId}. Allowed: [${allowed.join(', ')}].`,
    };
  }
  return { ok: true };
}

export function assertTransition(
  operationId: string,
  from:        FilesystemOperationStatus,
  to:          FilesystemOperationStatus,
): void {
  const result = validateTransition(operationId, from, to);
  if (!result.ok) throw new IntegrityValidationError(result.reason!);
}

export function isTerminalStatus(status: FilesystemOperationStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function validateOperation(op: FilesystemOperation): IntegrityValidationResult {
  if (!op.operationId?.trim()) {
    return { ok: false, reason: 'Operation is missing operationId.' };
  }
  if (!op.request) {
    return { ok: false, reason: `Operation ${op.operationId} has no request payload.` };
  }
  if (op.status === 'completed' && !op.result) {
    return { ok: false, reason: `Operation ${op.operationId} marked completed but has no result.` };
  }
  if (op.status === 'failed' && !op.error) {
    return { ok: false, reason: `Operation ${op.operationId} marked failed but has no error message.` };
  }
  if (op.retryCount < 0) {
    return { ok: false, reason: `Operation ${op.operationId} has negative retryCount.` };
  }
  return { ok: true };
}

export function assertOperationIntegrity(op: FilesystemOperation): void {
  const result = validateOperation(op);
  if (!result.ok) throw new IntegrityValidationError(result.reason!);
}
