/**
 * server/tools/verifier/index.ts
 *
 * Public surface of the verifier tool domain.
 *
 * ONLY exports:
 *   - registerVerifierTools() — boot-time registration
 *   - ToolDefinition objects  — for registry introspection
 *   - Shared types / errors   — for typed consumers
 *   - Result helpers          — for tool authors
 *
 * RAW execution functions (runBuild, runTests, etc.) are intentionally
 * NOT exported here. All execution MUST go through the dispatcher:
 *   dispatch('verifier_run_build', input, ctx)
 *
 * This prevents dispatcher bypasses that skip metrics, audit,
 * timeout enforcement, and permission validation.
 */

export { registerVerifierTools } from './registry/register-verifier-tools.ts';

// ── ToolDefinition exports (registry introspection only) ──────────────────────

export { runBuildTool }              from './build/run-build.ts';
export { parseBuildOutputTool }      from './build/build-output-parser.ts';
export { buildErrorClassifierTool }  from './build/build-error-classifier.ts';

export { runTestsTool }              from './tests/run-tests.ts';
export { testResultParserTool }      from './tests/test-result-parser.ts';
export { testFailureClassifierTool } from './tests/test-failure-classifier.ts';
export { coverageValidatorTool }     from './tests/coverage-validator.ts';

export { runTypecheckTool }          from './typecheck/run-typecheck.ts';
export { typescriptParserTool }      from './typecheck/typescript-parser.ts';
export { typeErrorClassifierTool }   from './typecheck/type-error-classifier.ts';
export { typecheckValidatorTool }    from './typecheck/typecheck-validator.ts';

export { checkServerHealthTool }     from './runtime/check-server-health.ts';
export { endpointValidatorTool }     from './runtime/endpoint-validator.ts';
export { runtimeLogParserTool }      from './runtime/runtime-log-parser.ts';
export { crashDetectorTool }         from './runtime/runtime-crash-detector.ts';
export { runtimeValidatorTool }      from './runtime/runtime-validator.ts';

export { failureRecoveryTool }       from './recovery/failure-recovery.ts';
export { rollbackValidatorTool }     from './recovery/rollback-validator.ts';
export { checkpointValidatorTool }   from './recovery/checkpoint-validator.ts';

export { schemaValidatorTool }       from './validation/schema-validator.ts';
export { outputValidatorTool }       from './validation/output-validator.ts';
export { executionValidatorTool }    from './validation/execution-validator.ts';
export { dependencyValidatorTool }   from './validation/dependency-validator.ts';
export { verificationValidatorTool } from './validation/verification-validator.ts';

export { errorAnalyzerTool }         from './diagnostics/error-analyzer.ts';
export { stacktraceParserTool }      from './diagnostics/stacktrace-parser.ts';
export { rootcauseDetectorTool }     from './diagnostics/rootcause-detector.ts';
export { diagnosticsReportTool }     from './diagnostics/diagnostics-report.ts';

export { verifierMetrics }           from './monitoring/verification-metrics.ts';
export { verificationMonitor }       from './monitoring/verification-monitor.ts';
export { healthMonitor }             from './monitoring/health-monitor.ts';
export { verifierRuntimeMonitor }    from './monitoring/runtime-monitor.ts';

// ── Shared types ──────────────────────────────────────────────────────────────

export type {
  VerificationStatus, VerificationPhase, VerificationInput, VerificationResult,
  PhaseResult, EndpointSpec, VerificationSession,
  RuntimeCheckResult, EndpointCheckResult, CrashReport, ServerHealth, ServerState,
  ParsedError, DiagnosticsReport, RootCause, FailureCategory, ErrorSeverity,
  ValidationReport, OutputValidationResult, DependencyCheckResult,
} from './shared/verifier-types.ts';

export {
  VerifierError,
  BuildFailedError,
  TypecheckFailedError,
  TestFailedError,
  RuntimeUnhealthyError,
  VerifierTimeoutError,
} from './shared/verifier-errors.ts';

export { toToolOk, toToolFail, phasePass, phaseFail } from './shared/verifier-result.ts';
