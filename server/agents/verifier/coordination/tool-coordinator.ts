/**
 * coordination/tool-coordinator.ts
 *
 * Maps high-level verification tasks to specific tool dispatches.
 * Knows which tools to call for each verification concern.
 * ALL calls go through dispatcher-client — no direct execution here.
 */

import { dispatchTool, type VerifierDispatchOptions } from './dispatcher-client.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../tools/registry/tool-types.ts';

// ── Tool name constants ────────────────────────────────────────────────────────

export const VERIFIER_TOOLS = {
  BUILD:              'run_build',
  PARSE_BUILD:        'parse_build_output',
  BUILD_ERRORS:       'build_error_classifier',
  RUN_TESTS:          'run_tests',
  PARSE_TESTS:        'test_result_parser',
  CLASSIFY_FAILURES:  'test_failure_classifier',
  COVERAGE:           'coverage_validator',
  RUN_TYPECHECK:      'run_typecheck',
  PARSE_TYPECHECK:    'typescript_parser',
  CLASSIFY_TS_ERRORS: 'type_error_classifier',
  VALIDATE_TYPECHECK: 'typecheck_validator',
  SERVER_HEALTH:      'check_server_health',
  ENDPOINT_VALIDATE:  'endpoint_validator',
  PARSE_RUNTIME_LOGS: 'runtime_log_parser',
  CRASH_DETECT:       'crash_detector',
  RUNTIME_VALIDATE:   'runtime_validator',
  FAILURE_RECOVERY:   'failure_recovery',
  ROLLBACK_VALIDATE:  'rollback_validator',
  CHECKPOINT_VALIDATE:'checkpoint_validator',
  SCHEMA_VALIDATE:    'schema_validator',
  OUTPUT_VALIDATE:    'output_validator',
  EXEC_VALIDATE:      'execution_validator',
  DEP_VALIDATE:       'dependency_validator',
  VERIFY_VALIDATE:    'verification_validator',
  ERROR_ANALYZE:      'error_analyzer',
  PARSE_STACKTRACE:   'stacktrace_parser',
  DETECT_ROOTCAUSE:   'rootcause_detector',
  BUILD_DIAGNOSTICS:  'diagnostics_report',
} as const;

type ToolName = typeof VERIFIER_TOOLS[keyof typeof VERIFIER_TOOLS];

// ── Generic coordinator call ───────────────────────────────────────────────────

export async function runTool<TOutput = unknown>(
  toolName: ToolName,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts?:    VerifierDispatchOptions,
): Promise<ToolExecutionResult<TOutput>> {
  return dispatchTool<TOutput>(toolName, input, context, opts);
}

// ── Build coordination ─────────────────────────────────────────────────────────

export async function runBuild(
  context: ToolExecutionContext,
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.BUILD, { projectId: context.projectId, sandboxRoot: context.sandboxRoot }, context, { phase: 'build', ...opts });
}

export async function validateDependencies(
  context: ToolExecutionContext,
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.DEP_VALIDATE, { sandboxRoot: context.sandboxRoot }, context, { phase: 'dependencies', ...opts });
}

// ── Typecheck coordination ─────────────────────────────────────────────────────

export async function runTypecheck(
  context: ToolExecutionContext,
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.RUN_TYPECHECK, { projectId: context.projectId, sandboxRoot: context.sandboxRoot }, context, { phase: 'typecheck', ...opts });
}

// ── Runtime coordination ───────────────────────────────────────────────────────

export async function checkServerHealth(
  context: ToolExecutionContext,
  port:    number,
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.SERVER_HEALTH, { port, projectId: context.projectId }, context, { phase: 'runtime', ...opts });
}

export async function validateEndpoint(
  context:        ToolExecutionContext,
  path:           string,
  method:         string,
  expectedStatus: number,
  port:           number,
  opts?:          VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.ENDPOINT_VALIDATE, { path, method, expectedStatus, port }, context, { phase: 'endpoints', ...opts });
}

// ── Tests coordination ─────────────────────────────────────────────────────────

export async function runTests(
  context: ToolExecutionContext,
  script?: string,
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.RUN_TESTS, { projectId: context.projectId, sandboxRoot: context.sandboxRoot, script: script ?? 'test' }, context, { phase: 'tests', ...opts });
}

// ── Diagnostics coordination ───────────────────────────────────────────────────

export async function analyzeErrors(
  context: ToolExecutionContext,
  output:  string,
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.ERROR_ANALYZE, { output, runId: context.runId }, context, opts);
}

export async function detectRootCause(
  context: ToolExecutionContext,
  errors:  string[],
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.DETECT_ROOTCAUSE, { errors, runId: context.runId }, context, opts);
}

export async function buildDiagnosticsReport(
  context: ToolExecutionContext,
  errors:  string[],
  rawLogs: string,
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.BUILD_DIAGNOSTICS, { errors, rawLogs, runId: context.runId }, context, opts);
}

// ── Recovery coordination ──────────────────────────────────────────────────────

export async function runFailureRecovery(
  context: ToolExecutionContext,
  errors:  string[],
  opts?:   VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.FAILURE_RECOVERY, { errors, projectId: context.projectId }, context, opts);
}
