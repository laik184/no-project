import {
  analyzeOutput,
  analyzeMultipleOutputs,
  buildDiagnosticsReport,
} from '../../../agents/verifier/diagnostics/error-analyzer.ts';
import type { ParsedError, DiagnosticsReport } from '../shared/verifier-types.ts';
import type { ToolDefinition }                  from '../../registry/tool-types.ts';
import { toToolOk }                             from '../shared/verifier-result.ts';

export { analyzeOutput, analyzeMultipleOutputs, buildDiagnosticsReport };

export const errorAnalyzerTool: ToolDefinition = {
  name:        'analyze_errors',
  category:    'verifier',
  description: 'Analyze output text for errors and build a diagnostics report',
  inputSchema: {
    runId:  { type: 'string', description: 'Run ID',         required: true },
    output: { type: 'string', description: 'Output to scan', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const errors = analyzeOutput(input.runId as string, input.output as string);
    const report = buildDiagnosticsReport(input.runId as string, errors);
    return toToolOk(report, Date.now() - start);
  },
};
