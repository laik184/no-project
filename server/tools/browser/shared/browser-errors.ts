/**
 * server/tools/browser/shared/browser-errors.ts
 *
 * Typed error classes for the browser tool layer.
 * All errors are fail-closed: they carry enough context for callers to act.
 */

export class BrowserToolError extends Error {
  constructor(
    public readonly code: BrowserToolErrorCode,
    message: string,
  ) {
    super(`[BrowserTool:${code}] ${message}`);
    this.name = 'BrowserToolError';
  }
}

export type BrowserToolErrorCode =
  | 'NO_SESSION'
  | 'SESSION_CRASHED'
  | 'NAV_BLOCKED'
  | 'NAV_TIMEOUT'
  | 'NAV_FAILED'
  | 'ELEMENT_NOT_FOUND'
  | 'INTERACTION_FAILED'
  | 'SCREENSHOT_FAILED'
  | 'VALIDATION_FAILED'
  | 'INVALID_INPUT'
  | 'UNKNOWN';

export function noSessionError(runId: string): BrowserToolError {
  return new BrowserToolError(
    'NO_SESSION',
    `No active browser session for runId="${runId}". Call browser_launch first.`,
  );
}

export function invalidInputError(field: string, reason: string): BrowserToolError {
  return new BrowserToolError('INVALID_INPUT', `Invalid input "${field}": ${reason}`);
}
