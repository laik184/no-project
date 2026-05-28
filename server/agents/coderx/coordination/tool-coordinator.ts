/**
 * server/agents/coderx/coordination/tool-coordinator.ts
 *
 * Maps coding tasks to registered tool names and prepares tool inputs.
 * Knows WHICH tool to call and HOW to shape the input.
 * Does NOT execute — all execution goes through dispatcher-client.ts.
 */

import type { CodingTask, CodingTaskKind, RoutedCodingStep } from '../types/coderx.types.ts';

// ── Code generation routing ───────────────────────────────────────────────────

const CODING_TOOL_MAP: Record<CodingTaskKind, string> = {
  generate_component:    'coding_generate_react_component',
  generate_route:        'coding_generate_express_route',
  generate_schema:       'coding_generate_drizzle_schema',
  generate_api_client:   'coding_generate_api_client',
  generate_auth:         'coding_generate_jwt_auth',
  generate_middleware:   'coding_generate_auth_middleware',
  generate_error_handler:'coding_generate_error_handler',
  generate_controller:   'coding_generate_controller',
  generate_rest_api:     'coding_generate_rest_api',
  refactor:              'coding_refactor_code',
  analyze:               'coding_analyze_code',
  validate:              'coding_validate_code',
};

export function coordinateCodingTask(task: CodingTask): RoutedCodingStep {
  const toolName = CODING_TOOL_MAP[task.kind];
  if (!toolName) {
    throw new Error(`[tool-coordinator] No tool mapping for kind: ${task.kind}`);
  }
  return {
    toolName,
    toolInput: {
      taskId:      task.taskId,
      description: task.description,
      ...task.input,
    },
  };
}

// ── Filesystem support routing (for coderx read/write needs) ─────────────────

export function coordinateFilesystemTask(
  operation: string,
  input:     Record<string, unknown>,
  sandboxRoot: string,
): RoutedCodingStep {
  const fsToolMap: Record<string, string> = {
    read:   'read_file',
    write:  'write_file',
    patch:  'patch_file',
    delete: 'delete_file',
    search: 'search_text',
    list:   'read_folder',
  };

  const toolName = fsToolMap[operation] ?? 'read_file';
  const rawPath  = typeof input.path === 'string' ? input.path : '';
  const resolved = rawPath
    ? `${sandboxRoot}/${rawPath.replace(/^\/+/, '')}`
    : sandboxRoot;

  return {
    toolName,
    toolInput: { ...input, path: resolved },
  };
}

// ── Verification routing ──────────────────────────────────────────────────────

export function coordinateVerifyTask(subKind: string): RoutedCodingStep {
  const verifyToolMap: Record<string, string> = {
    runtime:        'validate_runtime',
    build:          'run_build',
    tests:          'run_tests',
    health:         'check_server_health',
    analyze_errors: 'analyze_errors',
  };

  return {
    toolName:  verifyToolMap[subKind] ?? 'validate_runtime',
    toolInput: {},
  };
}
