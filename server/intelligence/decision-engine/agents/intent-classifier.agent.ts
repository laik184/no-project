import type { DecisionInput, ClassifiedIntent, Intent } from '../types.ts';
import { normalizeConfidence } from '../utils/normalization.util.ts';

const INTENT_KEYWORD_MAP: Record<Intent, string[]> = {
  generate: [
    'create', 'generate', 'build', 'make', 'write', 'scaffold', 'new',
    'setup', 'init', 'add', 'implement', 'develop',
  ],
  fix: [
    'fix', 'repair', 'resolve', 'debug', 'patch', 'correct', 'solve',
    'error', 'bug', 'issue', 'broken', 'crash', 'fail',
  ],
  analyze: [
    'analyze', 'analyse', 'review', 'audit', 'inspect', 'check', 'scan',
    'evaluate', 'assess', 'examine', 'report', 'detect',
  ],
  deploy: [
    'deploy', 'release', 'ship', 'publish', 'launch', 'push', 'run',
    'start', 'host', 'containerize', 'docker', 'ci', 'cd', 'pipeline',
  ],
  optimize: [
    'optimize', 'optimise', 'improve', 'speed', 'performance', 'refactor',
    'enhance', 'tune', 'cache', 'faster', 'slow', 'memory', 'reduce',
  ],
};

function tokenize(input: string): string[] {
  return input.toLowerCase().split(/\s+|[.,;:!?()[\]{}"'`]/);
}

function matchKeywords(tokens: string[], keywords: string[]): string[] {
  return keywords.filter((kw) => tokens.some((t) => t.includes(kw)));
}

export function classifyIntent(input: DecisionInput): ClassifiedIntent {
  const tokens = tokenize(input.userInput);
  const scores: Record<Intent, number> = {
    generate: 0,
    fix: 0,
    analyze: 0,
    deploy: 0,
    optimize: 0,
  };
  const matchedKeywords: Record<Intent, string[]> = {
    generate: [],
    fix: [],
    analyze: [],
    deploy: [],
    optimize: [],
  };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORD_MAP) as [Intent, string[]][]) {
    const matched = matchKeywords(tokens, keywords);
    matchedKeywords[intent] = matched;
    scores[intent] = matched.length;
  }

  const entries = Object.entries(scores) as [Intent, number][];
  const sorted = entries.sort(([, a], [, b]) => b - a);
  const [topIntent, topScore] = sorted[0];
  const totalScore = entries.reduce((s, [, v]) => s + v, 0);

  const rawConfidence = totalScore === 0 ? 0.4 : topScore / totalScore;
  const confidence = normalizeConfidence(
    totalScore === 0 ? 0.4 : Math.max(rawConfidence, 0.4),
  );

  return Object.freeze({
    intent: topIntent,
    confidence,
    keywords: matchedKeywords[topIntent],
    raw: input.userInput,
  });
}
