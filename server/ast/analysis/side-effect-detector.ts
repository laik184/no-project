/**
 * server/ast/analysis/side-effect-detector.ts
 * Reports files that contain side effects at module level.
 * Single responsibility: side-effect classification. Read-only.
 */

import type { ASTParseResult, SideEffectKind } from "../types.ts";

export interface SideEffectFinding {
  filePath:   string;
  effects:    SideEffectKind[];
  severity:   "low" | "medium" | "high";
  notes:      string[];
}

const SEVERITY_MAP: Record<SideEffectKind, SideEffectFinding["severity"]> = {
  globalMutation:  "high",
  processExit:     "high",
  fileWrite:       "medium",
  networkCall:     "medium",
  envRead:         "low",
};

function worstSeverity(
  effects: SideEffectKind[],
): SideEffectFinding["severity"] {
  const order = ["low", "medium", "high"] as const;
  return effects.reduce((worst, e) => {
    const s = SEVERITY_MAP[e];
    return order.indexOf(s) > order.indexOf(worst) ? s : worst;
  }, "low" as SideEffectFinding["severity"]);
}

export function detectSideEffects(parsed: ASTParseResult[]): SideEffectFinding[] {
  return parsed
    .filter(r => r.sideEffects.length > 0)
    .map(r => ({
      filePath: r.filePath,
      effects:  r.sideEffects,
      severity: worstSeverity(r.sideEffects),
      notes:    r.sideEffects.map(e => `Side effect: ${e} detected at module scope`),
    }));
}
