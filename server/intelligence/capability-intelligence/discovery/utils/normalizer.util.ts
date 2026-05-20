export function normalizeId(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "UNKNOWN";
  return raw.trim().replace(/[^a-zA-Z0-9_\-.]/g, "_");
}

export function normalizeName(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "Unnamed";
  return raw.trim();
}

export function normalizeSlug(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "unknown";
  return raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_.]/g, "");
}

export function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  return raw.trim().toLowerCase();
}

export function normalizeTags(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return Object.freeze([]);
  return Object.freeze(
    raw
      .map(normalizeTag)
      .filter((t): t is string => t !== null),
  );
}

export function normalizeVersion(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "0.0.0";
  return raw.trim().replace(/^v/, "");
}

export function normalizePlatform(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "generic";
  return raw.trim().toLowerCase();
}

export function normalizeProtocol(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "unknown";
  return raw.trim().toLowerCase();
}

export function normalizeExtension(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return ".unknown";
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

export function metaString(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): unknown {
  return metadata?.[key];
}
