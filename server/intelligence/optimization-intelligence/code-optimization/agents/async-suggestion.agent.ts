import type {
  FunctionProfile,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "ASYNC_SUGGESTION" as const;

function classifyAsyncNeed(fn: Readonly<FunctionProfile>): ImpactLevel | null {
  if (fn.isAsync) return null;

  if (fn.hasSyncIoCalls && fn.callFrequency > 50) return "CRITICAL";
  if (fn.hasSyncIoCalls && fn.callFrequency > 10) return "HIGH";
  if (fn.hasSyncIoCalls)                          return "MEDIUM";
  return null;
}

function buildSuggestion(fn: Readonly<FunctionProfile>, impact: ImpactLevel): string {
  const base = `Function "${fn.name}" performs synchronous I/O and is not async`;
  if (impact === "CRITICAL") {
    return `${base} — called ${fn.callFrequency}x. This blocks the event loop critically. Convert to async/await immediately.`;
  }
  if (impact === "HIGH") {
    return `${base} — called ${fn.callFrequency}x. High event loop blocking risk. Refactor to async/await.`;
  }
  return `${base}. Consider converting to async/await to avoid potential event loop delays.`;
}

export function suggestAsyncRefactors(
  functions: readonly Readonly<FunctionProfile>[],
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  for (const fn of functions) {
    const impact = classifyAsyncNeed(fn);
    if (!impact) continue;

    findings.push(Object.freeze({
      findingId:   makeFindingId("async", nextSeq()),
      category:    CATEGORY,
      target:      `function:${fn.name}`,
      description: buildSuggestion(fn, impact),
      impact,
      score:       impactToScore(impact),
      evidence:    Object.freeze([
        `isAsync: false`,
        `hasSyncIoCalls: true`,
        `callFrequency: ${fn.callFrequency}`,
        `lineCount: ${fn.lineCount}`,
      ]),
    }));
  }

  return Object.freeze(findings);
}
