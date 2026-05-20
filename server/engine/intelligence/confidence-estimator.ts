/**
 * confidence-estimator.ts
 *
 * Estimates agent confidence from output signals.
 * Used by hallucination detector and supervisor to gate execution.
 */

export interface ConfidenceSignals {
  outputLength:       number;
  evidenceCount:      number;    // tool results, file reads, etc.
  hedgeWordCount:     number;    // "maybe", "probably", "I think"
  assertionCount:     number;    // "I have", "it is", "the file"
  codeBlockCount:     number;    // actual code produced
  toolCallCount:      number;    // tools successfully called
  errorMentions:      number;    // explicit error acknowledgments
  repetitionRatio:    number;    // 0.0–1.0 (1.0 = fully repeated)
}

export interface ConfidenceResult {
  score:       number;      // 0.0–1.0
  calibrated:  number;      // score adjusted for context (e.g., step 1 vs step 15)
  level:       "high" | "medium" | "low" | "suspicious";
  signals:     ConfidenceSignals;
  flags:       string[];
  trustOutput: boolean;
}

// ── Pattern extractors ────────────────────────────────────────────────────────

const HEDGE_PATTERNS = [
  /\b(maybe|perhaps|probably|i think|i believe|might|could be|seem[s]? to|appear[s]? to|not sure|unclear)\b/gi,
];
const ASSERTION_PATTERNS = [
  /\b(i have|i've|i already|i just|the file (is|exists)|it works|done|completed)\b/gi,
];
const EVIDENCE_PATTERNS = [
  /```[\s\S]*?```/g,              // code blocks
  /output:|result:|→|✓|✗/g,      // tool output markers
  /error:|warning:|exception:/gi, // explicit problem acknowledgment
];

export function extractSignals(output: string): ConfidenceSignals {
  const hedgeWordCount  = (output.match(new RegExp(HEDGE_PATTERNS[0].source, "gi")) ?? []).length;
  const assertionCount  = (output.match(new RegExp(ASSERTION_PATTERNS[0].source, "gi")) ?? []).length;
  const codeBlockCount  = (output.match(/```[\s\S]*?```/g) ?? []).length;
  const evidenceCount   = (output.match(new RegExp(EVIDENCE_PATTERNS.map(p => p.source).join("|"), "g")) ?? []).length;
  const errorMentions   = (output.match(/error:|warning:|exception:/gi) ?? []).length;

  return {
    outputLength:    output.length,
    evidenceCount,
    hedgeWordCount,
    assertionCount,
    codeBlockCount,
    toolCallCount:   0,        // caller supplies this
    errorMentions,
    repetitionRatio: 0,        // caller supplies this
  };
}

// ── Scorer ────────────────────────────────────────────────────────────────────

export function estimateConfidence(
  signals: ConfidenceSignals,
  stepIndex: number = 0,
  maxSteps:  number = 25,
): ConfidenceResult {
  let score = 0.50;  // base
  const flags: string[] = [];

  // Evidence boosts confidence
  score += Math.min(0.20, signals.evidenceCount * 0.04);
  score += Math.min(0.10, signals.codeBlockCount * 0.05);
  score += Math.min(0.10, signals.toolCallCount  * 0.03);

  // Hedging reduces confidence
  score -= Math.min(0.20, signals.hedgeWordCount * 0.04);

  // Ungrounded assertions reduce confidence
  if (signals.assertionCount > 3 && signals.evidenceCount === 0) {
    score -= 0.20;
    flags.push("High assertion count with no evidence");
  }

  // Repetition is a strong negative signal
  score -= signals.repetitionRatio * 0.40;
  if (signals.repetitionRatio > 0.5) flags.push("High repetition detected");

  // Very short output on a complex task
  if (signals.outputLength < 100 && signals.codeBlockCount === 0) {
    score -= 0.10;
    flags.push("Suspiciously short output");
  }

  // Error acknowledgment is actually a positive signal (honest)
  if (signals.errorMentions > 0) score += 0.05;

  // Step context: early steps should have lower confidence expectations
  const stepProgress   = maxSteps > 0 ? stepIndex / maxSteps : 0;
  const calibrated     = score * (0.7 + stepProgress * 0.3);

  score     = Math.max(0, Math.min(1.0, score));
  const cal = Math.max(0, Math.min(1.0, calibrated));

  const level: ConfidenceResult["level"] =
    signals.repetitionRatio > 0.6 ? "suspicious"
    : cal >= 0.75 ? "high"
    : cal >= 0.50 ? "medium"
    : "low";

  if (level === "suspicious") flags.push("Repetition loop suspected — verify output");
  if (cal < 0.30) flags.push("Low confidence — consider requesting clarification");

  return {
    score,
    calibrated:  cal,
    level,
    signals,
    flags,
    trustOutput: cal >= 0.45 && level !== "suspicious",
  };
}

// ── Quick check ───────────────────────────────────────────────────────────────

export function quickConfidenceCheck(output: string, toolCallCount = 0): boolean {
  const signals = extractSignals(output);
  signals.toolCallCount = toolCallCount;
  const result = estimateConfidence(signals);
  return result.trustOutput;
}
