import { shellExecute }          from '../execution/shell-executor.ts';
import { assertWorkspaceReady }  from '../workspace/workspace-resolver.ts';
import { runtimeLogger }         from '../telemetry/runtime-logger.ts';
import type { ExecutionResult }  from '../types/execution.types.ts';

const SCRIPT_TIMEOUT_MS = 60_000;

const ALLOWED_SCRIPTS = new Set([
  'dev', 'start', 'build', 'test', 'lint', 'typecheck',
  'format', 'preview', 'check', 'generate', 'migrate',
]);

export async function npmRunScript(
  runId:     string,
  projectId: string,
  script:    string,
  timeoutMs  = SCRIPT_TIMEOUT_MS,
): Promise<ExecutionResult> {
  if (!ALLOWED_SCRIPTS.has(script) && !/^[a-z][a-z0-9:-]*$/.test(script)) {
    throw new Error(`[npm-script-runner] Script name not allowed: "${script}"`);
  }

  const cwd = await assertWorkspaceReady(projectId);
  const cmd = `npm run ${script}`;

  runtimeLogger.info(runId, `[npm-script-runner] ${cmd}`, { timeoutMs });
  return shellExecute(cmd, cwd, timeoutMs);
}

export async function npmTest(
  runId:     string,
  projectId: string,
): Promise<ExecutionResult> {
  return npmRunScript(runId, projectId, 'test', 120_000);
}

export async function npmBuild(
  runId:     string,
  projectId: string,
): Promise<ExecutionResult> {
  return npmRunScript(runId, projectId, 'build', 180_000);
}
