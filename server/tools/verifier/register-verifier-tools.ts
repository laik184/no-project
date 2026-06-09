/**
 * server/tools/verifier/register-verifier-tools.ts
 *
 * Registers ALL verifier tools with the central tool registry.
 * Called once at application boot by tool-loader.ts, before sealRegistry().
 * Idempotent — subsequent calls are no-ops.
 */

import { registerTool } from '../registry/tool-registry.ts';

import { runTypecheckTool }              from './run-typecheck-tool.ts';
import { runBuildTool }                  from './run-build-tool.ts';
import { runTestsTool }                  from './run-tests-tool.ts';
import { runLintTool }                   from './run-lint-tool.ts';
import { checkServerHealthTool }         from './check-server-health-tool.ts';
import { validateRuntimeTool }           from './validate-runtime-tool.ts';
import { validateDependenciesTool }      from './validate-dependencies-tool.ts';
import { analyzeErrorsTool }             from './analyze-errors-tool.ts';
import { verifierFailureRecoveryTool }   from './verifier-failure-recovery-tool.ts';
import { detectRootCausesTool }          from './detect-root-causes-tool.ts';
import { parseRuntimeLogsTool }          from './parse-runtime-logs-tool.ts';
import { detectRuntimeCrashTool }        from './detect-runtime-crash-tool.ts';

const ALL_VERIFIER_TOOLS = [
  runTypecheckTool,
  runBuildTool,
  runTestsTool,
  runLintTool,
  checkServerHealthTool,
  validateRuntimeTool,
  validateDependenciesTool,
  analyzeErrorsTool,
  verifierFailureRecoveryTool,
  detectRootCausesTool,
  parseRuntimeLogsTool,
  detectRuntimeCrashTool,
] as const;

let _registered = false;

export function registerVerifierTools(): void {
  if (_registered) return;
  for (const tool of ALL_VERIFIER_TOOLS) {
    registerTool(tool, { force: false });
  }
  _registered = true;
  console.log(`[register-verifier-tools] Registered ${ALL_VERIFIER_TOOLS.length} verifier tools`);
}
