/**
 * server/agents/verifier/coordination/tool-coordinator.ts
 *
 * Maps high-level verification tasks to specific tool dispatches.
 * ALL calls go through dispatcher-client — no direct execution here.
 */

import { executeTool, type VerifierDispatchOptions } from './dispatcher-client.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../shared/types/execution-contracts.ts';

// ── Verifier tool name constants ──────────────────────────────────────────────

export const VERIFIER_TOOLS = {
  RUN_BUILD:           'run_build',
  RUN_TYPECHECK:       'run_typecheck',
  RUN_LINT:            'run_lint',
  RUN_TESTS:           'run_tests',
  CHECK_SERVER_HEALTH: 'check_server_health',
  VALIDATE_ENDPOINTS:  'validate_endpoints',
  VALIDATE_RUNTIME:    'validate_runtime',
  VALIDATE_DEPS:       'validate_dependencies',
  VALIDATE_EXECUTION:  'validate_execution',
  VALIDATE_OUTPUT:     'validate_output',
  ANALYZE_ERRORS:      'analyze_errors',
  DETECT_ROOT_CAUSES:  'detect_root_causes',
  DIAGNOSTICS_REPORT:  'build_diagnostics_report',
  FAILURE_RECOVERY:    'verifier_failure_recovery',
  PARSE_STACKTRACE:    'parse_stacktrace',
} as const;

type ToolName = typeof VERIFIER_TOOLS[keyof typeof VERIFIER_TOOLS];

// ── Generic coordinator ───────────────────────────────────────────────────────

export async function runTool<TOutput = unknown>(
  toolName: ToolName,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts?:    VerifierDispatchOptions,
): Promise<ToolExecutionResult<TOutput>> {
  return executeTool<TOutput>(toolName, input, context, opts);
}

// ── Build coordination ────────────────────────────────────────────────────────

export async function coordinateBuild(
  runId: string, projectId: string, context: ToolExecutionContext, opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.RUN_BUILD, { runId, projectId }, context, { timeoutMs: 120_000, label: 'run_build', ...opts });
}

// ── TypeCheck coordination ────────────────────────────────────────────────────

export async function coordinateTypecheck(
  runId: string, projectId: string, context: ToolExecutionContext, opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.RUN_TYPECHECK, { runId, projectId }, context, { timeoutMs: 60_000, label: 'run_typecheck', ...opts });
}

// ── Tests coordination ────────────────────────────────────────────────────────

export async function coordinateTests(
  runId: string, projectId: string, context: ToolExecutionContext, script = 'test', opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.RUN_TESTS, { runId, projectId, script }, context, { timeoutMs: 120_000, label: 'run_tests', ...opts });
}

// ── Runtime coordination ──────────────────────────────────────────────────────

export async function coordinateServerHealth(
  runId: string, port: number | undefined, context: ToolExecutionContext, opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.CHECK_SERVER_HEALTH, { runId, port }, context, { timeoutMs: 15_000, label: 'check_server_health', ...opts });
}

export async function coordinateRuntimeValidation(
  runId: string, port: number | undefined, context: ToolExecutionContext, opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.VALIDATE_RUNTIME, { runId, port }, context, { timeoutMs: 60_000, label: 'validate_runtime', ...opts });
}

// ── Dependency coordination ───────────────────────────────────────────────────

export async function coordinateDependencies(
  runId: string, projectId: string, context: ToolExecutionContext, opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.VALIDATE_DEPS, { runId, projectId }, context, { timeoutMs: 10_000, label: 'validate_dependencies', ...opts });
}

// ── Diagnostics coordination ──────────────────────────────────────────────────

export async function coordinateErrorAnalysis(
  runId: string, output: string, context: ToolExecutionContext, opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.ANALYZE_ERRORS, { runId, output }, context, { timeoutMs: 5_000, label: 'analyze_errors', ...opts });
}

export async function coordinateRecovery(
  runId: string, phase: string, error: string, context: ToolExecutionContext, opts?: VerifierDispatchOptions,
): Promise<ToolExecutionResult> {
  return runTool(VERIFIER_TOOLS.FAILURE_RECOVERY, { runId, phase, error }, context, { timeoutMs: 2_000, label: 'verifier_failure_recovery', ...opts });
}
