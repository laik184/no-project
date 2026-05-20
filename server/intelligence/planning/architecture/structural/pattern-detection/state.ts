import type { PatternAnalysisState } from "./types.js";

let _state: PatternAnalysisState = Object.freeze({
  files: Object.freeze([]),
  importGraph: Object.freeze({}),
  modules: Object.freeze([]),
  detectedPatterns: Object.freeze([]),
  antiPatterns: Object.freeze([]),
});

export function setPatternState(nextState: PatternAnalysisState): void {
  _state = Object.freeze({
    files: Object.freeze([...nextState.files]),
    importGraph: Object.freeze(
      Object.fromEntries(Object.entries(nextState.importGraph).map(([key, value]) => [key, Object.freeze([...value])]))
    ),
    modules: Object.freeze([...nextState.modules]),
    detectedPatterns: Object.freeze([...nextState.detectedPatterns]),
    antiPatterns: Object.freeze([...nextState.antiPatterns]),
  });
}

export function getPatternState(): Readonly<PatternAnalysisState> {
  return _state;
}

export function resetPatternState(): void {
  _state = Object.freeze({
    files: Object.freeze([]),
    importGraph: Object.freeze({}),
    modules: Object.freeze([]),
    detectedPatterns: Object.freeze([]),
    antiPatterns: Object.freeze([]),
  });
}
