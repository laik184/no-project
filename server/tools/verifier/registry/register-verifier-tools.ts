/**
 * Fix #10 — Atomic registration with fail-fast idempotency guard.
 *
 * Previous bug: _registered was set BEFORE the loop.
 * Fix: _registered is only set AFTER full successful registration.
 */
import { registerTool }              from '../../registry/tool-registry.ts';
import { runBuildTool }              from '../build/run-build.ts';
import { parseBuildOutputTool }      from '../build/build-output-parser.ts';
import { buildErrorClassifierTool }  from '../build/build-error-classifier.ts';
import { runTestsTool }              from '../tests/run-tests.ts';
import { testResultParserTool }      from '../tests/test-result-parser.ts';
import { testFailureClassifierTool } from '../tests/test-failure-classifier.ts';
import { coverageValidatorTool }     from '../tests/coverage-validator.ts';
import { runTypecheckTool }          from '../typecheck/run-typecheck.ts';
import { typescriptParserTool }      from '../typecheck/typescript-parser.ts';
import { typeErrorClassifierTool }   from '../typecheck/type-error-classifier.ts';
import { typecheckValidatorTool }    from '../typecheck/typecheck-validator.ts';
import { checkServerHealthTool }     from '../runtime/check-server-health.ts';
import { endpointValidatorTool }     from '../runtime/endpoint-validator.ts';
import { runtimeLogParserTool }      from '../runtime/runtime-log-parser.ts';
import { crashDetectorTool }         from '../runtime/runtime-crash-detector.ts';
import { runtimeValidatorTool }      from '../runtime/runtime-validator.ts';
import { failureRecoveryTool }       from '../recovery/failure-recovery.ts';
import { rollbackValidatorTool }     from '../recovery/rollback-validator.ts';
import { checkpointValidatorTool }   from '../recovery/checkpoint-validator.ts';
import { schemaValidatorTool }       from '../validation/schema-validator.ts';
import { outputValidatorTool }       from '../validation/output-validator.ts';
import { executionValidatorTool }    from '../validation/execution-validator.ts';
import { dependencyValidatorTool }   from '../validation/dependency-validator.ts';
import { verificationValidatorTool } from '../validation/verification-validator.ts';
import { errorAnalyzerTool }         from '../diagnostics/error-analyzer.ts';
import { stacktraceParserTool }      from '../diagnostics/stacktrace-parser.ts';
import { rootcauseDetectorTool }     from '../diagnostics/rootcause-detector.ts';
import { diagnosticsReportTool }     from '../diagnostics/diagnostics-report.ts';

let _registered = false;

export function registerVerifierTools(opts: { force?: boolean } = {}): void {
  if (_registered && !opts.force) return;

  const tools = [
    runBuildTool, parseBuildOutputTool, buildErrorClassifierTool,
    runTestsTool, testResultParserTool, testFailureClassifierTool, coverageValidatorTool,
    runTypecheckTool, typescriptParserTool, typeErrorClassifierTool, typecheckValidatorTool,
    checkServerHealthTool, endpointValidatorTool, runtimeLogParserTool,
    crashDetectorTool, runtimeValidatorTool,
    failureRecoveryTool, rollbackValidatorTool, checkpointValidatorTool,
    schemaValidatorTool, outputValidatorTool, executionValidatorTool,
    dependencyValidatorTool, verificationValidatorTool,
    errorAnalyzerTool, stacktraceParserTool, rootcauseDetectorTool, diagnosticsReportTool,
  ];

  // Fail-fast: error aborts registration. _registered only set on success (Fix #10).
  for (const tool of tools) {
    registerTool(tool, opts);
  }

  _registered = true;
  console.log(`[register-verifier-tools] Registered ${tools.length} verifier tools`);
}
