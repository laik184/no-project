/**
 * server/agents/coderx/validation/response-validator.ts
 *
 * Validates LLM/tool responses before they are used downstream.
 * Detects malformed, invalid, or unsafe responses.
 */

export class ResponseValidationError extends Error {
  constructor(message: string) {
    super(`[response-validator] ${message}`);
    this.name = 'ResponseValidationError';
  }
}

// ── Tool execution result validation ─────────────────────────────────────────

export interface MinimalToolResult {
  ok:         boolean;
  durationMs: number;
  data?:      unknown;
  error?:     string;
}

export function assertValidToolResult(result: unknown): asserts result is MinimalToolResult {
  if (result === null || typeof result !== 'object') {
    throw new ResponseValidationError('Tool result must be a non-null object.');
  }

  const r = result as Record<string, unknown>;

  if (typeof r.ok !== 'boolean') {
    throw new ResponseValidationError('Tool result must have a boolean "ok" field.');
  }
  if (typeof r.durationMs !== 'number') {
    throw new ResponseValidationError('Tool result must have a numeric "durationMs" field.');
  }
  if (!r.ok && typeof r.error !== 'string') {
    throw new ResponseValidationError('Failed tool result must include a string "error" field.');
  }
}

// ── Structured output validation ──────────────────────────────────────────────

export function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ResponseValidationError(`"${field}" must be a non-empty string.`);
  }
}

export function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ResponseValidationError(`"${field}" must be an array of strings.`);
  }
}

// ── Safety check ─────────────────────────────────────────────────────────────

const UNSAFE_PATTERNS = [
  /rm\s+-rf/i,
  /drop\s+table/i,
  /delete\s+from.*where\s+1\s*=\s*1/i,
  /process\.exit/,
  /eval\s*\(/,
];

export function assertSafeContent(content: string): void {
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(content)) {
      throw new ResponseValidationError(
        `Unsafe pattern detected in response content: ${pattern.source}`,
      );
    }
  }
}
