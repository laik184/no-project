import { countByKeyword, flattenStructure } from "../utils/structure.util.js";
import { clampScore } from "../utils/scoring.util.js";
import type { FrameworkPatternEngineInput } from "../types.js";

export interface ScalabilityEvaluation {
  readonly horizontalReadiness: number;
  readonly modularExpansion: number;
  readonly score: number;
  readonly logs: readonly string[];
}

export function runScalabilityEvaluatorAgent(input: FrameworkPatternEngineInput): ScalabilityEvaluation {
  const paths = flattenStructure(input.projectStructure);

  const statelessIndicators = countByKeyword(paths, "queue") + countByKeyword(paths, "cache") + countByKeyword(paths, "event");
  const monolithIndicators = countByKeyword(paths, "shared") + countByKeyword(paths, "common");

  const horizontalReadiness = clampScore(55 + statelessIndicators * 8 - monolithIndicators * 3);
  const modularExpansion = clampScore(60 + countByKeyword(paths, "module") * 7 - countByKeyword(paths, "legacy") * 4);

  return Object.freeze({
    horizontalReadiness,
    modularExpansion,
    score: clampScore(Math.round((horizontalReadiness + modularExpansion) / 2)),
    logs: Object.freeze([
      `Horizontal readiness: ${horizontalReadiness}`,
      `Modular expansion: ${modularExpansion}`,
    ]),
  });
}
