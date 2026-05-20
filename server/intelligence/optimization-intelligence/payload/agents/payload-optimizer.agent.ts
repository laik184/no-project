import type {
  ResponseProfile,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import {
  PAYLOAD_HIGH_BYTES,
  PAYLOAD_CRITICAL_BYTES,
} from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "PAYLOAD_OPTIMIZATION" as const;

function classifyPayloadImpact(bytes: number): ImpactLevel {
  if (bytes >= PAYLOAD_CRITICAL_BYTES) return "CRITICAL";
  if (bytes >= PAYLOAD_HIGH_BYTES)     return "HIGH";
  if (bytes >= 30_000)                 return "MEDIUM";
  return "LOW";
}

function analyzeResponseSize(
  rp: Readonly<ResponseProfile>,
): OptimizationFinding | null {
  if (rp.avgPayloadBytes < 30_000) return null;

  const impact    = classifyPayloadImpact(rp.avgPayloadBytes);
  const kb        = (rp.avgPayloadBytes / 1024).toFixed(1);
  const evidence: string[] = [`Avg payload: ${kb}KB`];

  const suggestions: string[] = [];

  if (!rp.hasCompression) {
    suggestions.push("Enable gzip/brotli compression middleware");
    evidence.push("Compression: disabled");
  }
  if (!rp.hasFieldFilter) {
    suggestions.push("Apply field filtering — only return required fields");
    evidence.push("Field filtering: none");
  }
  if (rp.avgPayloadBytes >= PAYLOAD_CRITICAL_BYTES) {
    suggestions.push("Consider pagination or streaming for large datasets");
  }

  if (suggestions.length === 0) {
    suggestions.push("Review response structure for further optimization");
  }

  return Object.freeze({
    findingId:   makeFindingId("payload", nextSeq()),
    category:    CATEGORY,
    target:      `route:${rp.route}`,
    description: `Route "${rp.route}" returns ${kb}KB avg payload. ${suggestions.join(". ")}.`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze(evidence),
  });
}

function analyzeCompressionGap(
  rp: Readonly<ResponseProfile>,
): OptimizationFinding | null {
  if (rp.hasCompression || rp.avgPayloadBytes < 1_024) return null;

  const impact: ImpactLevel = rp.avgPayloadBytes >= 10_000 ? "MEDIUM" : "LOW";

  return Object.freeze({
    findingId:   makeFindingId("compress", nextSeq()),
    category:    CATEGORY,
    target:      `route:${rp.route}`,
    description: `Route "${rp.route}" does not use compression. Adding gzip/brotli can reduce transfer size by 60–80%.`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `Avg payload: ${(rp.avgPayloadBytes / 1024).toFixed(1)}KB`,
      `Compression: disabled`,
    ]),
  });
}

export function analyzePayloadOptimization(
  responses: readonly Readonly<ResponseProfile>[],
): readonly OptimizationFinding[] {
  const seen = new Set<string>();
  const findings: OptimizationFinding[] = [];

  for (const rp of responses) {
    const size = analyzeResponseSize(rp);
    if (size) {
      findings.push(size);
      seen.add(rp.route);
    }

    if (!seen.has(rp.route)) {
      const compress = analyzeCompressionGap(rp);
      if (compress) findings.push(compress);
    }
  }

  return Object.freeze(findings);
}
