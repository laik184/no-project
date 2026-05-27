/**
 * Fix #10 — Atomic registration with fail-fast idempotency guard.
 *
 * Previous bug: _registered was set BEFORE the loop, so partial failures
 * left the category permanently half-registered with no way to detect it.
 *
 * Fix: _registered is only set AFTER the full loop completes without errors.
 *      Any registration failure throws immediately (fail-closed).
 */
import { registerTool } from '../../registry/tool-registry.ts';
import { npmInstallTool }       from '../npm/npm-install.ts';
import { npmCiTool }            from '../npm/npm-ci.ts';
import { npmRunScriptTool }     from '../npm/npm-run-script.ts';
import { npmBuildTool }         from '../npm/npm-build.ts';
import { npmTestTool }          from '../npm/npm-test.ts';
import { writePackageJsonTool } from '../npm/write-package-json.ts';
import { lockfileStatusTool }   from '../npm/lockfile-status.ts';
import { deleteLockfileTool }   from '../npm/delete-lockfile.ts';
import { validatePackageNameTool } from '../npm/validate-package-name.ts';
import { validatePackageListTool } from '../npm/validate-package-list.ts';
import { resolvePortTool }      from '../ports/resolve-port.ts';
import { releasePortTool }      from '../ports/release-port.ts';
import { releaseRunPortsTool }  from '../ports/release-run-ports.ts';
import { assignedPortTool }     from '../ports/assigned-port.ts';
import { portInUseTool }        from '../ports/port-in-use.ts';
import { scanPortRangeTool }    from '../ports/scan-port-range.ts';
import { findFreePortTool }     from '../ports/find-free-port.ts';
import { processRegisterTool }  from '../process/process-register.ts';
import { processHistoryTool }   from '../process/process-history.ts';
import { processStartTool }     from '../process/process-start.ts';
import { processStopTool }      from '../process/process-stop.ts';
import { processWatchTool }     from '../process/process-watch.ts';
import { cleanupRunTool }       from '../process/cleanup-run.ts';

let _registered = false;

export const TERMINAL_TOOL_NAMES = [
  'npm_install', 'npm_ci', 'npm_run_script', 'npm_build', 'npm_test',
  'write_package_json', 'lockfile_status', 'delete_lockfile',
  'validate_package_name', 'validate_package_list',
  'resolve_port', 'release_port', 'release_run_ports',
  'assigned_port', 'port_in_use', 'scan_port_range', 'find_free_port',
  'process_register', 'process_history', 'process_start',
  'process_stop', 'process_watch', 'cleanup_run',
] as const;

export const TERMINAL_TOOL_COUNT = TERMINAL_TOOL_NAMES.length;

export function registerTerminalTools(opts: { force?: boolean } = {}): void {
  if (_registered && !opts.force) return;

  const tools = [
    npmInstallTool, npmCiTool, npmRunScriptTool, npmBuildTool, npmTestTool,
    writePackageJsonTool, lockfileStatusTool, deleteLockfileTool,
    validatePackageNameTool, validatePackageListTool,
    resolvePortTool, releasePortTool, releaseRunPortsTool,
    assignedPortTool, portInUseTool, scanPortRangeTool, findFreePortTool,
    processRegisterTool, processHistoryTool, processStartTool,
    processStopTool, processWatchTool, cleanupRunTool,
  ];

  // Fail-fast: any error aborts the entire registration.
  // _registered is only set on full success (Fix #10).
  for (const tool of tools) {
    registerTool(tool, opts);
  }

  _registered = true;
  console.log(`[register-terminal-tools] Registered ${tools.length} terminal tools`);
}
