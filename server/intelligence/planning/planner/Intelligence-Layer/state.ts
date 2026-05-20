import type {
  IntelligenceSession,
  RefinementPhase,
  RawInput,
  RefinedPrompt,
  ExtractedIntent,
  AmbiguityReport,
  CapabilityMap,
  StrategyHint,
} from "./types.js";

let _session: IntelligenceSession | null = null;

export function initSession(rawInput: RawInput, sessionId: string): void {
  _session = Object.freeze<IntelligenceSession>({
    sessionId,
    rawInput:     Object.freeze(rawInput),
    phase:        "idle",
    startedAt:    Date.now(),
    intermediate: Object.freeze({}),
  });
}

export function getSession(): Readonly<IntelligenceSession> | null {
  return _session;
}

export function setPhase(phase: RefinementPhase): void {
  if (_session === null) return;
  _session = Object.freeze<IntelligenceSession>({ ..._session, phase });
}

export function setRefinedPrompt(refinedPrompt: RefinedPrompt): void {
  if (_session === null) return;
  _session = Object.freeze<IntelligenceSession>({
    ..._session,
    intermediate: Object.freeze({ ..._session.intermediate, refinedPrompt }),
  });
}

export function setIntent(intent: ExtractedIntent): void {
  if (_session === null) return;
  _session = Object.freeze<IntelligenceSession>({
    ..._session,
    intermediate: Object.freeze({ ..._session.intermediate, intent }),
  });
}

export function setAmbiguityReport(ambiguityReport: AmbiguityReport): void {
  if (_session === null) return;
  _session = Object.freeze<IntelligenceSession>({
    ..._session,
    intermediate: Object.freeze({ ..._session.intermediate, ambiguityReport }),
  });
}

export function setCapabilityMap(capabilityMap: CapabilityMap): void {
  if (_session === null) return;
  _session = Object.freeze<IntelligenceSession>({
    ..._session,
    intermediate: Object.freeze({ ..._session.intermediate, capabilityMap }),
  });
}

export function setStrategyHint(strategyHint: StrategyHint): void {
  if (_session === null) return;
  _session = Object.freeze<IntelligenceSession>({
    ..._session,
    intermediate: Object.freeze({ ..._session.intermediate, strategyHint }),
  });
}

export function clearSession(): void {
  _session = null;
}
