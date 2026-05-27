import type { ComplexityResult, ExecutionMode } from '../types/supervisor.types.ts';
import { clamp } from '../utils/supervisor-helpers.ts';

interface ComplexityFactor {
  keyword: RegExp;
  points: number;
  label: string;
}

const FACTORS: ComplexityFactor[] = [
  { keyword: /\b(auth|authentication|oauth|jwt|session)\b/i,       points: 15, label: 'auth'           },
  { keyword: /\b(database|postgres|mysql|mongodb|redis|prisma)\b/i, points: 12, label: 'database'       },
  { keyword: /\b(ai|llm|openai|embedding|vector|rag)\b/i,          points: 20, label: 'ai_integration'  },
  { keyword: /\b(realtime|websocket|sse|socket\.io)\b/i,           points: 15, label: 'realtime'        },
  { keyword: /\b(payment|stripe|billing|subscription)\b/i,         points: 18, label: 'payments'        },
  { keyword: /\b(dashboard|chart|graph|analytics|report)\b/i,      points: 10, label: 'analytics'       },
  { keyword: /\b(file|upload|storage|s3|cdn)\b/i,                  points: 10, label: 'file_storage'    },
  { keyword: /\b(api|rest|graphql|endpoint|route)\b/i,             points:  8, label: 'api'             },
  { keyword: /\b(email|notification|sms|twilio|sendgrid)\b/i,      points: 10, label: 'notifications'   },
  { keyword: /\b(multi.?tenant|saas|team|organization|workspace)\b/i, points: 20, label: 'multi_tenant' },
  { keyword: /\b(search|elasticsearch|full.?text|autocomplete)\b/i, points: 12, label: 'search'         },
  { keyword: /\b(deploy|ci|cd|docker|kubernetes|infra)\b/i,        points: 15, label: 'devops'          },
];

function modeFromScore(score: number): ExecutionMode {
  if (score <= 30) return 'simple';
  if (score <= 65) return 'standard';
  return 'complex';
}

function estimateTaskCount(score: number): number {
  if (score <= 30) return clamp(Math.round(score / 10) + 1, 1, 3);
  if (score <= 65) return clamp(Math.round(score / 8), 4, 8);
  return clamp(Math.round(score / 5), 9, 20);
}

export const complexityAnalyzer = {
  analyze(goal: string): ComplexityResult {
    const matched: ComplexityFactor[] = [];
    let rawScore = 5; // baseline

    for (const factor of FACTORS) {
      if (factor.keyword.test(goal)) {
        matched.push(factor);
        rawScore += factor.points;
      }
    }

    const score = clamp(rawScore, 0, 100);
    const mode  = modeFromScore(score);

    return {
      score,
      mode,
      estimatedTaskCount:   estimateTaskCount(score),
      requiresBrowser:      score >= 30,
      requiresVerification: score >= 20,
      factors:              matched.map((f) => f.label),
    };
  },

  scoreFromFactors(factors: string[]): number {
    const total = FACTORS
      .filter((f) => factors.includes(f.label))
      .reduce((sum, f) => sum + f.points, 5);
    return clamp(total, 0, 100);
  },

  isCriticalComplexity(score: number): boolean {
    return score >= 80;
  },
};
