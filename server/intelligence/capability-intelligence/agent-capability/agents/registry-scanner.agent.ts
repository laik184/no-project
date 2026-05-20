import type { CapabilityInput, AgentScanResult } from "../types.js";
import { sanitizeId, sanitizeName, normalizeToken } from "../utils/id.util.js";

const UNKNOWN_VERSION = "0.0.0" as const;
const UNKNOWN_STATUS  = "unknown" as const;
const UNKNOWN_TYPE    = "unknown" as const;

function isValidDescriptor(d: unknown): boolean {
  if (!d || typeof d !== "object") return false;
  const desc = d as Record<string, unknown>;
  return typeof desc["id"] === "string" && desc["id"].trim().length > 0;
}

function resolveVersion(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return UNKNOWN_VERSION;
  return raw.trim();
}

function resolveStatus(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return UNKNOWN_STATUS;
  return normalizeToken(raw);
}

function resolveType(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return UNKNOWN_TYPE;
  return normalizeToken(raw);
}

function resolveTags(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return Object.freeze([]);
  return Object.freeze(
    raw
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .map((t) => (t as string).trim()),
  );
}

function resolveRegisteredAt(raw: unknown): number {
  if (typeof raw === "number" && raw > 0) return raw;
  return 0;
}

export function scanRegistry(input: CapabilityInput): readonly AgentScanResult[] {
  if (!input?.agents || !Array.isArray(input.agents)) return Object.freeze([]);

  const now = Date.now();
  const results: AgentScanResult[] = [];

  for (const descriptor of input.agents) {
    if (!isValidDescriptor(descriptor)) continue;

    results.push(Object.freeze({
      agentId:      sanitizeId(descriptor.id),
      name:         sanitizeName(descriptor.name),
      rawType:      resolveType(descriptor.type),
      rawVersion:   resolveVersion(descriptor.version),
      rawStatus:    resolveStatus(descriptor.status),
      tags:         resolveTags(descriptor.tags),
      registeredAt: resolveRegisteredAt(descriptor.registeredAt),
      scannedAt:    now,
    }));
  }

  return Object.freeze(results);
}
