import type {
  AnalysisStage,
  ComponentTestMapping,
  CriticalComponentResult,
  IntermediateMapping,
  TestingAnalysisInput,
  TestingSession,
} from "./types.js";

let _session: TestingSession | null = null;

export function initSession(input: TestingAnalysisInput): void {
  _session = Object.freeze({
    input,
    stage: "idle" as AnalysisStage,
    intermediate: null,
  });
}

export function setStage(stage: AnalysisStage): void {
  if (_session === null) return;
  _session = Object.freeze({ ..._session, stage });
}

export function storeIntermediateMapping(
  componentMappings: readonly ComponentTestMapping[],
  criticalComponents: readonly CriticalComponentResult[]
): void {
  if (_session === null) return;
  const intermediate: IntermediateMapping = Object.freeze({
    componentMappings: Object.freeze([...componentMappings]),
    criticalComponents: Object.freeze([...criticalComponents]),
  });
  _session = Object.freeze({ ..._session, intermediate });
}

export function getSession(): Readonly<TestingSession> | null {
  return _session;
}

export function clearSession(): void {
  _session = null;
}
