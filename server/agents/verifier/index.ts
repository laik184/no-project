/**
 * server/agents/verifier/index.ts
 *
 * Public surface of the verifier agent orchestration module.
 * Exports only what consumers outside this module need.
 * All execution flows through the dispatcher — never imported directly.
 */

// ── Agent entry point ─────────────────────────────────────────────────────────
export {
  initializeVerifier,
  shutdownVerifier,
  runVerification,
} from './verifier-agent.ts';

// ── Health monitoring ─────────────────────────────────────────────────────────
export { verifierHealthMonitor } from './monitoring/health-monitor.ts';

// ── Validation helpers ────────────────────────────────────────────────────────
export { validateVerifierInput } from './validation/verification-validator.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  VerifierInput,
  VerifierOutput,
  VerificationStep,
  VerificationStepResult,
  VerificationPhase,
  VerificationStatus,
  VerifierLifecycleState,
  RetryPolicy,
  RecoveryAction,
} from './types/verifier.types.ts';
