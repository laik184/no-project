import type { ExecutionMode, GoalCategory, ComplexityResult, ClassificationResult } from '../types/supervisor.types.ts';

interface ModeRule {
  id: string;
  test: (complexity: ComplexityResult, classification: ClassificationResult) => boolean;
  mode: ExecutionMode;
  reason: string;
}

const MODE_RULES: ModeRule[] = [
  {
    id:     'ai_always_complex',
    test:   (_, c) => c.category === 'ai_app',
    mode:   'complex',
    reason: 'AI apps require LLM integration and multi-phase setup',
  },
  {
    id:     'saas_high_complexity',
    test:   (comp, c) => c.category === 'saas_dashboard' && comp.score >= 40,
    mode:   'complex',
    reason: 'SaaS dashboards with high complexity require full pipeline',
  },
  {
    id:     'auth_standard',
    test:   (_, c) => c.category === 'auth_system',
    mode:   'standard',
    reason: 'Auth systems require careful multi-phase execution',
  },
  {
    id:     'backend_api_standard',
    test:   (comp, c) => c.category === 'backend_api' && comp.score >= 30,
    mode:   'standard',
    reason: 'Backend APIs with moderate complexity need standard pipeline',
  },
  {
    id:     'crud_simple',
    test:   (comp, c) => c.category === 'crud' && comp.score < 35,
    mode:   'simple',
    reason: 'Simple CRUD app — minimal complexity',
  },
  {
    id:     'score_drives_complex',
    test:   (comp) => comp.score >= 70,
    mode:   'complex',
    reason: 'High complexity score — complex mode required',
  },
  {
    id:     'score_drives_simple',
    test:   (comp) => comp.score < 25,
    mode:   'simple',
    reason: 'Low complexity score — simple mode sufficient',
  },
];

export const executionModeDetector = {
  detect(complexity: ComplexityResult, classification: ClassificationResult): {
    mode: ExecutionMode;
    reason: string;
    ruleId: string;
  } {
    for (const rule of MODE_RULES) {
      if (rule.test(complexity, classification)) {
        return { mode: rule.mode, reason: rule.reason, ruleId: rule.id };
      }
    }

    // Default: trust complexity score
    return {
      mode:   complexity.mode,
      reason: `Default: complexity score ${complexity.score}`,
      ruleId: 'default',
    };
  },

  phasesForMode(mode: ExecutionMode): Array<'analyze' | 'planning' | 'execution' | 'verification' | 'browser'> {
    switch (mode) {
      case 'simple':   return ['analyze', 'execution', 'verification'];
      case 'standard': return ['analyze', 'planning', 'execution', 'verification'];
      case 'complex':  return ['analyze', 'planning', 'execution', 'verification', 'browser'];
    }
  },

  taskCountEstimate(mode: ExecutionMode, category: GoalCategory): number {
    const base: Record<ExecutionMode, number> = { simple: 2, standard: 5, complex: 10 };
    const boost: Partial<Record<GoalCategory, number>> = { ai_app: 4, saas_dashboard: 3, auth_system: 2 };
    return base[mode] + (boost[category] ?? 0);
  },
};
