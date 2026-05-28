/**
 * server/agents/executor/coordination/tool-coordinator.ts
 *
 * Maps execution tasks to registered tool names and prepares tool inputs.
 * Knows WHICH tool to call and HOW to shape the input.
 * Does NOT execute — all execution goes through dispatcher-client.ts.
 */

import type { ExecutionTask, TaskKind, RoutedStep } from '../types/executor.types.ts';

// ── Terminal task routing ─────────────────────────────────────────────────────

export function coordinateTerminal(task: ExecutionTask, sandboxRoot: string): RoutedStep {
  const input = task.input as Record<string, unknown>;
  const subKind = String(input.subKind ?? 'run_script');

  const toolMap: Record<string, string> = {
    run_script:     'npm_run_script',
    start_process:  'process_start',
    stop_process:   'process_stop',
    watch_process:  'process_watch',
    install:        'npm_install',
    build:          'npm_build',
    test:           'npm_test',
    find_port:      'find_free_port',
    check_port:     'port_in_use',
    cleanup:        'cleanup_run',
  };

  const toolName = toolMap[subKind] ?? 'npm_run_script';

  return {
    toolName,
    toolInput: {
      sandboxRoot,
      runId: input.runId,
      ...input,
    },
  };
}

// ── Filesystem task routing ───────────────────────────────────────────────────

export function coordinateFilesystem(task: ExecutionTask, sandboxRoot: string): RoutedStep {
  const input = task.input as Record<string, unknown>;
  const op    = String(input.operation ?? 'read');

  const toolMap: Record<string, string> = {
    read:   'read_file',
    write:  'write_file',
    patch:  'patch_file',
    delete: 'delete_file',
    search: 'search_text',
    list:   'read_folder',
  };

  const toolName = toolMap[op] ?? 'read_file';

  return {
    toolName,
    toolInput: {
      path: input.path ? `${sandboxRoot}/${String(input.path).replace(/^\/+/, '')}` : sandboxRoot,
      ...input,
    },
  };
}

// ── Coding task routing ───────────────────────────────────────────────────────

export function coordinateCoding(task: ExecutionTask): RoutedStep {
  const input   = task.input as Record<string, unknown>;
  const subKind = String(input.subKind ?? 'generate_component');

  const toolMap: Record<string, string> = {
    generate_component:    'coding_generate_react_component',
    generate_route:        'coding_generate_express_route',
    generate_rest_api:     'coding_generate_rest_api',
    generate_controller:   'coding_generate_controller',
    generate_schema:       'coding_generate_drizzle_schema',
    generate_api_client:   'coding_generate_api_client',
    generate_api_handler:  'coding_generate_api_handler',
    generate_auth:         'coding_generate_jwt_auth',
    generate_middleware:   'coding_generate_auth_middleware',
    generate_error_handler: 'coding_generate_error_handler',
  };

  const toolName = toolMap[subKind] ?? 'coding_generate_express_route';
  return { toolName, toolInput: { ...input } };
}

// ── Verify task routing ───────────────────────────────────────────────────────

export function coordinateVerify(task: ExecutionTask): RoutedStep {
  const input   = task.input as Record<string, unknown>;
  const subKind = String(input.subKind ?? 'runtime');

  const toolMap: Record<string, string> = {
    runtime:        'validate_runtime',
    build:          'run_build',
    tests:          'run_tests',
    health:         'check_server_health',
    analyze_errors: 'analyze_errors',
    root_causes:    'detect_root_causes',
    parse_logs:     'parse_runtime_logs',
    crash:          'detect_runtime_crash',
  };

  const toolName = toolMap[subKind] ?? 'validate_runtime';
  return { toolName, toolInput: { ...input } };
}

// ── Browser task routing ──────────────────────────────────────────────────────

export function coordinateBrowser(task: ExecutionTask): RoutedStep {
  const input   = task.input as Record<string, unknown>;
  const subKind = String(input.subKind ?? 'screenshot');

  const toolMap: Record<string, string> = {
    screenshot:          'browser_screenshot',
    click:               'browser_click',
    fill:                'browser_fill',
    wait_for_element:    'browser_wait_for_element',
    is_element_present:  'browser_is_element_present',
    is_element_visible:  'browser_is_element_visible',
    capture_ui_state:    'browser_capture_ui_state',
    health:              'browser_health',
  };

  const toolName = toolMap[subKind] ?? 'browser_screenshot';
  return { toolName, toolInput: { ...input } };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function coordinateTask(task: ExecutionTask, sandboxRoot: string): RoutedStep {
  switch (task.kind as TaskKind) {
    case 'terminal':   return coordinateTerminal(task, sandboxRoot);
    case 'filesystem': return coordinateFilesystem(task, sandboxRoot);
    case 'coding':     return coordinateCoding(task);
    case 'verify':     return coordinateVerify(task);
    case 'browser':    return coordinateBrowser(task);
    default: {
      const _exhaustive: never = task.kind as never;
      throw new Error(`[tool-coordinator] Unknown task kind: ${_exhaustive}`);
    }
  }
}
