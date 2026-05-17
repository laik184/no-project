/**
 * server/agents/observability/logger-setup/utils/sanitizer.util.ts
 *
 * Delegates to the centralised secret-redactor.
 * All key-pattern and object-sanitization logic lives in
 * server/security/secret-redactor.ts.
 *
 * Previous implementation had an incomplete SENSITIVE_KEYS list that
 * missed DATABASE_URL, PGPASSWORD, REPL_ID, and other critical keys.
 */

import {
  isSecretKey,
  sanitizeObject,
} from "../../../../security/secret-redactor.ts";

export function sanitizeMeta(
  meta: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  return Object.freeze(sanitizeObject(meta) as Record<string, unknown>);
}

export function isSensitiveKey(key: string): boolean {
  return isSecretKey(key);
}
