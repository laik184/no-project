# VERIFIER_EXPORT_VALIDATION.md

## Named Export Validation

| Export Name              | Source File                             | File Exists? | Symbol Verified? | Status    |
|--------------------------|-----------------------------------------|-------------|------------------|-----------|
| `initializeVerifier`     | `verifier-agent.ts`                     | ✓           | ✓ line 31        | **VALID** |
| `shutdownVerifier`       | `verifier-agent.ts`                     | ✓           | ✓ line 37        | **VALID** |
| `runVerification`        | `verifier-agent.ts`                     | ✓           | ✓ line 48        | **VALID** |
| `verifierHealthMonitor`  | `monitoring/health-monitor.ts`          | ✓           | ✓ line 23        | **VALID** |
| `validateVerifierInput`  | `validation/verification-validator.ts`  | ✓           | ✓ line 13        | **VALID** |

## Type Export Validation (from `types/verifier.types.ts`)

| Type Name               | Line | Status    |
|-------------------------|------|-----------|
| `VerificationStatus`    | 10   | **VALID** |
| `VerificationPhase`     | 13   | **VALID** |
| `VerificationStep`      | 35   | **VALID** |
| `VerificationStepResult`| 46   | **VALID** |
| `VerifierLifecycleState`| 58   | **VALID** |
| `RecoveryAction`        | 64   | **VALID** |
| `RetryPolicy`           | 66   | **VALID** |
| `VerifierInput`         | 74   | **VALID** |
| `VerifierOutput`        | 83   | **VALID** |

## Types in file NOT exported through index

| Type Name                | Line | Reason hidden |
|--------------------------|------|---------------|
| `VerificationStepType`   | 19   | Internal step enum — no external consumer requests it |
| `VerifierValidationResult`| 94  | Return type of exported validator — no external consumer imports it |

## Missing Exports

**None.** Every symbol required by external consumers is present in the index.
The sole consumer (`agent-coordinator.ts`) only needs `runVerification`,
which is exported at line 13 of the index.

## Summary

| Status    | Count |
|-----------|-------|
| VALID     | 14    |
| BROKEN    | 0     |
| DUPLICATE | 0     |
| MISSING   | 0     |
