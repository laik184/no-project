import { shellExecute }          from '../execution/shell-executor.ts';
import { validatePackageList }   from './dependency-validator.ts';
import { assertWorkspaceReady }  from '../workspace/workspace-resolver.ts';
import { runtimeLogger }         from '../telemetry/runtime-logger.ts';
import type { ExecutionResult }  from '../types/execution.types.ts';

const INSTALL_TIMEOUT_MS = 120_000;

export async function npmInstall(
  runId:     string,
  projectId: string,
  packages:  string[] = [],
  dev        = false,
): Promise<ExecutionResult> {
  if (packages.length > 0) {
    const check = validatePackageList(packages);
    if (!check.valid) {
      throw new Error(`[npm-installer] Blocked packages: ${check.errors.join('; ')}`);
    }
  }

  const cwd     = await assertWorkspaceReady(projectId);
  const devFlag = dev ? ' --save-dev' : '';
  const cmd     = packages.length > 0
    ? `npm install ${packages.join(' ')}${devFlag}`
    : 'npm install';

  runtimeLogger.info(runId, `[npm-installer] ${cmd}`);
  return shellExecute(cmd, cwd, INSTALL_TIMEOUT_MS);
}

export async function npmCi(
  runId:     string,
  projectId: string,
): Promise<ExecutionResult> {
  const cwd = await assertWorkspaceReady(projectId);
  runtimeLogger.info(runId, '[npm-installer] npm ci');
  return shellExecute('npm ci', cwd, INSTALL_TIMEOUT_MS);
}
