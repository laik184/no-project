/**
 * server/agents/executor/planning/tool-selection.ts
 *
 * Selects the appropriate tool name for a given task kind and sub-kind.
 * Pure lookup logic — no execution, no dispatch.
 */

import type { TaskKind } from '../types/executor.types.ts';

// ── Tool selection tables ─────────────────────────────────────────────────────

const TERMINAL_TOOLS: Record<string, string> = {
  run_script:    'npm_run_script',
  start_process: 'process_start',
  stop_process:  'process_stop',
  watch_process: 'process_watch',
  install:       'npm_install',
  build:         'npm_build',
  test:          'npm_test',
  find_port:     'find_free_port',
  check_port:    'port_in_use',
  cleanup:       'cleanup_run',
};

const FILESYSTEM_TOOLS: Record<string, string> = {
  read:   'read_file',
  write:  'write_file',
  patch:  'patch_file',
  delete: 'delete_file',
  search: 'search_text',
  list:   'read_folder',
};

const CODING_TOOLS: Record<string, string> = {
  generate_component:     'coding_generate_react_component',
  generate_route:         'coding_generate_express_route',
  generate_rest_api:      'coding_generate_rest_api',
  generate_controller:    'coding_generate_controller',
  generate_schema:        'coding_generate_drizzle_schema',
  generate_api_client:    'coding_generate_api_client',
  generate_auth:          'coding_generate_jwt_auth',
  generate_middleware:    'coding_generate_auth_middleware',
  generate_error_handler: 'coding_generate_error_handler',
};

const VERIFY_TOOLS: Record<string, string> = {
  runtime:        'validate_runtime',
  build:          'run_build',
  tests:          'run_tests',
  health:         'check_server_health',
  analyze_errors: 'analyze_errors',
  root_causes:    'detect_root_causes',
  parse_logs:     'parse_runtime_logs',
  crash:          'detect_runtime_crash',
};

const BROWSER_TOOLS: Record<string, string> = {
  screenshot:         'browser_screenshot',
  click:              'browser_click',
  fill:               'browser_fill',
  wait_for_element:   'browser_wait_for_element',
  is_element_present: 'browser_is_element_present',
  capture_ui_state:   'browser_capture_ui_state',
  health:             'browser_health',
};

const KIND_MAP: Record<TaskKind, Record<string, string>> = {
  terminal:   TERMINAL_TOOLS,
  filesystem: FILESYSTEM_TOOLS,
  coding:     CODING_TOOLS,
  verify:     VERIFY_TOOLS,
  browser:    BROWSER_TOOLS,
};

// ── Public API ────────────────────────────────────────────────────────────────

export function selectTool(kind: TaskKind, subKind: string): string | undefined {
  return KIND_MAP[kind]?.[subKind];
}

export function listToolsForKind(kind: TaskKind): string[] {
  return Object.values(KIND_MAP[kind] ?? {});
}

export function defaultToolForKind(kind: TaskKind): string {
  const defaults: Record<TaskKind, string> = {
    terminal:   'npm_run_script',
    filesystem: 'read_file',
    coding:     'coding_generate_express_route',
    verify:     'validate_runtime',
    browser:    'browser_screenshot',
  };
  return defaults[kind];
}
