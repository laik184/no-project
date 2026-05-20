import type { DiscoverySource, DiscoveredLanguage } from "../types.js";
import { normalizeId, normalizeName, normalizeSlug, normalizeExtension, metaString } from "../utils/normalizer.util.js";
import { dedupeById } from "../utils/dedupe.util.js";

const KIND = "LANGUAGE" as const;

function isLanguageSource(source: unknown): source is DiscoverySource {
  if (!source || typeof source !== "object") return false;
  const s = source as Record<string, unknown>;
  return s["kind"] === KIND
    && typeof s["id"]   === "string" && (s["id"]   as string).trim().length > 0
    && typeof s["name"] === "string" && (s["name"] as string).trim().length > 0;
}

function buildLanguage(source: DiscoverySource): DiscoveredLanguage {
  const meta      = source.metadata;
  const extension = normalizeExtension(metaString(meta, "extension"));
  const ecosystem = normalizeSlug(metaString(meta, "ecosystem")) || "general";

  return Object.freeze({
    id:        normalizeId(source.id),
    name:      normalizeName(source.name),
    extension,
    ecosystem,
  });
}

export function discoverLanguages(
  sources: readonly DiscoverySource[],
): readonly DiscoveredLanguage[] {
  if (!Array.isArray(sources)) return Object.freeze([]);

  const languages = sources
    .filter(isLanguageSource)
    .map(buildLanguage);

  return dedupeById(languages);
}

export function languagesByEcosystem(
  languages: readonly DiscoveredLanguage[],
  ecosystem: string,
): readonly DiscoveredLanguage[] {
  if (!Array.isArray(languages)) return Object.freeze([]);
  return Object.freeze(languages.filter((l) => l.ecosystem === ecosystem.toLowerCase().trim()));
}

export function languageEcosystems(
  languages: readonly DiscoveredLanguage[],
): readonly string[] {
  if (!Array.isArray(languages)) return Object.freeze([]);
  return Object.freeze([...new Set(languages.map((l) => l.ecosystem))]);
}

export function languageExtensions(
  languages: readonly DiscoveredLanguage[],
): readonly string[] {
  if (!Array.isArray(languages)) return Object.freeze([]);
  return Object.freeze([...new Set(languages.map((l) => l.extension))]);
}
