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

export function registerTerminalTools(opts: { force?: boolean } = {}): void {
  if (_registered && !opts.force) return;
  _registered = true;

  const tools = [
    npmInstallTool, npmCiTool, npmRunScriptTool, npmBuildTool, npmTestTool,
    writePackageJsonTool, lockfileStatusTool, deleteLockfileTool,
    validatePackageNameTool, validatePackageListTool,
    resolvePortTool, releasePortTool, releaseRunPortsTool,
    assignedPortTool, portInUseTool, scanPortRangeTool, findFreePortTool,
    processRegisterTool, processHistoryTool, processStartTool,
    processStopTool, processWatchTool, cleanupRunTool,
  ];

  for (const tool of tools) {
    try {
      registerTool(tool, opts);
    } catch (err) {
      console.warn(`[register-terminal-tools] Skipped "${tool.name}": ${(err as Error).message}`);
    }
  }

  console.log(`[register-terminal-tools] Registered ${tools.length} terminal tools`);
}
