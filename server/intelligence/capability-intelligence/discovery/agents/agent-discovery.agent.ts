import type { DiscoverySource, DiscoveredAgent } from "../types.js";
import { normalizeId, normalizeName, normalizeSlug, normalizeTags, metaString } from "../utils/normalizer.util.js";
import { dedupeById } from "../utils/dedupe.util.js";

const KIND = "AGENT" as const;

function isAgentSource(source: unknown): source is DiscoverySource {
  if (!source || typeof source !== "object") return false;
  const s = source as Record<string, unknown>;
  return s["kind"] === KIND
    && typeof s["id"]   === "string" && (s["id"]   as string).trim().length > 0
    && typeof s["name"] === "string" && (s["name"] as string).trim().length > 0;
}

function buildAgent(source: DiscoverySource): DiscoveredAgent {
  const meta   = source.metadata;
  const domain = normalizeSlug(metaString(meta, "domain"))  || "general";
  const tags   = normalizeTags(metaString(meta, "tags"));

  return Object.freeze({
    id:     normalizeId(source.id),
    name:   normalizeName(source.name),
    domain,
    tags,
  });
}

export function discoverAgents(
  sources: readonly DiscoverySource[],
): readonly DiscoveredAgent[] {
  if (!Array.isArray(sources)) return Object.freeze([]);

  const agents = sources
    .filter(isAgentSource)
    .map(buildAgent);

  return dedupeById(agents);
}

export function agentsByDomain(
  agents: readonly DiscoveredAgent[],
  domain: string,
): readonly DiscoveredAgent[] {
  if (!Array.isArray(agents)) return Object.freeze([]);
  return Object.freeze(agents.filter((a) => a.domain === domain.toLowerCase().trim()));
}

export function agentDomains(
  agents: readonly DiscoveredAgent[],
): readonly string[] {
  if (!Array.isArray(agents)) return Object.freeze([]);
  return Object.freeze([...new Set(agents.map((a) => a.domain))]);
}
