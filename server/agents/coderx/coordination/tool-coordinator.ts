/**
 * server/agents/coderx/coordination/tool-coordinator.ts
 *
 * Maps coding tasks to registered tool names and prepares tool inputs.
 * Knows WHICH tool to call and HOW to shape the input.
 * Does NOT execute — all execution goes through dispatcher-client.ts.
 */

import type { CodingTask, CodingTaskKind, RoutedCodingStep } from '../types/coderx.types.ts';

// ── Code generation routing ───────────────────────────────────────────────────
//
// ALL names here MUST match registered names in register-coding-tools.ts exactly.
// Wrong names cause silent NOT_FOUND failures on every coding task.

const CODING_TOOL_MAP: Record<CodingTaskKind, string> = {
  generate_component:    'coding_generate_tailwind_ui',      // FIX: was 'coding_generate_react_component' (unregistered)
  generate_route:        'coding_generate_express_route',
  generate_schema:       'coding_generate_schema',           // FIX: was 'coding_generate_drizzle_schema' (unregistered)
  generate_api_client:   'coding_generate_api_client',
  generate_auth:         'coding_generate_jwt_auth',
  generate_middleware:   'coding_generate_auth_middleware',
  generate_error_handler:'coding_generate_error_handler',
  generate_controller:   'coding_generate_controller',
  generate_rest_api:     'coding_generate_rest_api',
  refactor:              'coding_generate_generic_file',     // FIX: 'coding_refactor_code' was never registered
  analyze:               'coding_generate_generic_file',     // FIX: 'coding_analyze_code' was never registered
  validate:              'run_build',                        // FIX: 'coding_validate_code' was never registered → verifier
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
//
// ALWAYS pass RELATIVE paths — fs_* tools call resolveSafe() internally which
// prepends AGENT_PROJECT_ROOT/sandboxRoot. Passing an absolute path or manually
// pre-joining sandboxRoot causes double-prefixing and NOT_FOUND failures.

export function coordinateFilesystemTask(
  operation: string,
  input:     Record<string, unknown>,
  _sandboxRoot: string, // kept for API compat — never use to prefix paths
): RoutedCodingStep {
  // FIX: was using un-prefixed names (read_file, write_file, etc.) — all NOT_FOUND.
  // Correct names must match register-filesystem-tools.ts exactly.
  const fsToolMap: Record<string, string> = {
    read:   'fs_read_file',
    write:  'fs_write_file',
    patch:  'fs_patch_file',
    delete: 'fs_delete_file',
    search: 'fs_search_text',
    list:   'fs_read_folder',
  };

  const toolName = fsToolMap[operation] ?? 'fs_read_file';

  // Strip any leading slash so the path is always relative.
  // FIX: was doing `${sandboxRoot}/${rawPath}` which caused double-prefixing.
  const rawPath = typeof input.path === 'string' ? input.path : '';
  const relPath = rawPath.replace(/^\/+/, '');

  return {
    toolName,
    toolInput: { ...input, path: relPath },
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
