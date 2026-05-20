import type { AnalysisResult } from "./types";

export interface MetaReasoningHistoryEntry {
  readonly decision: string;
  readonly outcome: string;
  readonly analysis: AnalysisResult;
  readonly recordedAt: number;
}

export interface MetaReasoningStateShape {
  readonly lastAnalysis: AnalysisResult | null;
  readonly history: readonly MetaReasoningHistoryEntry[];
}

export const MetaReasoningState: MetaReasoningStateShape = Object.freeze({
  lastAnalysis: null,
  history: Object.freeze([]) as readonly MetaReasoningHistoryEntry[],
});

let mutableState: MetaReasoningStateShape = MetaReasoningState;

export function getMetaState(): MetaReasoningStateShape {
  return mutableState;
}

export function recordAnalysis(
  decision: string,
  outcome: string,
  analysis: AnalysisResult
): void {
  const entry: MetaReasoningHistoryEntry = Object.freeze({
    decision,
    outcome,
    analysis: Object.freeze({ ...analysis }),
    recordedAt: Date.now(),
  });

  const history = [...mutableState.history, entry].slice(-100);

  mutableState = Object.freeze({
    lastAnalysis: Object.freeze({ ...analysis }),
    history: Object.freeze(history),
  });
}

export function resetMetaState(): void {
  mutableState = Object.freeze({
    lastAnalysis: null,
    history: Object.freeze([]),
  });
}
