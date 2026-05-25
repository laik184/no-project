/**
 * routing-policy.ts
 *
 * Domain-specific routing policies for the DynamicSwarmRouter.
 * Single responsibility: policy definitions only — no execution logic.
 *
 * Policies control:
 *   - Per-domain worker type (io-bound / cpu-bound / llm)
 *   - Timeout multipliers relative to base timeout
 *   - Max parallel executions per domain
 *   - Circuit-breaker failure thresholds
 *   - Retry limits per domain
 *   - Failover domain when primary fails
 *
 * Design intent:
 *   database / security domains get shorter timeouts (deterministic ops).
 *   frontend / fullstack get more parallelism (less cross-contamination risk).
 *   verification runs sequential-only (state-reconciliation requirement).
 */

import type { SpecialistDomain } from "../contracts/specialist.contracts.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkerType = "io-bound" | "cpu-bound" | "llm";

export interface DomainRoutingPolicy {
  domain:              SpecialistDomain;
  workerType:          WorkerType;
  baseTimeoutMs:       number;
  timeoutMultiplier:   number;
  maxParallel:         number;
  maxRetries:          number;
  circuitBreakerLimit: number;  // consecutive failures before open circuit
  failoverDomain?:     SpecialistDomain;
  requiresExclusiveLock: boolean;
}

// ── Policy table ──────────────────────────────────────────────────────────────

const POLICIES: Record<SpecialistDomain, DomainRoutingPolicy> = {
  database: {
    domain:                "database",
    workerType:            "io-bound",
    baseTimeoutMs:         30_000,
    timeoutMultiplier:     1.0,
    maxParallel:           2,
    maxRetries:            1,
    circuitBreakerLimit:   2,
    failoverDomain:        "backend",
    requiresExclusiveLock: true,
  },
  backend: {
    domain:                "backend",
    workerType:            "llm",
    baseTimeoutMs:         60_000,
    timeoutMultiplier:     1.2,
    maxParallel:           3,
    maxRetries:            2,
    circuitBreakerLimit:   3,
    failoverDomain:        "fullstack",
    requiresExclusiveLock: false,
  },
  security: {
    domain:                "security",
    workerType:            "cpu-bound",
    baseTimeoutMs:         45_000,
    timeoutMultiplier:     1.0,
    maxParallel:           2,
    maxRetries:            1,
    circuitBreakerLimit:   2,
    requiresExclusiveLock: true,
  },
  runtime: {
    domain:                "runtime",
    workerType:            "io-bound",
    baseTimeoutMs:         60_000,
    timeoutMultiplier:     1.5,
    maxParallel:           2,
    maxRetries:            2,
    circuitBreakerLimit:   3,
    failoverDomain:        "fullstack",
    requiresExclusiveLock: true,
  },
  frontend: {
    domain:                "frontend",
    workerType:            "llm",
    baseTimeoutMs:         60_000,
    timeoutMultiplier:     1.3,
    maxParallel:           4,
    maxRetries:            2,
    circuitBreakerLimit:   4,
    failoverDomain:        "fullstack",
    requiresExclusiveLock: false,
  },
  verification: {
    domain:                "verification",
    workerType:            "cpu-bound",
    baseTimeoutMs:         120_000,
    timeoutMultiplier:     1.0,
    maxParallel:           1,  // always sequential — state-reconciliation requirement
    maxRetries:            0,
    circuitBreakerLimit:   1,
    requiresExclusiveLock: false,
  },
  fullstack: {
    domain:                "fullstack",
    workerType:            "llm",
    baseTimeoutMs:         90_000,
    timeoutMultiplier:     1.5,
    maxParallel:           3,
    maxRetries:            2,
    circuitBreakerLimit:   4,
    requiresExclusiveLock: false,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getPolicy(domain: SpecialistDomain): DomainRoutingPolicy {
  return POLICIES[domain] ?? POLICIES.fullstack;
}

export function effectiveTimeout(domain: SpecialistDomain): number {
  const p = getPolicy(domain);
  return Math.round(p.baseTimeoutMs * p.timeoutMultiplier);
}

export function allPolicies(): DomainRoutingPolicy[] {
  return Object.values(POLICIES);
}

/** Failover chain: primary → failover → fullstack */
export function failoverChain(domain: SpecialistDomain): SpecialistDomain[] {
  const p = getPolicy(domain);
  const chain: SpecialistDomain[] = [domain];
  if (p.failoverDomain && p.failoverDomain !== domain) chain.push(p.failoverDomain);
  if (!chain.includes("fullstack")) chain.push("fullstack");
  return chain;
}
