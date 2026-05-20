const OVERALL_WEIGHTS = Object.freeze({
  promptClarity:   0.25,
  intentCertainty: 0.30,
  ambiguityScore:  0.20,
  capabilityCover: 0.15,
  strategyFit:     0.10,
});

export function computeKeywordCoverage(
  found:    readonly string[],
  expected: readonly string[],
): number {
  if (expected.length === 0) return 1;
  const matched = found.filter(f =>
    expected.some(e => e.includes(f) || f.includes(e))
  );
  return Math.round((matched.length / expected.length) * 100) / 100;
}

export function computeSignalConfidence(
  signalCount: number,
  maxSignals:  number,
): number {
  if (maxSignals === 0) return 1;
  const ratio = 1 - Math.min(signalCount / maxSignals, 1);
  return Math.round(ratio * 100) / 100;
}

export function computeOverallConfidence(params: {
  readonly promptClarity:   number;
  readonly intentCertainty: number;
  readonly ambiguityScore:  number;
  readonly capabilityCover: number;
  readonly strategyFit:     number;
}): number {
  const ambiguityFactor = 1 - params.ambiguityScore;

  const weighted =
    params.promptClarity   * OVERALL_WEIGHTS.promptClarity   +
    params.intentCertainty * OVERALL_WEIGHTS.intentCertainty +
    ambiguityFactor        * OVERALL_WEIGHTS.ambiguityScore  +
    params.capabilityCover * OVERALL_WEIGHTS.capabilityCover +
    params.strategyFit     * OVERALL_WEIGHTS.strategyFit;

  return Math.round(Math.min(1, Math.max(0, weighted)) * 100) / 100;
}

export function computeCapabilityCoverage(
  required: readonly string[],
  mapped:   readonly string[],
): number {
  if (required.length === 0) return 1;
  const covered = required.filter(r => mapped.some(m => m.includes(r) || r.includes(m)));
  return Math.round((covered.length / required.length) * 100) / 100;
}

export function normalizeScore(raw: number, min = 0, max = 1): number {
  const clamped = Math.max(min, Math.min(max, raw));
  return Math.round(clamped * 100) / 100;
}
