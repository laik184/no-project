/**
 * confidence-registry.ts
 *
 * Registers agents into the confidence system and provides lookup helpers.
 * Acts as the authoritative map from agentId → role metadata.
 * Lightweight — no scoring or telemetry logic here.
 */

import { RELIABILITY } from "./confidence-thresholds.ts";
import { scoreToState }  from "./confidence-thresholds.ts";
import type { AgentConfidenceRecord, ConfidenceState } from "./confidence-types.ts";
import { upsertConfidence, getConfidence } from "./stores/confidence-store.ts";

// ── Agent registration metadata ───────────────────────────────────────────────

export interface AgentRegistration {
  agentId:     string;
  role:        string;
  category:    string;   // e.g. "generation", "security", "recovery"
  description: string;
  registeredAt: number;
}

// ── Registry store ────────────────────────────────────────────────────────────

const _registry = new Map<string, AgentRegistration>();

// ── Registration ──────────────────────────────────────────────────────────────

export function registerAgent(reg: Omit<AgentRegistration, "registeredAt">): void {
  if (_registry.has(reg.agentId)) return;   // idempotent

  _registry.set(reg.agentId, { ...reg, registeredAt: Date.now() });

  // Create a blank confidence record with optimistic prior if none exists
  if (!getConfidence(reg.agentId)) {
    const initial: AgentConfidenceRecord = {
      agentId:             reg.agentId,
      role:                reg.role,
      runId:               "init",
      taskId:              "init",
      confidenceScore:     RELIABILITY.INITIAL_SCORE,
      reliabilityScore:    RELIABILITY.INITIAL_SCORE,
      hallucinationRisk:   0,
      executionQuality:    RELIABILITY.INITIAL_SCORE,
      verificationPassed:  false,
      retries:             0,
      runtimeFailures:     0,
      policyViolations:    0,
      latencyScore:        1.0,
      finalOutcome:        "SUCCESS",
      state:               scoreToState(RELIABILITY.INITIAL_SCORE),
      ts:                  Date.now(),
    };
    upsertConfidence(initial);
  }
}

export function isRegistered(agentId: string): boolean {
  return _registry.has(agentId);
}

export function getRegistration(agentId: string): AgentRegistration | undefined {
  return _registry.get(agentId);
}

export function getRole(agentId: string): string {
  return _registry.get(agentId)?.role ?? agentId;
}

export function getCategory(agentId: string): string {
  return _registry.get(agentId)?.category ?? "unknown";
}

export function getAllRegistrations(): AgentRegistration[] {
  return Array.from(_registry.values());
}

export function getRegistrationsByCategory(category: string): AgentRegistration[] {
  return Array.from(_registry.values()).filter(r => r.category === category);
}

// ── Auto-register on first use ────────────────────────────────────────────────

/**
 * Ensures an agent is registered before confidence operations.
 * Uses agentId as role/category when no explicit registration exists.
 * Called by confidence-engine.ts before recording any execution.
 */
export function ensureRegistered(agentId: string, role?: string, category?: string): void {
  if (!_registry.has(agentId)) {
    registerAgent({
      agentId,
      role:        role     ?? agentId,
      category:    category ?? "unknown",
      description: "auto-registered",
    });
  }
}

// ── Routing helpers ───────────────────────────────────────────────────────────

/**
 * Returns eligible agents for routing — excludes BLOCKED agents.
 * Sorted by confidence score descending.
 */
export function getEligibleAgents(
  candidates: string[],
  getStateFn: (id: string) => ConfidenceState,
  getScoreFn: (id: string) => number,
): string[] {
  return candidates
    .filter(id => getStateFn(id) !== "BLOCKED")
    .sort((a, b) => getScoreFn(b) - getScoreFn(a));
}

export function registrySize(): number {
  return _registry.size;
}
