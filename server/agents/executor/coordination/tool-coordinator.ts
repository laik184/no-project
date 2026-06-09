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

  // Tool names MUST match registered names in terminal-tool-registry.ts exactly.
  const toolMap: Record<string, string> = {
    run_script:     'terminal_npm_run_script',
    start_process:  'terminal_start_runtime',
    stop_process:   'terminal_stop_runtime',
    watch_process:  'terminal_runtime_status',
    install:        'terminal_install_package',
    build:          'terminal_npm_build',
    test:           'terminal_npm_test',
    ci:             'terminal_npm_ci',
    execute:        'terminal_execute_command',
    find_port:      'terminal_find_free_port',
    check_port:     'terminal_port_in_use',
    cleanup:        'terminal_cleanup_run',
  };

  const toolName = toolMap[subKind] ?? 'terminal_npm_run_script';

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

  // Tool names MUST match the registered fs_* names exactly.
  // Any mismatch causes silent NOT_FOUND failures.
  const toolMap: Record<string, string> = {
    read:    'fs_read_file',
    write:   'fs_write_file',
    create:  'fs_write_file',    // alias: create == write
    patch:   'fs_patch_file',
    delete:  'fs_delete_file',
    remove:  'fs_delete_file',   // alias
    search:  'fs_search_text',
    list:    'fs_read_folder',
    ls:      'fs_read_folder',   // alias
    append:  'fs_append_file',
    ensure:  'fs_ensure_file',
    mkdir:   'fs_create_folder',
    folder:  'fs_create_folder', // alias
  };

  const toolName = toolMap[op] ?? 'fs_read_file';

  // fs_* tools call resolveSafe() internally which prepends AGENT_PROJECT_ROOT.
  // Passing an absolute path causes double-prefixing (tool strips "/" then re-joins sandboxRoot).
  // Always pass a relative path — strip any leading slash from caller-supplied path.
  const relPath = input.path ? String(input.path).replace(/^\/+/, '') : '';

  return {
    toolName,
    toolInput: { ...input, path: relPath },
  };
}

// ── Coding task routing ───────────────────────────────────────────────────────

export function coordinateCoding(task: ExecutionTask): RoutedStep {
  const input   = task.input as Record<string, unknown>;
  const subKind = String(input.subKind ?? 'generate_page');

  const toolMap: Record<string, string> = {
    // Frontend
    generate_page:            'coding_generate_react_page',
    generate_component:       'coding_generate_tailwind_ui',
    generate_layout:          'coding_generate_react_layout',
    generate_hook:            'coding_generate_react_hook',
    generate_context:         'coding_generate_react_context',
    generate_routing:         'coding_generate_react_routing',
    generate_dashboard:       'coding_generate_dashboard',
    generate_form:            'coding_generate_form',
    generate_navbar:          'coding_generate_navbar',
    generate_sidebar:         'coding_generate_sidebar',
    generate_table:           'coding_generate_table',
    generate_modal:           'coding_generate_modal',
    // Backend
    generate_route:           'coding_generate_express_route',
    generate_rest_api:        'coding_generate_rest_api',
    generate_controller:      'coding_generate_controller',
    generate_middleware:      'coding_generate_middleware',
    generate_auth_middleware: 'coding_generate_auth_middleware',
    generate_service:         'coding_generate_service',
    generate_module:          'coding_generate_module',
    generate_error_handler:   'coding_generate_error_handler',
    generate_server:          'coding_generate_server_bootstrap',
    // API
    generate_api_client:      'coding_generate_api_client',
    generate_api_handler:     'coding_generate_api_handler',
    generate_api_validation:  'coding_generate_api_validation',
    generate_request_schema:  'coding_generate_request_schema',
    generate_response_schema: 'coding_generate_response_schema',
    // Database
    generate_schema:          'coding_generate_schema',
    generate_model:           'coding_generate_model',
    generate_migration:       'coding_generate_migration',
    generate_repository:      'coding_generate_repository',
    generate_seed:            'coding_generate_seed',
    generate_relation:        'coding_generate_relation',
    generate_db_config:       'coding_generate_db_config',
    // CRUD
    generate_crud_api:        'coding_generate_crud_api',
    generate_crud_module:     'coding_generate_crud_module',
    generate_crud_ui:         'coding_generate_crud_ui',
    generate_crud_schema:     'coding_generate_crud_schema',
    // Auth
    generate_auth:            'coding_generate_jwt_auth',
    generate_login_flow:      'coding_generate_login_flow',
    generate_signup_flow:     'coding_generate_signup_flow',
    generate_session_auth:    'coding_generate_session_auth',
    generate_role_system:     'coding_generate_role_system',
    generate_password_hashing: 'coding_generate_password_hashing',
    // Generic catch-all — handles "create hello.ts", arbitrary file requests
    generate_generic_file:    'coding_generate_generic_file',
    generate_file:            'coding_generate_generic_file',  // alias
    generic:                  'coding_generate_generic_file',  // alias
  };

  // Unknown subKind → fall back to generic file writer (not react page)
  const toolName = toolMap[subKind] ?? 'coding_generate_generic_file';

  // Adapt the generic task input { goal, type, subKind, phaseIndex } to
  // the tool-specific inputs each handler actually expects.
  const goal = String(input.goal ?? input.description ?? '');
  const toolInput = adaptCodingInput(toolName, goal, input);

  return { toolName, toolInput };
}

