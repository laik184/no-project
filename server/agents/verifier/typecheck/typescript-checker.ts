import { shellExecute } from '../../terminal/execution/shell-executor.ts';
import { assertWorkspaceReady } from '../../terminal/workspace/workspace-resolver.ts';
import { parseTscOutput, extractErrorCount, rawToParseError } from './type-error-parser.ts';
import { buildTypecheckReport, type TypecheckReport } from './typecheck-reporter.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import type { ParsedError } from '../types/diagnostics.types.ts';

const TSC_TIMEOUT_MS  = 60_000;
const TSC_CMD         = 'npx tsc --noEmit --pretty false 2>&1 || true';

export interface TypecheckResult {
  passed:   boolean;
  exitCode: number;
  errors:   ParsedError[];
  report:   TypecheckReport;
  rawOutput: string;
}

export async function runTypecheck(
  runId:     string,
  projectId: string,
): Promise<TypecheckResult> {
  verifierLogger.phase(runId, 'typecheck', 'start');

  const cwd = await assertWorkspaceReady(projectId);

  const execution = await shellExecute(TSC_CMD, cwd, TSC_TIMEOUT_MS);
  const rawOutput  = `${execution.stdout}\n${execution.stderr}`.trim();

  const rawErrors  = parseTscOutput(rawOutput);
  const parsedErrors = rawErrors.map(rawToParseError);
  const errorCount = extractErrorCount(rawOutput);
  const passed     = execution.exitCode === 0 && errorCount === 0;

  const report = buildTypecheckReport(rawErrors, execution.exitCode);

  verifierLogger.phase(runId, 'typecheck', passed ? 'end' : 'fail', {
    errors:   rawErrors.length,
    exitCode: execution.exitCode,
  });

  return { passed, exitCode: execution.exitCode, errors: parsedErrors, report, rawOutput };
}
