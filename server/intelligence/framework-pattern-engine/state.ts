export interface FrameworkPatternEngineState {
  readonly analyzedFiles: readonly string[];
  readonly detectedPatterns: readonly string[];
  readonly violationsCount: number;
  readonly scoreHistory: readonly number[];
}

export function createInitialState(): FrameworkPatternEngineState {
  return Object.freeze({
    analyzedFiles: Object.freeze([]),
    detectedPatterns: Object.freeze([]),
    violationsCount: 0,
    scoreHistory: Object.freeze([]),
  });
}

export function withAnalyzedFiles(
  state: FrameworkPatternEngineState,
  analyzedFiles: readonly string[],
): FrameworkPatternEngineState {
  return Object.freeze({
    ...state,
    analyzedFiles: Object.freeze([...analyzedFiles]),
  });
}

export function withDetectedPatterns(
  state: FrameworkPatternEngineState,
  detectedPatterns: readonly string[],
): FrameworkPatternEngineState {
  return Object.freeze({
    ...state,
    detectedPatterns: Object.freeze([...detectedPatterns]),
  });
}

export function withViolationsCount(
  state: FrameworkPatternEngineState,
  violationsCount: number,
): FrameworkPatternEngineState {
  return Object.freeze({
    ...state,
    violationsCount,
  });
}

export function withScoreHistory(
  state: FrameworkPatternEngineState,
  scoreHistory: readonly number[],
): FrameworkPatternEngineState {
  return Object.freeze({
    ...state,
    scoreHistory: Object.freeze([...scoreHistory]),
  });
}
