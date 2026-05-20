import type { RuntimeAnalyzerData } from './types';

const baseState: RuntimeAnalyzerData = {
  runtimeFlow: {
    callGraph: {},
    executionOrder: [],
    entryToExitPaths: [],
  },
  lifecycle: {
    patterns: [],
  },
  asyncFlow: {
    chains: [],
    parallelGroups: [],
  },
  executionPaths: {
    branches: [],
    conditionalNodes: [],
  },
  anomalies: [],
};

export const INITIAL_RUNTIME_ANALYZER_STATE: RuntimeAnalyzerData = Object.freeze(baseState);
