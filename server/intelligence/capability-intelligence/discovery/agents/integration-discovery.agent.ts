import type { DiscoverySource, DiscoveredIntegration } from "../types.js";
import { normalizeId, normalizeName, normalizeSlug, normalizeProtocol, metaString } from "../utils/normalizer.util.js";
import { dedupeById } from "../utils/dedupe.util.js";

const KIND = "INTEGRATION" as const;

function isIntegrationSource(source: unknown): source is DiscoverySource {
  if (!source || typeof source !== "object") return false;
  const s = source as Record<string, unknown>;
  return s["kind"] === KIND
    && typeof s["id"]   === "string" && (s["id"]   as string).trim().length > 0
    && typeof s["name"] === "string" && (s["name"] as string).trim().length > 0;
}

function buildIntegration(source: DiscoverySource): DiscoveredIntegration {
  const meta     = source.metadata;
  const type     = normalizeSlug(metaString(meta, "type"))     || "generic";
  const protocol = normalizeProtocol(metaString(meta, "protocol"));

  return Object.freeze({
    id:       normalizeId(source.id),
    name:     normalizeName(source.name),
    type,
    protocol,
  });
}

export function discoverIntegrations(
  sources: readonly DiscoverySource[],
): readonly DiscoveredIntegration[] {
  if (!Array.isArray(sources)) return Object.freeze([]);

  const integrations = sources
    .filter(isIntegrationSource)
    .map(buildIntegration);

  return dedupeById(integrations);
}

export function integrationsByType(
  integrations: readonly DiscoveredIntegration[],
  type:         string,
): readonly DiscoveredIntegration[] {
  if (!Array.isArray(integrations)) return Object.freeze([]);
  return Object.freeze(integrations.filter((i) => i.type === type.toLowerCase().trim()));
}

export function integrationTypes(
  integrations: readonly DiscoveredIntegration[],
): readonly string[] {
  if (!Array.isArray(integrations)) return Object.freeze([]);
  return Object.freeze([...new Set(integrations.map((i) => i.type))]);
}
