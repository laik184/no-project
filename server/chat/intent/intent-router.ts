/**
 * server/chat/intent/intent-router.ts
 *
 * Classifies a user message into one of six intent modes.
 * This is the gate that decides: Chat Agent vs Orchestration Engine.
 *
 * Rules:
 *  - No LLM call — purely deterministic keyword scoring
 *  - No regex spaghetti — scored keyword sets per intent
 *  - Returns confidence (0–1) and reasoning for observability
 *  - Never throws
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentMode =
  | 'conversation' // "hello", "how are you", "what is X"
  | 'build'        // "build X", "create Y", "implement Z"
  | 'fix'          // "fix X", "resolve error", "bug in Y"
  | 'modify'       // "change X", "update Y", "refactor Z"
  | 'debug'        // "why does X crash", "investigate Y", "trace Z"
  | 'explain';     // "explain X", "how does Y work", "walk me through Z"

export interface IntentResult {
  mode:       IntentMode;
  confidence: number;   // 0.0 – 1.0
  reasoning:  string;   // human-readable explanation of the decision
  normalized: string;   // lowercased + trimmed input used for scoring
}

// ── Keyword sets ──────────────────────────────────────────────────────────────

interface IntentSignal {
  keywords:  ReadonlyArray<string>;
  weight:    number; // contribution per matching keyword
}

type SignalMap = Record<IntentMode, ReadonlyArray<IntentSignal>>;

const SIGNALS: SignalMap = {
  conversation: [
    { keywords: ['hello', 'hi', 'hey', 'howdy', 'yo', 'sup'],                   weight: 0.9 },
    { keywords: ['how are you', 'how r you', "what's up", 'whats up'],          weight: 0.9 },
    { keywords: ['good morning', 'good afternoon', 'good evening', 'good night'], weight: 0.9 },
    { keywords: ['thanks', 'thank you', 'thx', 'ty', 'cheers'],                 weight: 0.8 },
    { keywords: ['ok', 'okay', 'got it', 'sounds good', 'perfect', 'great'],    weight: 0.7 },
    { keywords: ['who are you', 'what are you', 'tell me about yourself'],       weight: 0.85 },
    { keywords: ['can you help', 'can u help', 'i need help'],                   weight: 0.5 },
  ],

  explain: [
    { keywords: ['explain', 'what is', 'what are', 'what does', 'what do'],     weight: 0.8 },
    { keywords: ['how does', 'how do', 'how is', 'how are'],                    weight: 0.75 },
    { keywords: ['why does', 'why is', 'why are', 'why do'],                    weight: 0.6 },
    { keywords: ['walk me through', 'walk through', 'show me how'],              weight: 0.85 },
    { keywords: ['tell me about', 'describe', 'clarify', 'elaborate'],           weight: 0.7 },
    { keywords: ['what is react', 'what is typescript', 'what is node'],         weight: 0.9 },
    { keywords: ['overview of', 'summary of', 'explain the'],                   weight: 0.75 },
  ],

  build: [
    { keywords: ['build', 'create', 'make', 'develop', 'implement'],            weight: 0.85 },
    { keywords: ['add feature', 'add a feature', 'new feature'],                weight: 0.85 },
    { keywords: ['generate', 'scaffold', 'bootstrap', 'initialise', 'initialize'], weight: 0.8 },
    { keywords: ['write a', 'write an', 'write the'],                           weight: 0.6 },
    { keywords: ['set up', 'setup', 'configure', 'install', 'add'],             weight: 0.55 },
    { keywords: ['dashboard', 'landing page', 'login page', 'signup page'],     weight: 0.7 },
    { keywords: ['app', 'application', 'website', 'api', 'service', 'component'], weight: 0.5 },
  ],

  fix: [
    { keywords: ['fix', 'resolve', 'repair', 'correct', 'patch'],               weight: 0.9 },
    { keywords: ['bug', 'error', 'issue', 'problem', 'crash', 'broken'],        weight: 0.75 },
    { keywords: ['not working', "doesn't work", 'fails', 'failing', 'failed'],  weight: 0.8 },
    { keywords: ['TypeError', 'SyntaxError', 'ReferenceError', 'undefined'],    weight: 0.85 },
    { keywords: ['exception', 'traceback', 'stack trace', 'stack overflow'],    weight: 0.85 },
    { keywords: ['the login', 'the auth', 'the api', 'the page'],               weight: 0.3 },
  ],

  modify: [
    { keywords: ['change', 'update', 'edit', 'modify', 'alter', 'adjust'],      weight: 0.85 },
    { keywords: ['rename', 'move', 'restructure', 'reorganize', 'reorganise'],  weight: 0.85 },
    { keywords: ['refactor', 'clean up', 'cleanup', 'improve', 'optimise', 'optimize'], weight: 0.8 },
    { keywords: ['replace', 'swap', 'switch from', 'migrate'],                  weight: 0.75 },
    { keywords: ['add to', 'remove from', 'delete', 'strip out'],               weight: 0.65 },
  ],

  debug: [
    { keywords: ['debug', 'diagnose', 'investigate', 'trace', 'profile'],       weight: 0.9 },
    { keywords: ['what is causing', 'root cause', 'why is it', 'why does it'],  weight: 0.8 },
    { keywords: ['console.log', 'breakpoint', 'inspect', 'log out'],            weight: 0.8 },
    { keywords: ['slow', 'performance issue', 'memory leak', 'lag'],            weight: 0.7 },
    { keywords: ['check', 'verify', 'test', 'validate'],                        weight: 0.45 },
  ],
};

// ── Phrase pre-filters ────────────────────────────────────────────────────────
// Short messages (≤ 5 words) that carry no code-action verbs are conversation.

const SHORT_MESSAGE_THRESHOLD = 5;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const ACTION_VERBS = new Set([
  'build', 'create', 'make', 'implement', 'develop', 'fix', 'resolve',
  'update', 'change', 'modify', 'debug', 'refactor', 'explain', 'generate',
  'add', 'remove', 'delete', 'rename', 'migrate', 'deploy', 'configure',
  'install', 'scaffold', 'write', 'repair', 'patch',
]);

function hasActionVerb(normalized: string): boolean {
  return normalized.split(/\s+/).some((w) => ACTION_VERBS.has(w));
}

// ── Scoring engine ────────────────────────────────────────────────────────────

interface ModeScore {
  mode:    IntentMode;
  score:   number;
  matches: string[];
}

function scoreInput(normalized: string): ModeScore[] {
  const scores: ModeScore[] = [];

  for (const [mode, signals] of Object.entries(SIGNALS) as [IntentMode, ReadonlyArray<IntentSignal>][]) {
    let total   = 0;
    const hits: string[] = [];

    for (const signal of signals) {
      for (const kw of signal.keywords) {
        if (normalized.includes(kw)) {
          total += signal.weight;
          hits.push(kw);
        }
      }
    }

    scores.push({ mode, score: total, matches: hits });
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify a user message into an IntentMode.
 * Never throws — returns 'build' as the safe fallback.
 */
