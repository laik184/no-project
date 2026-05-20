import type {
  FunctionProfile,
  EndpointProfile,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "SYNC_BLOCKING" as const;

function analyzeSyncFunction(
  fn: Readonly<FunctionProfile>,
): OptimizationFinding | null {
  const isBlocking = fn.hasSyncIoCalls || (fn.hasLoops && !fn.isAsync);
  if (!isBlocking) return null;

  const impact: ImpactLevel =
    fn.hasSyncIoCalls && fn.hasLoops && fn.callFrequency > 20 ? "CRITICAL"
    : fn.hasSyncIoCalls && fn.callFrequency > 10              ? "HIGH"
    : fn.hasSyncIoCalls                                        ? "MEDIUM"
    : "LOW";

  const reasons: string[] = [];
  if (fn.hasSyncIoCalls) reasons.push("synchronous I/O calls detected");
  if (fn.hasLoops && !fn.isAsync) reasons.push("blocking loops in synchronous context");

  return Object.freeze({
    findingId:   makeFindingId("sync", nextSeq()),
    category:    CATEGORY,
    target:      `function:${fn.name}`,
    description: `Function "${fn.name}" contains blocking patterns (${reasons.join(", ")}). Replace with async equivalents.`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `hasSyncIoCalls: ${fn.hasSyncIoCalls}`,
      `hasLoops: ${fn.hasLoops}`,
      `isAsync: ${fn.isAsync}`,
      `callFrequency: ${fn.callFrequency}`,
    ]),
  });
}

function analyzeSyncEndpoint(
  ep: Readonly<EndpointProfile>,
): OptimizationFinding | null {
  if (ep.avgLatencyMs < 300 || ep.errorRate < 0.05) return null;

  const impact: ImpactLevel =
    ep.avgLatencyMs > 1000 && ep.errorRate > 0.1 ? "CRITICAL"
    : ep.avgLatencyMs > 500                       ? "HIGH"
    : "MEDIUM";

  return Object.freeze({
    findingId:   makeFindingId("sync-ep", nextSeq()),
    category:    CATEGORY,
    target:      `${ep.method}:${ep.route}`,
    description: `Endpoint ${ep.method} ${ep.route} shows signs of sync blocking — high latency with elevated error rate.`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `Avg latency: ${ep.avgLatencyMs}ms`,
      `Error rate: ${(ep.errorRate * 100).toFixed(1)}%`,
    ]),
  });
}

export function detectSyncBlocking(
  functions:  readonly Readonly<FunctionProfile>[],
  endpoints:  readonly Readonly<EndpointProfile>[],
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  for (const fn of functions) {
    const f = analyzeSyncFunction(fn);
    if (f) findings.push(f);
  }

  for (const ep of endpoints) {
    const f = analyzeSyncEndpoint(ep);
    if (f) findings.push(f);
  }

  return Object.freeze(findings);
}
