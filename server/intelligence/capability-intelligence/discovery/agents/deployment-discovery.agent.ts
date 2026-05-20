import type { DiscoverySource, DiscoveredDeployment } from "../types.js";
import { normalizeId, normalizeName, normalizeSlug, metaString } from "../utils/normalizer.util.js";
import { dedupeById } from "../utils/dedupe.util.js";

const KIND = "DEPLOYMENT" as const;

const READINESS_DEFAULTS = Object.freeze({
  healthy: "healthy",
  ready:   "ready",
  pending: "pending",
  none:    "unspecified",
} as const);

function resolveReadiness(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return READINESS_DEFAULTS.none;
  const lower = raw.trim().toLowerCase();
  if (lower === "healthy") return READINESS_DEFAULTS.healthy;
  if (lower === "ready")   return READINESS_DEFAULTS.ready;
  if (lower === "pending") return READINESS_DEFAULTS.pending;
  return raw.trim();
}

function isDeploymentSource(source: unknown): source is DiscoverySource {
  if (!source || typeof source !== "object") return false;
  const s = source as Record<string, unknown>;
  return s["kind"] === KIND
    && typeof s["id"]   === "string" && (s["id"]   as string).trim().length > 0
    && typeof s["name"] === "string" && (s["name"] as string).trim().length > 0;
}

function buildDeployment(source: DiscoverySource): DiscoveredDeployment {
  const meta    = source.metadata;
  const target  = normalizeSlug(metaString(meta, "target")) || "unknown";
  const signal  = resolveReadiness(metaString(meta, "readinessSignal"));

  return Object.freeze({
    id:              normalizeId(source.id),
    name:            normalizeName(source.name),
    target,
    readinessSignal: signal,
  });
}

export function discoverDeployments(
  sources: readonly DiscoverySource[],
): readonly DiscoveredDeployment[] {
  if (!Array.isArray(sources)) return Object.freeze([]);

  const deployments = sources
    .filter(isDeploymentSource)
    .map(buildDeployment);

  return dedupeById(deployments);
}

export function deploymentsByTarget(
  deployments: readonly DiscoveredDeployment[],
  target:      string,
): readonly DiscoveredDeployment[] {
  if (!Array.isArray(deployments)) return Object.freeze([]);
  return Object.freeze(deployments.filter((d) => d.target === target.toLowerCase().trim()));
}

export function deploymentTargets(
  deployments: readonly DiscoveredDeployment[],
): readonly string[] {
  if (!Array.isArray(deployments)) return Object.freeze([]);
  return Object.freeze([...new Set(deployments.map((d) => d.target))]);
}
