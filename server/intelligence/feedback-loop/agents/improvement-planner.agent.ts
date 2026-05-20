import type { Feedback, EvaluationResult, ImprovementPlan, ImprovementStrategy } from '../types.ts';

function pickStrategy(score: number, hasCritical: boolean, attempt: number): ImprovementStrategy {
  if (hasCritical) return 'escalate';
  if (score < 0.4 || attempt > 2) return 'rerun';
  return 'patch';
}

function buildSteps(feedback: Feedback[], strategy: ImprovementStrategy): string[] {
  const base: string[] = [];

  if (strategy === 'patch') {
    base.push('Apply targeted fixes for each identified issue');
    feedback.slice(0, 3).forEach((f) => base.push(`→ [${f.target}] ${f.instruction}`));
    base.push('Validate output against contract after patching');
  }

  if (strategy === 'rerun') {
    base.push('Discard current output');
    base.push('Re-initialize agent with corrected input');
    feedback.slice(0, 2).forEach((f) => base.push(`→ Pre-fix before rerun: ${f.instruction}`));
    base.push('Re-execute and capture fresh output');
  }

  if (strategy === 'escalate') {
    base.push('Halt current execution path');
    base.push('Escalate to fallback decision agent');
    base.push('Log all critical issues for manual review');
    base.push('Trigger alternative agent or safe fallback path');
  }

  return base;
}

function estimateImpact(score: number, feedbackCount: number): number {
  const base = 1 - score;
  const factor = Math.min(feedbackCount * 0.1, 0.4);
  return Math.min(base + factor, 1);
}

export function planImprovement(
  feedback: Feedback[],
  evaluation: EvaluationResult,
  attempt: number,
): ImprovementPlan {
  const hasCritical = evaluation.issues.some((i) => i.severity === 'critical');
  const strategy = pickStrategy(evaluation.score, hasCritical, attempt);
  const targetModule = feedback[0]?.target ?? 'core-agent';
  const steps = buildSteps(feedback, strategy);
  const estimatedImpact = estimateImpact(evaluation.score, feedback.length);

  return Object.freeze({
    strategy,
    targetModule,
    steps,
    priority: hasCritical ? 100 : Math.round(evaluation.score * 100),
    estimatedImpact,
  });
}
