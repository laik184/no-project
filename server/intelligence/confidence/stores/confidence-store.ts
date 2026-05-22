/**
 * confidence-store.ts
 *
 * In-memory store for current agent confidence records.
 * Keyed by agentId. Thread-safe for single-process Node.js.
 * Persistence is handled separately by confidence-memory-bridge.ts.
 */

import type { AgentConfidenceRecord, ConfidenceState } from "../confidence-types.ts";
import { STORAGE } from "../confidence-thresholds.ts";

// ── Store ─────────────────────────────────────────────────────────────────────

const _records = new Map<string, AgentConfidenceRecord>();

// ── Writers ───────────────────────────────────────────────────────────────────

export function upsertConfidence(record: AgentConfidenceRecord): void {
  _records.set(record.agentId, { ...record });
}

export function updateConfidenceScore(
  agentId: string,
  score:   number,
  state:   ConfidenceState,
  ts:      number = Date.now(),
): void {
  const existing = _records.get(agentId);
  if (!existing) return;
  _records.set(agentId, { ...existing, confidenceScore: score, state, ts });
}

export function updateHallucinationRisk(agentId: string, risk: number): void {
  const existing = _records.get(agentId);
  if (!existing) return;
  _records.set(agentId, { ...existing, hallucinationRisk: risk });
}

export function incrementPolicyViolations(agentId: string): void {
  const existing = _records.get(agentId);
  if (!existing) return;
  _records.set(agentId, {
    ...existing,
    policyViolations: existing.policyViolations + 1,
  });
}

export function blockAgent(agentId: string, runId: string): void {
  const existing = _records.get(agentId);
  if (!existing) return;
  _records.set(agentId, {
    ...existing,
    state:           "BLOCKED",
    confidenceScore: 0,
    runId,
    ts:              Date.now(),
  });
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getConfidence(agentId: string): AgentConfidenceRecord | undefined {
  return _records.get(agentId);
}

export function getConfidenceScore(agentId: string): number {
  return _records.get(agentId)?.confidenceScore ?? 0.70;
}

export function getConfidenceState(agentId: string): ConfidenceState {
  return _records.get(agentId)?.state ?? "STABLE";
}

export function isAgentBlocked(agentId: string): boolean {
  return _records.get(agentId)?.state === "BLOCKED";
}

export function getAllRecords(): AgentConfidenceRecord[] {
  return Array.from(_records.values());
}

export function getTopAgents(n: number): AgentConfidenceRecord[] {
  return Array.from(_records.values())
    .filter(r => r.state !== "BLOCKED")
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, n);
}

export function getAgentsByState(state: ConfidenceState): AgentConfidenceRecord[] {
  return Array.from(_records.values()).filter(r => r.state === state);
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export function pruneStaleRecords(): number {
  const cutoff = Date.now() - STORAGE.CONFIDENCE_TTL_MS;
  let pruned   = 0;
  for (const [id, record] of _records) {
    if (record.ts < cutoff) {
      _records.delete(id);
      pruned++;
    }
  }
  return pruned;
}

export function clearAll(): void {
  _records.clear();
}

export function size(): number {
  return _records.size;
}
