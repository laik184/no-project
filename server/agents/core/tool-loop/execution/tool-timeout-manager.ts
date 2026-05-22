/**
 * server/agents/core/tool-loop/execution/tool-timeout-manager.ts
 *
 * Per-tool timeout configuration and Promise-race wrapper.
 * Timeouts match the defaults in the tool catalog (tool-catalog.ts).
 */

// ── Per-tool timeout table (ms) ───────────────────────────────────────────────

const TOOL_TIMEOUTS_MS: Readonly<Record<string, number>> = {
  file_list:               10_000,
  file_read:               10_000,
  file_write:              10_000,
  file_delete:             10_000,
  file_search:             15_000,
  file_replace:            10_000,
  shell_exec:              30_000,
  package_install:        120_000,
  package_uninstall:       60_000,
  package_audit:           30_000,
  detect_missing_packages: 10_000,
  server_start:            15_000,
  server_stop:             10_000,
  server_restart:          15_000,
  server_logs:              5_000,
  preview_url:              5_000,
  preview_screenshot:      20_000,
  env_read:                 5_000,
  env_write:                5_000,
  git_status:              10_000,
  git_add:                 10_000,
  git_commit:              10_000,
  git_clone:               60_000,
  git_push:                30_000,
  git_pull:                30_000,
  db_migrate:              60_000,
  db_seed:                 60_000,
  db_query:                30_000,
  deploy_build:           120_000,
  deploy_status:            5_000,
  deploy_typecheck:        60_000,
  test_run:                60_000,
  test_lint:               60_000,
  test_coverage:          120_000,
  browser_navigate:        20_000,
  browser_click:           15_000,
  browser_fill:            15_000,
  network_fetch:           15_000,
  network_port_check:       5_000,
  network_dns_lookup:       5_000,
  auth_scaffold:           10_000,
  auth_audit:              30_000,
  agent_wait:              15_000,
  agent_ask_user:         300_000,
  agent_emit_event:         5_000,
  agent_think:              5_000,
  agent_fail:               5_000,
  memory_update:            5_000,
  memory_read:              5_000,
};

const DEFAULT_TIMEOUT_MS = 30_000;

export function getToolTimeout(toolName: string): number {
  return TOOL_TIMEOUTS_MS[toolName] ?? DEFAULT_TIMEOUT_MS;
}

// ── Tagged union for the race result ──────────────────────────────────────────

type TimedOk<T>      = { timedOut: false; result: T };
type TimedTimeout    = { timedOut: true;  result: null; timeoutMs: number };
export type TimedResult<T> = TimedOk<T> | TimedTimeout;

/**
 * Races `promise` against the per-tool timeout.
 * Never rejects — the caller decides how to handle a timedOut result.
 */
export function withTimeout<T>(
  promise:  Promise<T>,
  toolName: string,
  _callId:  string,
): Promise<TimedResult<T>> {
  const timeoutMs = getToolTimeout(toolName);

  const timeout$ = new Promise<TimedTimeout>((resolve) =>
    setTimeout(() => resolve({ timedOut: true, result: null, timeoutMs }), timeoutMs),
  );

  const work$ = promise.then((result): TimedOk<T> => ({ timedOut: false, result }));

  return Promise.race([work$, timeout$]);
}
