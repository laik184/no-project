export { registerVerifierTools } from './registry/register-verifier-tools.ts';

export { runBuild, runBuildTool }                        from './build/run-build.ts';
export { parseBuildOutputTool, analyzeBuildOutput, summarizeBuildOutput } from './build/build-output-parser.ts';
export { buildErrorClassifierTool, classifyBuildErrors } from './build/build-error-classifier.ts';
export { validateBuildResult, isBuildClean }             from './build/build-validator.ts';

export { runTests, runTestsTool }                        from './tests/run-tests.ts';
export { testResultParserTool, parseTestOutput, testSummary } from './tests/test-result-parser.ts';
export { testFailureClassifierTool, classifyTestFailures }    from './tests/test-failure-classifier.ts';
export { coverageValidatorTool, parseCoverage }          from './tests/coverage-validator.ts';

export { runTypecheck, runTypecheckTool }                from './typecheck/run-typecheck.ts';
export { typescriptParserTool, parseTscErrors }          from './typecheck/typescript-parser.ts';
export { typeErrorClassifierTool, classifyTypeErrors }   from './typecheck/type-error-classifier.ts';
export { typecheckValidatorTool, validateTypecheckResult } from './typecheck/typecheck-validator.ts';

export { checkServerHealth, checkServerHealthTool, waitForServer } from './runtime/check-server-health.ts';
export { endpointValidatorTool, validateEndpoints }      from './runtime/endpoint-validator.ts';
export { runtimeLogParserTool, parseRuntimeLogs }        from './runtime/runtime-log-parser.ts';
export { crashDetectorTool, detectCrash }                from './runtime/runtime-crash-detector.ts';
export { runtimeValidatorTool }                          from './runtime/runtime-validator.ts';

export { verifierFailureRecovery, failureRecoveryTool }  from './recovery/failure-recovery.ts';
export { shouldRetryPhase, recoveryToRetry }             from './recovery/retry-decision.ts';
export { rollbackValidatorTool, validateRollback }       from './recovery/rollback-validator.ts';
export { checkpointValidatorTool }                       from './recovery/checkpoint-validator.ts';

export { schemaValidatorTool, validateSchema, validateVerificationInput } from './validation/schema-validator.ts';
export { outputValidatorTool, validateOutput, validateBuildOutput, validateCommandOutput } from './validation/output-validator.ts';
export { executionValidatorTool, validateExecution, validateExitCode }    from './validation/execution-validator.ts';
export { dependencyValidatorTool, checkAllDependencies }                  from './validation/dependency-validator.ts';
export { verificationValidatorTool, validateVerificationRequest }         from './validation/verification-validator.ts';

export { errorAnalyzerTool, analyzeOutput, buildDiagnosticsReport }       from './diagnostics/error-analyzer.ts';
export { stacktraceParserTool, parseStackTrace, extractFirstUserFrame }    from './diagnostics/stacktrace-parser.ts';
export { rootcauseDetectorTool, detectRootCauses, primaryRootCause }      from './diagnostics/rootcause-detector.ts';
export { diagnosticsReportTool, buildFullDiagnosticsReport }              from './diagnostics/diagnostics-report.ts';

export { verifierMetrics }         from './monitoring/verification-metrics.ts';
export { verificationMonitor }     from './monitoring/verification-monitor.ts';
export { healthMonitor }           from './monitoring/health-monitor.ts';
export { verifierRuntimeMonitor }  from './monitoring/runtime-monitor.ts';

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
