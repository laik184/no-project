export {
  initializeVerifier,
  runVerification,
  shutdownVerifier,
} from './core/verifier-agent.ts';

export type {
  VerificationInput,
  VerificationResult,
  VerificationPhase,
  VerificationStatus,
  PhaseResult,
  EndpointSpec,
  VerificationSession,
} from './types/verifier.types.ts';

export type {
  RuntimeCheckResult,
  EndpointCheckResult,
  CrashReport,
  ServerHealth,
} from './types/runtime.types.ts';

export type {
  DiagnosticsReport,
  ParsedError,
  RootCause,
  FailureCategory,
  ErrorSeverity,
} from './types/diagnostics.types.ts';

export type {
  ValidationReport,
  OutputValidationResult,
  DependencyCheckResult,
} from './types/validation.types.ts';

export { verifierLogger }   from './telemetry/verifier-logger.ts';
export { verifierMetrics }  from './telemetry/verifier-metrics.ts';
export { healthMonitor }    from './monitoring/health-monitor.ts';
export { verificationMonitor } from './monitoring/verification-monitor.ts';

export { checkServerHealth, waitForServer } from './runtime/server-healthcheck.ts';
export { checkEndpoint, checkAllEndpoints } from './runtime/endpoint-checker.ts';
export { runTypecheck }  from './typecheck/typescript-checker.ts';
export { runBuild }      from './build/build-runner.ts';
export { runTests }      from './testing/test-runner.ts';

export { buildVerificationReport, formatVerificationResult, summarizeResult }
  from './reports/verification-report.ts';
export { buildDebugReport, formatDebugReport } from './diagnostics/debug-report-builder.ts';
export { detectRootCauses }   from './diagnostics/rootcause-detector.ts';
export { parseStackTrace }    from './diagnostics/stacktrace-parser.ts';
export { validateCoverage }   from './testing/coverage-validator.ts';
export { validateDependencies } from './validation/dependency-validator.ts';
