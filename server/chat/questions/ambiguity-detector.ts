export interface AmbiguityAnalysis {
  isAmbiguous:  boolean;
  ambiguities:  string[];
  confidence:   number;
}

const VAGUE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(something|stuff|things?|it|this|that)\b/i,                    label: 'Vague subject' },
  { pattern: /\b(better|good|nice|cool|improve|fix)\b(?!\s+the\s+\w)/i,        label: 'Undefined improvement target' },
  { pattern: /\b(somehow|maybe|probably|might|could|possibly)\b/i,             label: 'Uncertain intent' },
  { pattern: /\b(do|make|create)\s+(something|stuff|it)\b/i,                   label: 'Unspecified action target' },
  { pattern: /^(help|fix|update|change|do something)\.?\s*$/i,                 label: 'Incomplete request' },
];

export function analyzeAmbiguity(goal: string): AmbiguityAnalysis {
  const ambiguities: string[] = [];

  for (const { pattern, label } of VAGUE_PATTERNS) {
    if (pattern.test(goal)) ambiguities.push(label);
  }

  const isAmbiguous = ambiguities.length > 0;
  const confidence  = isAmbiguous ? Math.min(1, ambiguities.length * 0.35) : 0;
  return { isAmbiguous, ambiguities, confidence };
}

export function buildClarificationText(ambiguities: string[]): string {
  const joined = ambiguities.join(', ');
  return `Your request seems unclear (${joined}). Could you provide more detail about what you'd like to do?`;
}
