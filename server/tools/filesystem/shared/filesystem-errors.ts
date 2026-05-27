/**
 * server/tools/filesystem/shared/filesystem-errors.ts
 *
 * Classify agent errors into ToolErrorCode for the dispatcher layer.
 * Never swallows errors — always converts them to typed codes.
 */

import type { ToolErrorCode } from '../../registry/tool-types.ts';

export interface ClassifiedError {
  message: string;
  code:    ToolErrorCode;
}

export function classifyFsError(err: unknown): ClassifiedError {
  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes('not found') ||
    msg.includes('ENOENT') ||
    msg.includes('No such file')
  ) {
    return { message: msg, code: 'NOT_FOUND' };
  }

  if (
    msg.includes('sandbox') ||
    msg.includes('traversal') ||
    msg.includes('protected') ||
    msg.includes('Permission denied') ||
    msg.includes('EACCES') ||
    msg.includes('denied')
  ) {
    return { message: msg, code: 'PERMISSION_DENIED' };
  }

  if (
    msg.includes('must be') ||
    msg.includes('must not') ||
    msg.includes('invalid') ||
    msg.includes('out of range') ||
    msg.includes('empty') ||
    msg.includes('Invalid')
  ) {
    return { message: msg, code: 'VALIDATION_ERROR' };
  }

  return { message: msg, code: 'EXECUTION_ERROR' };
}
