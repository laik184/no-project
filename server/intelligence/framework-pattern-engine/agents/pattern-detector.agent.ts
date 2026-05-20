import { countByKeyword, flattenStructure } from "../utils/structure.util.js";
import type { FrameworkPatternEngineInput, Pattern } from "../types.js";

export function runPatternDetectorAgent(input: FrameworkPatternEngineInput): readonly Pattern[] {
  const paths = flattenStructure(input.projectStructure);
  const patterns: Pattern[] = [];

  const hasController = countByKeyword(paths, "controller") > 0;
  const hasService = countByKeyword(paths, "service") > 0;
  const hasModel = countByKeyword(paths, "model") > 0;

  if (hasController && hasService && hasModel) {
    patterns.push(
      Object.freeze({
        name: "mvc",
        confidence: 0.82,
        evidence: Object.freeze(["Detected controller/service/model folders or files"]),
      }),
    );
  }

  if (hasController && hasService) {
    patterns.push(
      Object.freeze({
        name: "layered",
        confidence: 0.78,
        evidence: Object.freeze(["Detected layered responsibilities in structure"]),
      }),
    );
  }

  if (countByKeyword(paths, "domain") > 0 && countByKeyword(paths, "adapter") > 0) {
    patterns.push(
      Object.freeze({
        name: "hexagonal",
        confidence: 0.75,
        evidence: Object.freeze(["Detected domain + adapter boundary markers"]),
      }),
    );
  }

  if (countByKeyword(paths, "service") > 6 && countByKeyword(paths, "gateway") > 0) {
    patterns.push(
      Object.freeze({
        name: "microservices",
        confidence: 0.64,
        evidence: Object.freeze(["Detected many service modules and gateway entry"]),
      }),
    );
  }

  return Object.freeze(patterns);
}
