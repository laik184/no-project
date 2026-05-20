import type { RefinedPrompt, ExtractedIntent, AmbiguityReport, AmbiguitySignal } from "../types.js";
import { normalizeScore } from "../utils/confidence-calculator.util.js";

const HIGH_AMBIGUITY_THRESHOLD = 0.5;

const VAGUE_TERMS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ["something", "Specify the exact artifact, file, or system component to be operated on."],
  ["somehow",   "Define the specific mechanism, algorithm, or approach to be used."],
  ["stuff",     "Enumerate the specific items, files, or components intended."],
  ["things",    "List the specific entities, properties, or operations intended."],
  ["maybe",     "Confirm whether this is a required or optional step in the plan."],
  ["perhaps",   "Confirm intent — either include or exclude this item from the plan."],
  ["etc",       "Enumerate all remaining items explicitly."],
  ["etc.",      "Enumerate all remaining items explicitly."],
  ["and so on", "Enumerate all remaining items explicitly."],
  ["some",      "Specify the exact count or selection criteria."],
]);

const OVERLOADED_TERMS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ["model",     "Clarify: data model (DB schema), ML model, or domain model?"],
  ["service",   "Clarify: microservice (HTTP), business-logic layer, or OS service?"],
  ["module",    "Clarify: Node.js module, application module, or feature module?"],
  ["hook",      "Clarify: React hook, lifecycle hook, or event hook?"],
  ["store",     "Clarify: Redux store, file store, or database store?"],
  ["manager",   "Clarify: singleton manager class, UI manager, or process manager?"],
  ["handler",   "Clarify: error handler, event handler, or request handler?"],
  ["provider",   "Clarify: DI provider, data provider, or auth provider?"],
]);

const MISSING_CONTEXT_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  [/\bit\b/, "Replace 'it' with the specific noun or entity being referenced."],
  [/\bthis\b/, "Replace 'this' with the specific subject being described."],
  [/\bthe thing\b/, "Replace 'the thing' with the actual component or item name."],
  [/\blike before\b/, "Remove relative references — describe the exact requirement."],
]);

function detectVagueTerms(text: string): readonly AmbiguitySignal[] {
  const lower   = text.toLowerCase();
  const signals: AmbiguitySignal[] = [];

  for (const [term, resolution] of VAGUE_TERMS) {
    if (lower.includes(term)) {
      signals.push(Object.freeze<AmbiguitySignal>({
        term,
        type:       "vague",
        resolution,
        confidence: 0.85,
      }));
    }
  }
  return Object.freeze(signals);
}

function detectOverloadedTerms(text: string): readonly AmbiguitySignal[] {
  const lower   = text.toLowerCase();
  const signals: AmbiguitySignal[] = [];

  for (const [term, resolution] of OVERLOADED_TERMS) {
    const pattern = new RegExp(`\\b${term}\\b`);
    if (pattern.test(lower)) {
      signals.push(Object.freeze<AmbiguitySignal>({
        term,
        type:       "overloaded",
        resolution,
        confidence: 0.75,
      }));
    }
  }
  return Object.freeze(signals);
}

function detectMissingContext(text: string): readonly AmbiguitySignal[] {
  const lower   = text.toLowerCase();
  const signals: AmbiguitySignal[] = [];

  for (const [pattern, resolution] of MISSING_CONTEXT_PATTERNS) {
    if (pattern.test(lower)) {
      signals.push(Object.freeze<AmbiguitySignal>({
        term:       pattern.source,
        type:       "missing-context",
        resolution,
        confidence: 0.70,
      }));
    }
  }
  return Object.freeze(signals);
}

function computeAmbiguityScore(signals: readonly AmbiguitySignal[]): number {
  if (signals.length === 0) return 0;
  const weightedSum = signals.reduce((acc, s) => acc + s.confidence, 0);
  return normalizeScore(Math.min(1, weightedSum / (signals.length * 2 + 2)));
}

function buildResolvedText(
  original: string,
  signals:  readonly AmbiguitySignal[],
): string {
  if (signals.length === 0) return original;
  const hints = signals.slice(0, 3).map(s => `[Clarify: ${s.term} → ${s.resolution.slice(0, 60)}]`);
  return `${original} ${hints.join(" ")}`.trim();
}

export function resolveAmbiguity(
  refined: RefinedPrompt,
  intent:  ExtractedIntent,
): AmbiguityReport {
  const text = refined.normalized;

  const vagueSignals     = detectVagueTerms(text);
  const overloadedSignals = detectOverloadedTerms(text);
  const contextSignals   = detectMissingContext(text);

  const intentLowConfidence: AmbiguitySignal[] = [];
  if (intent.confidence < 0.4) {
    intentLowConfidence.push(Object.freeze<AmbiguitySignal>({
      term:       "primary intent",
      type:       "missing-context",
      resolution: "State the main action clearly (e.g., 'Create a REST API for...').",
      confidence: 0.90,
    }));
  }

  const allSignals = Object.freeze([
    ...vagueSignals,
    ...overloadedSignals,
    ...contextSignals,
    ...intentLowConfidence,
  ]);

  const overallAmbiguity = computeAmbiguityScore(allSignals);
  const resolvedText     = buildResolvedText(refined.normalized, allSignals);
  const isHighlyAmbiguous = overallAmbiguity >= HIGH_AMBIGUITY_THRESHOLD;

  return Object.freeze<AmbiguityReport>({
    signals: allSignals,
    overallAmbiguity,
    resolvedText,
    isHighlyAmbiguous,
  });
}
