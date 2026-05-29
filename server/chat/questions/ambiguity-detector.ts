/**
 * ambiguity-detector.ts — Heuristic detection of ambiguous user goals.
 * Pure analysis — no I/O, no side effects.
 */

export interface AmbiguityAnalysis {
  isAmbiguous:  boolean;
  ambiguities:  string[];
  confidence:   number;  // 0–1
}

/** Keywords that signal an underspecified goal. */
const AMBIGUITY_SIGNALS: Array<[RegExp, string]> = [
  [/\bmake it better\b/i,          'Goal is too vague — "better" is not measurable'],
  [/\bimprove\s*it\b/i,            'Improvement target is unspecified'],
  [/\badd\s+some\b/i,              '"Some" is unquantified'],
  [/\bfix\s+(it|things?)\b/i,      'Fix target is not identified'],
  [/\boptimize\b(?!.*for)/i,       'Optimization goal/metric is missing'],
  [/\bclean\s+up\b/i,              'Clean-up scope is not defined'],
  [/\b(something|anything)\b/i,    'Goal contains indefinite references'],
  [/\blike\s+replit\b/i,           'Reference product features need explicit enumeration'],
];

/** Minimum goal length to avoid trivially empty requests. */
const MIN_GOAL_CHARS = 10;

export function analyzeAmbiguity(goal: string): AmbiguityAnalysis {
  const ambiguities: string[] = [];

  if (goal.trim().length < MIN_GOAL_CHARS) {
    ambiguities.push('Goal is too short to be actionable');
  }

  for (const [pattern, reason] of AMBIGUITY_SIGNALS) {
    if (pattern.test(goal)) {
      ambiguities.push(reason);
    }
  }

  const isAmbiguous = ambiguities.length > 0;
  const confidence  = isAmbiguous
    ? Math.min(1, ambiguities.length * 0.35)
    : 0;

  return { isAmbiguous, ambiguities, confidence };
}

/** Build clarification question text from detected ambiguities. */
export function buildClarificationText(ambiguities: string[]): string {
  if (ambiguities.length === 1) {
    return `I need a bit more detail: ${ambiguities[0]}. Can you clarify?`;
  }
  const list = ambiguities.map((a) => `• ${a}`).join('\n');
  return `I noticed a few things that need clarification:\n${list}\n\nWhich option below best describes your intent?`;
}