// ── Input adapter — maps generic task input to tool-specific fields ────────────
// Each coding tool expects specific input fields (name, resource, route, etc.).
// Task input only has { goal, type, subKind, phaseIndex }.
// This function bridges that gap by deriving the right fields from goal.

function adaptCodingInput(
  toolName: string,
  goal:     string,
  raw:      Record<string, unknown>,
): Record<string, unknown> {
  // Extract a filename from the goal if present (e.g. "hello.ts")
  const fileMatch = goal.match(/\b([\w/-]+\.(ts|tsx|js|jsx|mts|json|md))\b/i);
  const filePath  = fileMatch ? fileMatch[1] : undefined;

  // Extract a PascalCase or kebab name from goal for component-style tools
  const nameMatch = goal.match(/\b([A-Z][a-zA-Z]+|[a-z][a-z-]+)\b/);
  const derivedName = filePath
    ? filePath.replace(/\.[^.]+$/, '').split('/').pop() ?? 'Generated'
    : (nameMatch?.[1] ?? 'Generated');

  switch (toolName) {
    // ── Generic catch-all ────────────────────────────────────────────────────
    case 'coding_generate_generic_file':
      return { goal, path: filePath, ...raw };

    // ── Frontend ─────────────────────────────────────────────────────────────
    case 'coding_generate_react_page':
    case 'coding_generate_tailwind_ui':
    case 'coding_generate_react_layout':
    case 'coding_generate_navbar':
    case 'coding_generate_sidebar':
    case 'coding_generate_table':
    case 'coding_generate_modal':
    case 'coding_generate_form':
    case 'coding_generate_dashboard':
      return { name: derivedName, goal, ...raw };

    case 'coding_generate_react_hook':
      return { hookName: `use${toPascalCase(derivedName)}`, goal, ...raw };

    case 'coding_generate_react_context':
      return { contextName: `${toPascalCase(derivedName)}Context`, goal, ...raw };

    case 'coding_generate_react_routing':
      return { pages: [derivedName], goal, ...raw };

    // ── Backend ───────────────────────────────────────────────────────────────
    case 'coding_generate_express_route':
    case 'coding_generate_rest_api':
    case 'coding_generate_controller':
    case 'coding_generate_api_client':
    case 'coding_generate_api_handler':
    case 'coding_generate_api_validation':
      return { route: `/${derivedName.toLowerCase()}`, resource: derivedName, goal, ...raw };

    case 'coding_generate_middleware':
    case 'coding_generate_auth_middleware':
    case 'coding_generate_error_handler':
    case 'coding_generate_module':
    case 'coding_generate_server_bootstrap':
      return { name: derivedName, goal, ...raw };

    case 'coding_generate_service':
      return { resource: derivedName, goal, ...raw };

    // ── Database ─────────────────────────────────────────────────────────────
    case 'coding_generate_schema':
    case 'coding_generate_model':
    case 'coding_generate_repository':
    case 'coding_generate_seed':
    case 'coding_generate_migration':
    case 'coding_generate_relation':
    case 'coding_generate_db_config':
      return { resource: derivedName, name: derivedName, goal, ...raw };

    // ── Auth ──────────────────────────────────────────────────────────────────
    case 'coding_generate_jwt_auth':
    case 'coding_generate_session_auth':
    case 'coding_generate_login_flow':
    case 'coding_generate_signup_flow':
    case 'coding_generate_role_system':
    case 'coding_generate_password_hashing':
      return { resource: 'user', name: derivedName, goal, ...raw };

    // ── CRUD ──────────────────────────────────────────────────────────────────
    case 'coding_generate_crud_api':
    case 'coding_generate_crud_module':
    case 'coding_generate_crud_ui':
    case 'coding_generate_crud_schema':
      return { resource: derivedName, name: derivedName, goal, ...raw };

    default:
      // Unknown tool — pass through everything plus goal/name as hints
      return { goal, name: derivedName, ...raw };
  }
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
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
