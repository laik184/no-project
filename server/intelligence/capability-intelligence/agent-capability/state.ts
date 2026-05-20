import type {
  CapabilitySession,
  AgentCapabilityMatrix,
  SessionStage,
} from "./types.js";
import { MAX_HISTORY } from "./types.js";

let activeSession:   CapabilitySession | null = null;
let latestMatrix:    AgentCapabilityMatrix | null = null;
let internalCounter = 0;
const matrixHistory: AgentCapabilityMatrix[] = [];

export function createSession(scanContext: string): CapabilitySession {
  internalCounter += 1;
  const contextTag = scanContext.trim().slice(0, 32).replace(/\s+/g, "-") || "default";
  const session: CapabilitySession = Object.freeze({
    sessionId:  `acs-${internalCounter}-${contextTag}-${Date.now()}`,
    startedAt:  Date.now(),
    stage:      "IDLE",
  });
  activeSession = session;
  return session;
}

export function advanceStage(stage: SessionStage): void {
  if (!activeSession) return;
  activeSession = Object.freeze({ ...activeSession, stage });
}

export function completeSession(): void {
  if (!activeSession) return;
  activeSession = Object.freeze({
    ...activeSession,
    stage:       "COMPLETE",
    completedAt: Date.now(),
  });
}

export function failSession(): void {
  if (!activeSession) return;
  activeSession = Object.freeze({
    ...activeSession,
    stage:       "FAILED",
    completedAt: Date.now(),
  });
}

export function getSession(): CapabilitySession | null {
  return activeSession;
}

export function storeMatrix(matrix: AgentCapabilityMatrix): void {
  latestMatrix = matrix;
  matrixHistory.push(matrix);
  if (matrixHistory.length > MAX_HISTORY) {
    matrixHistory.splice(0, matrixHistory.length - MAX_HISTORY);
  }
}

export function getLatestMatrix(): AgentCapabilityMatrix | null {
  return latestMatrix;
}

export function getMatrixHistory(): readonly AgentCapabilityMatrix[] {
  return Object.freeze([...matrixHistory]);
}

export function clearAll(): void {
  activeSession        = null;
  latestMatrix         = null;
  internalCounter      = 0;
  matrixHistory.length = 0;
}
