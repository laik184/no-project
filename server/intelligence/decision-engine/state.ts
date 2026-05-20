import type { DecisionRecord, FinalDecision } from './types.ts';

const MAX_HISTORY = 10;

export interface DecisionState {
  currentDecision: FinalDecision | null;
  previousDecisions: DecisionRecord[];
  confidenceScore: number;
  selectedAgents: string[];
  decisionHistory: DecisionRecord[];
}

export function createInitialState(): DecisionState {
  return {
    currentDecision: null,
    previousDecisions: [],
    confidenceScore: 0,
    selectedAgents: [],
    decisionHistory: [],
  };
}

export function withCurrentDecision(
  state: DecisionState,
  decision: FinalDecision,
  requestId: string,
): DecisionState {
  const record: DecisionRecord = {
    requestId,
    decision,
    timestamp: Date.now(),
    confidence: decision.confidence,
  };

  const updatedHistory = [record, ...state.decisionHistory].slice(0, MAX_HISTORY);
  const updatedPrevious = state.currentDecision
    ? [
        { ...state.currentDecision, requestId, timestamp: Date.now(), confidence: state.confidenceScore } as unknown as DecisionRecord,
        ...state.previousDecisions,
      ].slice(0, MAX_HISTORY)
    : state.previousDecisions;

  return {
    currentDecision: decision,
    previousDecisions: updatedPrevious,
    confidenceScore: decision.confidence,
    selectedAgents: decision.selectedAgents,
    decisionHistory: updatedHistory,
  };
}

export function withConfidence(state: DecisionState, score: number): DecisionState {
  return { ...state, confidenceScore: score };
}

export function withSelectedAgents(state: DecisionState, agents: string[]): DecisionState {
  return { ...state, selectedAgents: agents };
}

export function getLastDecision(state: DecisionState): DecisionRecord | null {
  return state.decisionHistory[0] ?? null;
}
