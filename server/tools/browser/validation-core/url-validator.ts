/**
 * server/tools/browser/validation-core/url-validator.ts
 *
 * Validates URLs before any navigation is attempted.
 * Fail-closed: only localhost, sandbox, and explicitly allowed hosts pass.
 */

import { isAllowedUrl, normalizeUrl } from '../../../agents/browser/utils/navigation-utils.ts';

export interface UrlValidation {
  valid:        boolean;
  normalized?:  string;
  reason?:      string;
}

export function validateUrl(rawUrl: unknown, allowedHosts: string[] = []): UrlValidation {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return { valid: false, reason: 'URL must be a non-empty string' };
  }

  const normalized = normalizeUrl(rawUrl.trim());

  if (!isAllowedUrl(normalized, allowedHosts)) {
    return {
      valid:  false,
      reason: `URL blocked by sandbox policy: ${normalized}. Only localhost, sandbox, and allowed hosts are permitted.`,
    };
  }

  return { valid: true, normalized };
}

export function assertUrl(rawUrl: unknown, allowedHosts: string[] = []): string {
  const v = validateUrl(rawUrl, allowedHosts);
  if (!v.valid) throw new Error(`[url] ${v.reason}`);
  return v.normalized!;
}
