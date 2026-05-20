import type { MetricLabel } from "../types.js";

const LABEL_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const BLOCKED_LABEL_KEYS: readonly string[] = Object.freeze([
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "access_token",
  "refresh_token",
  "ssn",
  "creditcard",
  "credit_card",
]);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return BLOCKED_LABEL_KEYS.some((k) => lower.includes(k));
}

function sanitizeLabelName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([^a-zA-Z_])/, "_$1");
}

function sanitizeLabelValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

export function normalizeLabels(raw: Record<string, string>): MetricLabel {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isSensitiveKey(key)) continue;
    const normalKey = sanitizeLabelName(key);
    if (!LABEL_NAME_RE.test(normalKey)) continue;
    result[normalKey] = sanitizeLabelValue(String(value));
  }
  return Object.freeze(result);
}

export function labelsToString(labels: MetricLabel): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  const pairs = entries.map(([k, v]) => `${k}="${v}"`).join(",");
  return `{${pairs}}`;
}

export function mergeLabels(
  base: MetricLabel,
  extra: MetricLabel,
): MetricLabel {
  return Object.freeze({ ...base, ...extra });
}
