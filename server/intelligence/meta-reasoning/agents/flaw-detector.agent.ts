import type { MetaReasoningInput, DecisionAnalysis, DetectedFlaw } from "../types";
import { detectOutcomePolarity, extractKeyPhrases } from "../utils/reasoning.util";

export interface FlawDetectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  flaws?: DetectedFlaw[];
}

export function detectFlaws(
  input: MetaReasoningInput,
  analysis: DecisionAnalysis
): FlawDetectorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[flaw-detector] scanning for flaws — alignment=${analysis.goalAlignment} assumptions=${analysis.assumptions.length}`);
    const flaws: DetectedFlaw[] = [];
    const polarity = detectOutcomePolarity(input.outcome);
    logs.push(`[flaw-detector] outcome polarity: ${polarity}`);

    if (analysis.goalAlignment < 0.2) {
      flaws.push({
        type: "wrong-assumption",
        description: "Decision shows very low alignment with stated context — likely misread the problem constraints",
        severity: "high",
        affectedPart: "intent extraction",
      });
      logs.push("[flaw-detector] wrong-assumption HIGH: low goal alignment");
    } else if (analysis.goalAlignment < 0.4) {
      flaws.push({
        type: "wrong-assumption",
        description: "Partial mismatch between decision intent and context — assumptions may not hold in all cases",
        severity: "medium",
        affectedPart: "context mapping",
      });
      logs.push("[flaw-detector] wrong-assumption MEDIUM: partial alignment");
    }

    if (analysis.assumptions.length > 4) {
      flaws.push({
        type: "premature-conclusion",
        description: `Decision relies on ${analysis.assumptions.length} implicit assumptions — high chance of fragility under changing conditions`,
        severity: "medium",
        affectedPart: "assumption stack",
      });
      logs.push(`[flaw-detector] premature-conclusion MEDIUM: ${analysis.assumptions.length} assumptions`);
    }

    if (polarity === "negative") {
      flaws.push({
        type: "inefficiency",
        description: "Outcome indicates the decision did not achieve its goal — execution path produced failure or error state",
        severity: "high",
        affectedPart: "execution outcome",
      });
      logs.push("[flaw-detector] inefficiency HIGH: negative outcome");

      const contextPhrases = extractKeyPhrases(input.context);
      const decisionPhrases = extractKeyPhrases(input.decision);
      const missed = contextPhrases.filter((p) => !decisionPhrases.includes(p));
      if (missed.length > 2) {
        flaws.push({
          type: "missed-opportunity",
          description: `Decision ignored key context signals: ${missed.slice(0, 3).join(", ")} — alternative paths were available`,
          severity: "medium",
          affectedPart: "context coverage",
        });
        logs.push(`[flaw-detector] missed-opportunity MEDIUM: ignored signals=${missed.slice(0, 3).join(", ")}`);
      }
    }

    if (input.decision.length < 20 && input.context.length > 200) {
      flaws.push({
        type: "scope-creep",
        description: "Decision is too brief relative to a complex context — likely oversimplified the problem",
        severity: "medium",
        affectedPart: "decision scope",
      });
      logs.push("[flaw-detector] scope-creep MEDIUM: decision too brief for context complexity");
    }

    if (input.decision.length > 500 && analysis.logicPath.length <= 3) {
      flaws.push({
        type: "inefficiency",
        description: "Verbose decision with a shallow logic path — may lack structured reasoning",
        severity: "low",
        affectedPart: "reasoning depth",
      });
      logs.push("[flaw-detector] inefficiency LOW: verbose decision shallow logic");
    }

    logs.push(`[flaw-detector] detected ${flaws.length} flaw(s)`);
    return { success: true, logs, flaws };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[flaw-detector] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
