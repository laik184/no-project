import type { MetaReasoningInput, DetectedFlaw, Alternative } from "../types";
import { detectOutcomePolarity } from "../utils/reasoning.util";

export interface AlternativeGeneratorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  alternatives?: Alternative[];
}

let altCounter = 0;
function makeAltId(): string {
  altCounter = (altCounter + 1) % 10000;
  return `alt-${altCounter}`;
}

const FLAW_ALTERNATIVES: Record<string, Array<Omit<Alternative, "id">>> = {
  "wrong-assumption": [
    {
      title: "Context-First Approach",
      approach: "Re-read the full context before committing to an action — validate each assumption against constraints before execution",
      speedScore: 0.60,
      riskScore: 0.20,
      efficiencyScore: 0.85,
    },
    {
      title: "Assumption Audit Loop",
      approach: "Enumerate all implicit assumptions, validate each one with available data, then rebuild the decision from verified facts only",
      speedScore: 0.50,
      riskScore: 0.15,
      efficiencyScore: 0.90,
    },
  ],
  "inefficiency": [
    {
      title: "Optimized Execution Path",
      approach: "Profile the decision logic for bottlenecks, eliminate redundant steps, and parallelize independent operations",
      speedScore: 0.90,
      riskScore: 0.30,
      efficiencyScore: 0.85,
    },
    {
      title: "Incremental Validation",
      approach: "Execute in small checkpointed steps with validation after each — fail fast, recover cheaply",
      speedScore: 0.70,
      riskScore: 0.20,
      efficiencyScore: 0.80,
    },
  ],
  "missed-opportunity": [
    {
      title: "Broad Signal Scan",
      approach: "Before deciding, collect all signals from context — do not filter until after collection to avoid missing weak but important signals",
      speedScore: 0.65,
      riskScore: 0.25,
      efficiencyScore: 0.80,
    },
    {
      title: "Multi-Path Evaluation",
      approach: "Generate 3 candidate paths before committing to any — score each on risk, speed, and fit before selection",
      speedScore: 0.60,
      riskScore: 0.20,
      efficiencyScore: 0.85,
    },
  ],
  "premature-conclusion": [
    {
      title: "Deliberate Reasoning Loop",
      approach: "Do not commit to a conclusion until at least 3 separate logic chains independently converge on the same answer",
      speedScore: 0.50,
      riskScore: 0.15,
      efficiencyScore: 0.88,
    },
  ],
  "scope-creep": [
    {
      title: "Scoped Decision Framework",
      approach: "Decompose the complex context into bounded sub-problems — solve each independently, then integrate results",
      speedScore: 0.65,
      riskScore: 0.20,
      efficiencyScore: 0.82,
    },
  ],
};

const DEFAULT_ALTERNATIVE: Omit<Alternative, "id"> = {
  title: "Conservative Baseline",
  approach: "Apply the safest known strategy: validate input, plan incrementally, check after each step, rollback on failure",
  speedScore: 0.55,
  riskScore: 0.15,
  efficiencyScore: 0.75,
};

export function generateAlternatives(
  input: MetaReasoningInput,
  flaws: DetectedFlaw[]
): AlternativeGeneratorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[alternative-generator] generating alternatives for ${flaws.length} flaw(s)`);
    const seen = new Set<string>();
    const alternatives: Alternative[] = [];
    const polarity = detectOutcomePolarity(input.outcome);

    for (const flaw of flaws) {
      const templates = FLAW_ALTERNATIVES[flaw.type] ?? [];
      for (const tpl of templates) {
        if (seen.has(tpl.title)) continue;
        seen.add(tpl.title);
        alternatives.push({ id: makeAltId(), ...tpl });
        logs.push(`[alternative-generator] "${tpl.title}" for flaw=${flaw.type}`);
      }
    }

    if (alternatives.length === 0 || polarity === "neutral") {
      if (!seen.has(DEFAULT_ALTERNATIVE.title)) {
        alternatives.push({ id: makeAltId(), ...DEFAULT_ALTERNATIVE });
        logs.push(`[alternative-generator] added default conservative baseline`);
      }
    }

    const final = alternatives.slice(0, 5);
    logs.push(`[alternative-generator] produced ${final.length} alternative(s)`);
    return { success: true, logs, alternatives: final };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[alternative-generator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