export function routeIntent(goal: string): IntentResult {
  try {
    const normalized = goal.toLowerCase().trim();

    // Short-message fast-path: if ≤ 5 words and no action verb → conversation
    if (wordCount(normalized) <= SHORT_MESSAGE_THRESHOLD && !hasActionVerb(normalized)) {
      return {
        mode:       'conversation',
        confidence: 0.9,
        reasoning:  `Short message (${wordCount(normalized)} words) with no action verb — conversational`,
        normalized,
      };
    }

    const ranked = scoreInput(normalized);
    const top    = ranked[0];
    const second = ranked[1];

    // No signals matched → default to build (safe agent-mode fallback)
    if (top.score === 0) {
      return {
        mode:       'build',
        confidence: 0.5,
        reasoning:  'No intent signals detected — defaulting to agent mode',
        normalized,
      };
    }

    // Conversation/explain modes require meaningful signal lead over build/fix
    // to avoid mis-classifying "explain how to build X" as conversational
    const margin = second.score > 0 ? top.score / second.score : Infinity;
    const needsMargin = top.mode === 'conversation' || top.mode === 'explain';

    if (needsMargin && margin < 1.3 && second.mode !== 'conversation' && second.mode !== 'explain') {
      // Close competition and second mode is a code-action mode → defer to second
      const winner = ranked.find((r) => r.mode !== 'conversation' && r.mode !== 'explain' && r.score > 0);
      if (winner) {
        return {
          mode:       winner.mode,
          confidence: Math.min(winner.score / (winner.score + top.score), 1),
          reasoning:  `Borderline: "${top.mode}" vs "${winner.mode}" — deferring to agent mode (margin ${margin.toFixed(2)})`,
          normalized,
        };
      }
    }

    const confidence = Math.min(top.score / (top.score + (second?.score ?? 0) + 0.01), 0.99);

    return {
      mode:       top.mode,
      confidence: Math.round(confidence * 100) / 100,
      reasoning:  `Matched "${top.mode}" with score ${top.score.toFixed(2)} via [${top.matches.slice(0, 3).join(', ')}]`,
      normalized,
    };
  } catch {
    // Never throw — safe fallback
    return {
      mode:       'build',
      confidence: 0.5,
      reasoning:  'Intent routing error — defaulting to agent mode',
      normalized: goal,
    };
  }
}

/** Whether the intent should be handled by the Chat Agent (not Orchestration). */
export function isChatMode(mode: IntentMode): boolean {
  return mode === 'conversation' || mode === 'explain';
}
