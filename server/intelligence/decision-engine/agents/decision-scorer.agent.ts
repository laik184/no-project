import type {
  ClassifiedIntent,
  ContextAnalysis,
  CapabilityMap,
  RiskAssessment,
  ScoredOption,
} from '../types.ts';
import {
  weightedScore,
  capabilityScore,
  riskPenalty,
  complexityPenalty,
} from '../utils/scoring.util.ts';
import { rankByPriority } from '../utils/priority.util.ts';

function buildPrimaryOption(
  intent: ClassifiedIntent,
  context: ContextAnalysis,
  capability: CapabilityMap,
  risk: RiskAssessment,
): ScoredOption {
  const capScore = capabilityScore(capability.primaryAgents.length, capability.totalCapable || 1);
  const riskPen = riskPenalty(risk.failureProbability, risk.securityRisk, risk.performanceRisk);
  const complexPen = complexityPenalty(context.estimatedSteps);

  const score = weightedScore(intent.confidence, capScore, riskPen, complexPen);

  return {
    optionId: 'primary',
    score,
    breakdown: {
      confidenceScore: intent.confidence,
      capabilityScore: capScore,
      riskPenalty: riskPen,
      complexityPenalty: complexPen,
    },
  };
}

function buildFallbackOption(
  intent: ClassifiedIntent,
  capability: CapabilityMap,
  risk: RiskAssessment,
): ScoredOption {
  const capScore = capabilityScore(capability.supportingAgents.length, capability.totalCapable || 1);
  const riskPen = riskPenalty(risk.failureProbability * 0.7, risk.securityRisk * 0.7, risk.performanceRisk * 0.7);
  const complexPen = 0.1;
  const score = weightedScore(intent.confidence * 0.8, capScore, riskPen, complexPen);

  return {
    optionId: 'fallback',
    score,
    breakdown: {
      confidenceScore: intent.confidence * 0.8,
      capabilityScore: capScore,
      riskPenalty: riskPen,
      complexityPenalty: complexPen,
    },
  };
}

export function scoreDecision(
  intent: ClassifiedIntent,
  context: ContextAnalysis,
  capability: CapabilityMap,
  risk: RiskAssessment,
): ScoredOption[] {
  const primary = buildPrimaryOption(intent, context, capability, risk);
  const fallback = buildFallbackOption(intent, capability, risk);
  const ranked = rankByPriority([primary, fallback]);
  return ranked.map((o) => Object.freeze(o));
}
