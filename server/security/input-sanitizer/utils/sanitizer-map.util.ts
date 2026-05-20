import type { InputPayload, SanitizedPayload } from "../types.js";

export type FieldSanitizer = (value: string, field: string) => string;

export function mapStringFields(
  payload: InputPayload,
  sanitizer: FieldSanitizer,
): SanitizedPayload {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      result[key] = sanitizer(value, key);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string" ? sanitizer(item, key) : item,
      );
    } else if (value !== null && typeof value === "object") {
      result[key] = mapStringFields(value as InputPayload, sanitizer);
    } else {
      result[key] = value;
    }
  }
  return Object.freeze(result);
}

export function mergePayloads(base: SanitizedPayload, override: SanitizedPayload): SanitizedPayload {
  return Object.freeze({ ...base, ...override });
}
