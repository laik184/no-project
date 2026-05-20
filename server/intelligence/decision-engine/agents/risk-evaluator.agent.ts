import type { ClassifiedIntent, ContextAnalysis, StrategySelection, RiskAssessment, RiskLevel } from '../types.ts';
import { clamp } from '../utils/normalization.util.ts';

function calcPerformanceRisk(context: ContextAnalysis, strategy: StrategySelection): number {
  let risk = 0;
  if (context.complexity === 'high') risk += 0.4;
  else if (context.complexity === 'medium') risk += 0.2;
  if (strategy.agentSequence.length > 5) risk += 0.2;
  if (strategy.strategy === 'pipeline') risk += 0.1;
  return clamp(risk, 0, 1);
}

function calcSecurityRisk(context: ContextAnalysis, intent: ClassifiedIntent): number {
  let risk = 0;
  if (context.hasSecurityImplication) risk += 0.5;
  if (intent.intent === 'deploy') risk += 0.2;
  if (context.domain === 'security') risk += 0.1;
  if (intent.intent === 'generate' && context.domain === 'backend') risk += 0.1;
  return clamp(risk, 0, 1);
}

function calcFailureProbability(
  context: ContextAnalysis,
  strategy: StrategySelection,
  confidence: number,
): number {
  let prob = 1 - confidence;
  if (context.complexity === 'high') prob += 0.2;
  if (strategy.agentSequence.length > 4) prob += 0.1;
  if (context.dependencies.length > 3) prob += 0.1;
  return clamp(prob, 0, 1);
}

function classifyRiskLevel(perf: number, sec: number, fail: number): RiskLevel {
  const aggregate = perf * 0.3 + sec * 0.4 + fail * 0.3;
  if (aggregate >= 0.7) return 'critical';
  if (aggregate >= 0.5) return 'high';
  if (aggregate >= 0.3) return 'medium';
  return 'low';
}

function buildMitigations(riskLevel: RiskLevel, context: ContextAnalysis, intent: ClassifiedIntent): string[] {
  const mitigations: string[] = [];
  if (riskLevel === 'critical' || riskLevel === 'high') {
    mitigations.push('Enable fallback decision path');
    mitigations.push('Validate all outputs before applying');
  }
  if (context.hasSecurityImplication) {
    mitigations.push('Run input-sanitizer before execution');
    mitigations.push('Enforce rate limiting on this operation');
  }
  if (context.complexity === 'high') {
    mitigations.push('Break task into smaller subtasks');
  }
  if (intent.intent === 'deploy') {
    mitigations.push('Verify environment before deploy');
    mitigations.push('Keep rollback trigger ready');
  }
  return mitigations;
}

export function evaluateRisk(
  intent: ClassifiedIntent,
  context: ContextAnalysis,
  strategy: StrategySelection,
): RiskAssessment {
  const performanceRisk = calcPerformanceRisk(context, strategy);
  const securityRisk = calcSecurityRisk(context, intent);
  const failureProbability = calcFailureProbability(context, strategy, intent.confidence);
  const riskLevel = classifyRiskLevel(performanceRisk, securityRisk, failureProbability);
  const mitigations = buildMitigations(riskLevel, context, intent);

  return Object.freeze({
    riskLevel,
    performanceRisk,
    securityRisk,
    failureProbability,
    mitigations,
  });
}
