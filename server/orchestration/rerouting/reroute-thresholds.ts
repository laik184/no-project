/**
 * reroute-thresholds.ts
 *
 * All numeric thresholds that trigger re-routing signals.
 * Single source of truth — change here, affects all signal detection.
 * No imports — pure constants.
 */

// ── Signal trigger thresholds ─────────────────────────────────────────────────

export const THRESHOLDS = {

  // File touch: > N files written/modified triggers MASS_FILE_TOUCH
  MASS_FILE_TOUCH:          8,

  // Retry count: > N retries triggers RETRY_STORM
  RETRY_STORM:              3,

  // Verification failures: > N failures triggers VERIFICATION_CASCADE
  VERIFICATION_CASCADE:     2,

  // Runtime restarts: > N restarts triggers RUNTIME_INSTABILITY
  RUNTIME_INSTABILITY:      1,

  // Dependency count: > N discovered deps triggers DEPENDENCY_EXPLOSION
  DEPENDENCY_EXPLOSION:     15,

  // Hallucination risk: > threshold triggers REFLECTION_ESCALATION
  HALLUCINATION_RISK:       0.65,

  // Reflection severity: > threshold triggers REFLECTION_ESCALATION
  REFLECTION_SEVERITY:      0.70,

  // Elapsed time: > N ms triggers DURATION_EXCEEDED (10 minutes)
  DURATION_EXCEEDED_MS:     10 * 60 * 1_000,

  // Heap used: > N MB triggers MEMORY_PRESSURE
  MEMORY_PRESSURE_MB:       400,

  // Tool failures: > N failures triggers HIGH_COMPLEXITY
  TOOL_FAILURE_HIGH:        3,

  // Avg step time: > N ms per step triggers PARALLEL_OPPORTUNITY (steps are slow)
  PARALLEL_STEP_MS:         8_000,

} as const;

// ── Escalation decision thresholds ────────────────────────────────────────────

export const ESCALATION = {

  // Minimum combined signal strength to trigger escalation (sum of active signals)
  MIN_STRENGTH_TO_ESCALATE: 0.40,

  // Minimum confidence required for an escalation decision to proceed
  MIN_CONFIDENCE:           0.55,

  // Maximum number of escalations allowed per run (anti-loop)
  MAX_ESCALATIONS_PER_RUN:  2,

  // Cool-down between escalations (ms) — prevents rapid re-escalation
  COOLDOWN_MS:              30_000,

  // Maximum run age before escalation is blocked (ms) — too late to reroute safely
  MAX_AGE_FOR_ESCALATION_MS: 20 * 60 * 1_000,

} as const;

// ── Mode upgrade ladder ───────────────────────────────────────────────────────

export type UpgradeLadder = Readonly<{
  from: string;
  to:   string;
  minStrength: number;
}[]>;

export const MODE_UPGRADE_LADDER: UpgradeLadder = [
  { from: "tool-loop", to: "planned", minStrength: 0.40 },
  { from: "planned",   to: "dag",     minStrength: 0.55 },
  { from: "dag",       to: "quantum", minStrength: 0.75 },
] as const;

// ── Guard timeout ─────────────────────────────────────────────────────────────

export const GUARD = {
  // Transition window: reroute must complete within this window
  TRANSITION_TIMEOUT_MS: 5_000,

  // Maximum transition attempts before hard-blocking
  MAX_TRANSITION_ATTEMPTS: 3,
} as const;
