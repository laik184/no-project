/**
 * server/agents/devops/env-pipeline-validator/utils/mask.util.ts
 *
 * Delegates to the centralised secret-redactor.
 * All masking logic lives in server/security/secret-redactor.ts.
 *
 * Previous implementation leaked first 4 characters of secret values.
 * This version applies full ***REDACTED*** replacement.
 */

import {
  isSecretKey,
  sanitizeObject,
  REDACTED,
} from "../../../../security/secret-redactor.ts";

/** Full redaction — no partial masking, no prefix leak. */
export function maskValue(_value: string): string {
  return REDACTED;
}

/**
 * Redact all secret keys in an env record.
 * secretKeys param is kept for API compatibility but isSecretKey()
 * from the centralised redactor is the authoritative check.
 */
export function maskEnvRecord(
  env: Readonly<Record<string, string>>,
  _secretKeys: readonly string[],
): Readonly<Record<string, string>> {
  return Object.freeze(sanitizeObject(env) as Record<string, string>);
}

/** Delegated to centralised redactor — comprehensive key pattern. */
export function isSensitiveKey(key: string): boolean {
  return isSecretKey(key);
}
