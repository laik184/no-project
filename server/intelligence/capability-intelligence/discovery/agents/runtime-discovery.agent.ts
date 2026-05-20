import type { DiscoverySource, DiscoveredRuntime } from "../types.js";
import { normalizeId, normalizeName, normalizeVersion, normalizePlatform, metaString } from "../utils/normalizer.util.js";
import { dedupeById } from "../utils/dedupe.util.js";

const KIND = "RUNTIME" as const;

function isRuntimeSource(source: unknown): source is DiscoverySource {
  if (!source || typeof source !== "object") return false;
  const s = source as Record<string, unknown>;
  return s["kind"] === KIND
    && typeof s["id"]   === "string" && (s["id"]   as string).trim().length > 0
    && typeof s["name"] === "string" && (s["name"] as string).trim().length > 0;
}

function buildRuntime(source: DiscoverySource): DiscoveredRuntime {
  const meta     = source.metadata;
  const version  = normalizeVersion(metaString(meta, "version"));
  const platform = normalizePlatform(metaString(meta, "platform"));

  return Object.freeze({
    id:       normalizeId(source.id),
    name:     normalizeName(source.name),
    version,
    platform,
  });
}

export function discoverRuntimes(
  sources: readonly DiscoverySource[],
): readonly DiscoveredRuntime[] {
  if (!Array.isArray(sources)) return Object.freeze([]);

  const runtimes = sources
    .filter(isRuntimeSource)
    .map(buildRuntime);

  return dedupeById(runtimes);
}

export function runtimesByPlatform(
  runtimes:  readonly DiscoveredRuntime[],
  platform:  string,
): readonly DiscoveredRuntime[] {
  if (!Array.isArray(runtimes)) return Object.freeze([]);
  return Object.freeze(runtimes.filter((r) => r.platform === platform.toLowerCase().trim()));
}

export function runtimePlatforms(
  runtimes: readonly DiscoveredRuntime[],
): readonly string[] {
  if (!Array.isArray(runtimes)) return Object.freeze([]);
  return Object.freeze([...new Set(runtimes.map((r) => r.platform))]);
}
