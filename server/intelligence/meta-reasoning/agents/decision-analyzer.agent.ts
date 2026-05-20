import type { MetaReasoningInput, DecisionAnalysis } from "../types";
import {
  extractKeyPhrases,
  scoreGoalAlignment,
  extractAssumptions,
  inferLogicPath,
} from "../utils/reasoning.util";

export interface DecisionAnalyzerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  analysis?: DecisionAnalysis;
}

export function analyzeDecision(input: MetaReasoningInput): DecisionAnalyzerOutput {
  const logs: string[] = [];

  try {
    logs.push(`[decision-analyzer] analyzing decision (${input.decision.length} chars) with context (${input.context.length} chars)`);

    const phrases = extractKeyPhrases(input.decision);
    logs.push(`[decision-analyzer] key phrases: ${phrases.join(", ") || "none"}`);

    const goalAlignment = scoreGoalAlignment(input.decision, input.context);
    logs.push(`[decision-analyzer] goal alignment score: ${goalAlignment}`);

    const assumptions = extractAssumptions(input.decision);
    logs.push(`[decision-analyzer] assumptions detected: ${assumptions.length}`);

    const logicPath = inferLogicPath(input.decision, input.context);
    logs.push(`[decision-analyzer] logic path: ${logicPath.length} steps`);

    const intent = phrases.length > 0
      ? `${phrases.slice(0, 3).join(", ")} — derived from decision text`
      : "General decision with unspecified intent";

    const analysis: DecisionAnalysis = {
      intent,
      logicPath,
      assumptions,
      goalAlignment,
    };

    logs.push(`[decision-analyzer] complete — intent="${intent.slice(0, 60)}" alignment=${goalAlignment}`);
    return { success: true, logs, analysis };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[decision-analyzer] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
