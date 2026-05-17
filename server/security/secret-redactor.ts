/**
 * server/security/secret-redactor.ts
 *
 * Centralised secret detection and redaction.
 * Single source of truth for ALL redaction logic in the system.
 *
 * Rules:
 *  - LLM context must NEVER contain real secret values
 *  - Full replacement with ***REDACTED*** — never partial masking
 *  - Applied to: tool results, console lines, LLM messages, SSE payloads
 */

// ── Secret key name patterns ──────────────────────────────────────────────────
// Any env key whose name matches is fully redacted.
// Covers: API keys, DB credentials, tokens, auth secrets, Replit internals.

export const SECRET_KEY_RE =
  /(?:key|secret|password|token|auth|api|credential|private|jwt|cert|seed|salt|cipher|database_url|db_url|connection_string|pgpassword|pguser|pghost|dsn|repl_id|replit|webhook|signing|encryption)/i;

// Characters/patterns that look like real secrets in string values.
// Used to sanitize free-text (console logs, stack traces, etc.)
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /(?:sk|pk|rk)-[a-zA-Z0-9_-]{20,}/g,        // OpenAI/OpenRouter-style keys
  /postgres(?:ql)?:\/\/[^\s"'`]+/gi,            // Postgres connection strings
  /mysql:\/\/[^\s"'`]+/gi,                       // MySQL connection strings
  /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi,           // MongoDB connection strings
  /redis:\/\/[^\s"'`]+/gi,                       // Redis URLs
  /Bearer\s+[a-zA-Z0-9._\-/+]{20,}/gi,          // Bearer tokens
  /(?:eyJ)[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, // JWTs
  /[a-zA-Z0-9_\-]{32,}/g,                        // Long random-looking tokens (fallback)
];

export const REDACTED = "***REDACTED***";

// ── Per-key redaction ─────────────────────────────────────────────────────────

/**
 * Returns true if an env var key name indicates a sensitive value.
 */
export function isSecretKey(key: string): boolean {
  return SECRET_KEY_RE.test(key);
}

/**
 * Redact an env record: replace all values with ***REDACTED***.
 * Returns only key names + metadata — values are never exposed.
 */
export interface RedactedEnvSummary {
  keys:        string[];          // all key names (safe to show)
  secretKeys:  string[];          // keys that were redacted
  plainKeys:   string[];          // keys considered non-secret
  count:       number;
}

export function redactEnvRecord(
  env: Record<string, string>,
): RedactedEnvSummary {
  const keys       = Object.keys(env);
  const secretKeys = keys.filter(isSecretKey);
  const plainKeys  = keys.filter((k) => !isSecretKey(k));
  return { keys, secretKeys, plainKeys, count: keys.length };
}

// ── String sanitization ───────────────────────────────────────────────────────

/**
 * Scan a free-form string (console log, stack trace, etc.) and replace
 * anything that looks like a secret with ***REDACTED***.
 *
 * Only applies the long-token fallback if the string contains a known
 * prefix pattern, to avoid false-positive redaction of UUIDs or hashes.
 */
export function sanitizeString(text: string): string {
  if (!text || typeof text !== "string") return text;

  let out = text;
  // Always apply high-confidence patterns
  for (const re of SECRET_VALUE_PATTERNS.slice(0, -1)) {
    out = out.replace(new RegExp(re.source, re.flags), REDACTED);
  }

  // Apply long-token fallback ONLY if suspicious key names appear nearby
  if (SECRET_KEY_RE.test(out)) {
    const fallback = SECRET_VALUE_PATTERNS[SECRET_VALUE_PATTERNS.length - 1]!;
    out = out.replace(new RegExp(fallback.source, fallback.flags), REDACTED);
  }

  return out;
}

// ── Object sanitization ───────────────────────────────────────────────────────

/**
 * Recursively sanitize an object:
 *  - keys matching SECRET_KEY_RE → value replaced with ***REDACTED***
 *  - string values → run through sanitizeString
 *  - nested objects/arrays → recursed
 *
 * Safe to call on any tool result before sending to LLM.
 */
export function sanitizeObject(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeObject(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = sanitizeObject(v, depth + 1);
    }
  }
  return out;
}

// ── LLM context sanitizer ─────────────────────────────────────────────────────

/**
 * Sanitize any string that will be injected into LLM context.
 * Wraps sanitizeString for use in observation blocks, messages, etc.
 */
export function sanitizeForLlm(text: string): string {
  return sanitizeString(text);
}

/**
 * Sanitize a tool result JSON string before injecting into LLM messages.
 * Parses, sanitizes the object, and re-serializes.
 */
export function sanitizeToolResultJson(json: string): string {
  try {
    const parsed   = JSON.parse(json);
    const cleaned  = sanitizeObject(parsed);
    return JSON.stringify(cleaned);
  } catch {
    // If JSON is malformed, sanitize as raw string
    return sanitizeString(json);
  }
}
