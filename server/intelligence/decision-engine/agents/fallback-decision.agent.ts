import type {
  ClassifiedIntent,
  ContextAnalysis,
  RiskAssessment,
  ScoredOption,
  FallbackDecision,
  Strategy,
} from '../types.ts';

const FALLBACK_THRESHOLD = 0.45;

const SAFE_FALLBACK_AGENTS: Record<string, string[]> = {
  generate: ['code-gen'],
  fix: ['error-fixer', 'debug-agent'],
  analyze: ['framework-runtime-analyzer'],
  deploy: ['deploy-runner'],
  optimize: ['optimization-intelligence'],
};

function needsFallback(scores: ScoredOption[], risk: RiskAssessment): boolean {
  const best = scores[0];
  if (!best) return true;
  if (best.score < FALLBACK_THRESHOLD) return true;
  if (risk.riskLevel === 'critical') return true;
  return false;
}

function selectFallbackStrategy(context: ContextAnalysis): Strategy {
  if (context.complexity === 'low') return 'single-agent';
  return 'multi-agent';
}

function buildFallbackReason(scores: ScoredOption[], risk: RiskAssessment): string {
  const reasons: string[] = [];
  if (!scores[0] || scores[0].score < FALLBACK_THRESHOLD) {
    reasons.push(`Best score ${scores[0]?.score.toFixed(2) ?? 'N/A'} below threshold ${FALLBACK_THRESHOLD}`);
  }
  if (risk.riskLevel === 'critical') {
    reasons.push('Risk level is critical — using safe fallback');
  }
  return reasons.join('; ') || 'Unknown fallback trigger';
}

export function resolveFallback(
  intent: ClassifiedIntent,
  context: ContextAnalysis,
  risk: RiskAssessment,
  scores: ScoredOption[],
): FallbackDecision {
  const triggered = needsFallback(scores, risk);

  if (!triggered) {
    return Object.freeze({
      triggered: false,
      reason: '',
      fallbackAgents: [],
      fallbackStrategy: 'single-agent' as Strategy,
    });
  }

  const fallbackAgents = SAFE_FALLBACK_AGENTS[intent.intent] ?? ['code-gen'];
  const fallbackStrategy = selectFallbackStrategy(context);
  const reason = buildFallbackReason(scores, risk);

  return Object.freeze({
    triggered: true,
    reason,
    fallbackAgents,
    fallbackStrategy,
  });
}
