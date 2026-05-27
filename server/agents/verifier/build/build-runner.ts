import { npmRunScript } from '../../terminal/npm/npm-script-runner.ts';
import { assertWorkspaceReady } from '../../terminal/workspace/workspace-resolver.ts';
import { validateBuildResult } from './build-validator.ts';
import { parseBuildErrors } from './build-error-parser.ts';
import { analyzeBuildOutput } from './build-output-analyzer.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import type { ParsedError } from '../types/diagnostics.types.ts';

export interface BuildRunResult {
  passed:   boolean;
  exitCode: number;
  errors:   ParsedError[];
  stdout:   string;
  stderr:   string;
  analysis: ReturnType<typeof analyzeBuildOutput>;
}

const BUILD_TIMEOUT_MS = 120_000;

export async function runBuild(
  runId:     string,
  projectId: string,
  script     = 'build',
): Promise<BuildRunResult> {
  verifierLogger.phase(runId, 'build', 'start', { script });

  await assertWorkspaceReady(projectId);

  const result   = await npmRunScript(runId, projectId, script, BUILD_TIMEOUT_MS);
  const stdout   = result.stdout ?? '';
  const stderr   = result.stderr ?? '';
  const exitCode = result.exitCode ?? 1;

  const validation = validateBuildResult(stdout, stderr, exitCode);
  const errors     = parseBuildErrors(`${stdout}\n${stderr}`);
  const analysis   = analyzeBuildOutput(stdout, stderr);

  const passed = validation.valid;

  verifierLogger.phase(runId, 'build', passed ? 'end' : 'fail', {
    exitCode,
    errors: errors.length,
  });

  return { passed, exitCode, errors, stdout, stderr, analysis };
}
