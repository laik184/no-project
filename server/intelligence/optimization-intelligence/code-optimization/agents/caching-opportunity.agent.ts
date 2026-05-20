import type {
  CacheProfile,
  EndpointProfile,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import { CACHE_HIT_LOW }                         from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "CACHING_OPPORTUNITY" as const;
const HIGH_COMPUTE_MS = 100;
const HIGH_FREQ_CALLS = 50;

function classifyCacheImpact(profile: Readonly<CacheProfile>): ImpactLevel {
  const lowHit      = profile.cacheHitRate < CACHE_HIT_LOW;
  const highCompute = profile.avgComputeMs >= HIGH_COMPUTE_MS;
  const highFreq    = profile.callFrequency >= HIGH_FREQ_CALLS;

  if (lowHit && highCompute && highFreq) return "CRITICAL";
  if (lowHit && (highCompute || highFreq)) return "HIGH";
  if (lowHit)                              return "MEDIUM";
  return "LOW";
}

function analyzeCache(
  profile: Readonly<CacheProfile>,
): OptimizationFinding | null {
  if (profile.cacheHitRate >= 0.80) return null;

  const impact = classifyCacheImpact(profile);

  return Object.freeze({
    findingId:   makeFindingId("cache", nextSeq()),
    category:    CATEGORY,
    target:      `route:${profile.route}`,
    description: `Cache hit rate for "${profile.route}" is ${(profile.cacheHitRate * 100).toFixed(1)}% — below optimal. ${
      impact === "CRITICAL"
        ? "Implement aggressive TTL caching with Redis for high-frequency, expensive computations."
        : impact === "HIGH"
        ? "Add response caching or memoization to reduce repeated computation."
        : "Consider lightweight in-memory caching for this route."
    }`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `Cache hit rate: ${(profile.cacheHitRate * 100).toFixed(1)}%`,
      `Avg compute: ${profile.avgComputeMs}ms`,
      `Call frequency: ${profile.callFrequency}`,
    ]),
  });
}

function analyzeUncachedEndpoint(
  ep: Readonly<EndpointProfile>,
): OptimizationFinding | null {
  if (ep.method !== "GET" || ep.avgLatencyMs < 300 || ep.callCount < 100) return null;

  const impact: ImpactLevel = ep.avgLatencyMs > 1000 ? "HIGH" : "MEDIUM";

  return Object.freeze({
    findingId:   makeFindingId("cache-ep", nextSeq()),
    category:    CATEGORY,
    target:      `GET:${ep.route}`,
    description: `GET ${ep.route} is called ${ep.callCount}x with avg latency ${ep.avgLatencyMs}ms and shows no caching evidence. Add HTTP caching headers or a CDN layer.`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `Method: GET`,
      `Avg latency: ${ep.avgLatencyMs}ms`,
      `Call count: ${ep.callCount}`,
    ]),
  });
}

export function detectCachingOpportunities(
  caches:    readonly Readonly<CacheProfile>[],
  endpoints: readonly Readonly<EndpointProfile>[],
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  for (const c of caches) {
    const f = analyzeCache(c);
    if (f) findings.push(f);
  }

  for (const ep of endpoints) {
    const f = analyzeUncachedEndpoint(ep);
    if (f) findings.push(f);
  }

  return Object.freeze(findings);
}
