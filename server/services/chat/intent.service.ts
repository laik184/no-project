/**
 * server/services/chat/intent.service.ts
 *
 * Classifies user goals into intent modes using deterministic keyword scoring.
 * Decides whether to use Chat Agent or Orchestration Engine.
 * Pure logic — no I/O, no side effects.
 */

export type IntentMode =
  | 'conversation'
  | 'build'
  | 'fix'
  | 'modify'
  | 'debug'
  | 'explain';

export interface IntentResult {
  mode:       IntentMode;
  confidence: number;
  signals:    string[];
}

const SIGNALS: Array<{ pattern: RegExp; mode: IntentMode; label: string }> = [
  { pattern: /\b(build|create|make|generate|scaffold|new project|new app)\b/i, mode: 'build',        label: 'build' },
  { pattern: /\b(fix|repair|broken|error|bug|crash|failing|not working)\b/i,   mode: 'fix',          label: 'fix' },
  { pattern: /\b(update|change|modify|edit|refactor|rewrite|improve)\b/i,       mode: 'modify',       label: 'modify' },
  { pattern: /\b(debug|diagnose|trace|investigate|inspect|profile)\b/i,          mode: 'debug',        label: 'debug' },
  { pattern: /\b(explain|describe|what is|how does|why does|what does)\b/i,     mode: 'explain',      label: 'explain' },
  { pattern: /^(hi|hello|hey|thanks|thank you|ok|okay|sure|yes|no)\b/i,         mode: 'conversation', label: 'conversation' },
];

export function routeIntent(goal: string): IntentResult {
  const signals: string[] = [];
  const scores  = new Map<IntentMode, number>();

  for (const { pattern, mode, label } of SIGNALS) {
    if (pattern.test(goal)) {
      signals.push(label);
      scores.set(mode, (scores.get(mode) ?? 0) + 1);
    }
  }

  let topMode: IntentMode  = 'build';
  let topScore             = 0;

  for (const [mode, score] of scores) {
    if (score > topScore) { topScore = score; topMode = mode; }
  }

  const confidence = topScore > 0 ? Math.min(1, topScore * 0.4) : 0.2;
  return { mode: topMode, confidence, signals };
}

export function isChatMode(goal: string): boolean {
  return routeIntent(goal).mode === 'conversation';
}

export const intentService = {
  route:      routeIntent,
  isChatMode,
  classify:   routeIntent,
};
