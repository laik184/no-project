import type {
  DiscoverySession,
  DiscoverySnapshot,
  RawDiscoveryResult,
  DiscoveryStage,
  SourceSummary,
} from "./types.js";
import { MAX_HISTORY } from "./types.js";

let activeSession:     DiscoverySession | null = null;
let lastRawResult:     RawDiscoveryResult | null = null;
let lastSourceSummary: SourceSummary | null = null;
let counter = 0;
const snapshots: DiscoverySnapshot[] = [];

export function createSession(context: string): DiscoverySession {
  counter += 1;
  const tag = context.trim().slice(0, 24).replace(/\s+/g, "-") || "default";
  const session: DiscoverySession = Object.freeze({
    sessionId:  `dsc-${counter}-${tag}-${Date.now()}`,
    startedAt:  Date.now(),
    stage:      "IDLE",
  });
  activeSession = session;
  return session;
}

export function advanceStage(stage: DiscoveryStage): void {
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

export function getSession(): DiscoverySession | null {
  return activeSession;
}

export function storeRawResult(raw: RawDiscoveryResult): void {
  lastRawResult = raw;
}

export function storeSourceSummary(summary: SourceSummary): void {
  lastSourceSummary = summary;
}

export function getRawResult(): RawDiscoveryResult | null {
  return lastRawResult;
}

export function getSourceSummary(): SourceSummary | null {
  return lastSourceSummary;
}

export function addSnapshot(snapshot: DiscoverySnapshot): void {
  snapshots.push(snapshot);
  if (snapshots.length > MAX_HISTORY) {
    snapshots.splice(0, snapshots.length - MAX_HISTORY);
  }
}

export function getLastSnapshot(): DiscoverySnapshot | null {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1]! : null;
}

export function getSnapshotHistory(): readonly DiscoverySnapshot[] {
  return Object.freeze([...snapshots]);
}

export function clearAll(): void {
  activeSession     = null;
  lastRawResult     = null;
  lastSourceSummary = null;
  counter           = 0;
  snapshots.length  = 0;
}
