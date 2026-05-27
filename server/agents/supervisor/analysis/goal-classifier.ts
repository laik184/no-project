import type { ClassificationResult, GoalCategory } from '../types/supervisor.types.ts';

interface CategoryPattern {
  category: GoalCategory;
  patterns: RegExp[];
  weight: number;
}

const CATEGORY_PATTERNS: CategoryPattern[] = [
  {
    category: 'ai_app',
    weight: 10,
    patterns: [
      /\b(ai|llm|openai|anthropic|gpt|embedding|vector|rag|chatbot|semantic)\b/i,
      /\b(ml|machine.?learning|neural|inference|model)\b/i,
    ],
  },
  {
    category: 'auth_system',
    weight: 9,
    patterns: [
      /\b(login|signup|register|authentication|authorization|oauth|jwt|session|password)\b/i,
      /\b(user.?management|role|permission|access.?control|sso)\b/i,
    ],
  },
  {
    category: 'saas_dashboard',
    weight: 8,
    patterns: [
      /\b(saas|dashboard|admin.?panel|analytics|reporting|chart|graph|metric|kpi)\b/i,
      /\b(multi.?tenant|workspace|organization|team|subscription|billing)\b/i,
    ],
  },
  {
    category: 'backend_api',
    weight: 7,
    patterns: [
      /\b(api|rest|graphql|endpoint|microservice|webhook|backend|server)\b/i,
      /\b(rate.?limit|middleware|caching|redis|queue|worker)\b/i,
    ],
  },
  {
    category: 'database_ops',
    weight: 7,
    patterns: [
      /\b(database|migration|schema|orm|drizzle|prisma|postgres|mysql|mongo)\b/i,
      /\b(query|index|seed|backup|sql)\b/i,
    ],
  },
  {
    category: 'crud',
    weight: 5,
    patterns: [
      /\b(crud|create|read|update|delete|form|list|table|record|entry)\b/i,
      /\b(todo|note|task|item|product|blog|post)\b/i,
    ],
  },
];

export const goalClassifier = {
  classify(goal: string): ClassificationResult {
    const scores: Array<{ category: GoalCategory; score: number; matchCount: number }> = [];

    for (const cp of CATEGORY_PATTERNS) {
      let matchCount = 0;
      for (const pattern of cp.patterns) {
        const matches = goal.match(pattern);
        if (matches) matchCount += matches.length;
      }
      if (matchCount > 0) {
        scores.push({ category: cp.category, score: matchCount * cp.weight, matchCount });
      }
    }

    if (scores.length === 0) {
      return { category: 'unknown', confidence: 0, tags: [], reasoning: 'No recognizable patterns found.' };
    }

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    const maxPossible = Math.max(...CATEGORY_PATTERNS.map((c) => c.weight * c.patterns.length * 3));
    const confidence = Math.min(1, best.score / maxPossible);

    return {
      category:   best.category,
      confidence: Math.round(confidence * 100) / 100,
      tags:       scores.slice(0, 3).map((s) => s.category),
      reasoning:  `Matched "${best.category}" with score ${best.score} (${best.matchCount} pattern hits)`,
    };
  },

  isKnownCategory(category: string): category is GoalCategory {
    const known: GoalCategory[] = ['crud', 'saas_dashboard', 'ai_app', 'auth_system', 'backend_api', 'database_ops'];
    return known.includes(category as GoalCategory);
  },
};
