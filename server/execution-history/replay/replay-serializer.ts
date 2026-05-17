/**
 * server/execution-history/replay/replay-serializer.ts
 *
 * Utilities for producing replay-safe, size-capped JSON representations
 * of tool arguments and results.
 *
 * Rules:
 *  - Serialize to JSON, then truncate to the byte cap if needed.
 *  - Large string fields inside objects are trimmed individually.
 *  - Sensitive key names are redacted before storage.
 *  - Returns a plain object safe to pass to jsonb columns.
 */

const SENSITIVE_KEYS = new Set([
  "password", "token", "secret", "apiKey", "api_key",
  "authorization", "cookie", "jwt", "credentials",
]);

const MAX_STRING_VALUE = 2_000; // chars per individual string field

/** Recursively redact sensitive keys and trim long string values. */
export function sanitizeForReplay(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[deep]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_VALUE
      ? value.slice(0, MAX_STRING_VALUE) + `…[+${value.length - MAX_STRING_VALUE}]`
      : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitizeForReplay(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = "[redacted]";
    } else {
      out[k] = sanitizeForReplay(v, depth + 1);
    }
  }
  return out;
}

/**
 * Sanitize and cap a value to `maxBytes` of JSON.
 * Returns an object ready for JSONB storage.
 */
export function capJson(value: unknown, maxBytes: number): unknown {
  const cleaned = sanitizeForReplay(value);
  let json = JSON.stringify(cleaned);
  if (Buffer.byteLength(json, "utf8") > maxBytes) {
    // Replace with a truncation envelope
    return {
      __truncated: true,
      byteLength: Buffer.byteLength(json, "utf8"),
      preview: json.slice(0, 500),
    };
  }
  return JSON.parse(json);
}

/** Build a replay-safe execution envelope from DB record fields. */
export interface ReplayEnvelope {
  executionId: string;
  runId:       string | null;
  toolName:    string;
  stepIndex:   number | null;
  args:        unknown;
  result:      unknown;
  status:      string;
  durationMs:  number | null;
  startedAt:   string;
  retryCount:  number;
  replaySafe:  boolean;
}

export function buildReplayEnvelope(row: {
  executionId: string;
  runId: string | null;
  toolName: string;
  stepIndex: number | null;
  argsJson: unknown;
  resultJson: unknown;
  status: string;
  durationMs: number | null;
  startedAt: Date;
  retryCount: number;
  replaySafe: boolean;
}): ReplayEnvelope {
  return {
    executionId: row.executionId,
    runId:       row.runId,
    toolName:    row.toolName,
    stepIndex:   row.stepIndex,
    args:        row.replaySafe ? row.argsJson : { __redacted: "replaySafe=false" },
    result:      row.resultJson,
    status:      row.status,
    durationMs:  row.durationMs,
    startedAt:   row.startedAt.toISOString(),
    retryCount:  row.retryCount,
    replaySafe:  row.replaySafe,
  };
}
