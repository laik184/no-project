import { buildDiagnosticsReport }             from '../lib/error-analyzer.ts';
import { detectRootCauses }                   from '../lib/rootcause-detector.ts';
import type { ParsedError, DiagnosticsReport } from '../shared/verifier-types.ts';
import type { ToolDefinition }                 from '../../registry/tool-types.ts';
import { toToolOk }                            from '../shared/verifier-result.ts';

export { buildDiagnosticsReport };

export function buildFullDiagnosticsReport(runId: string, errors: ParsedError[]): DiagnosticsReport {
  const report     = buildDiagnosticsReport(runId, errors);
  const rootCauses = detectRootCauses(errors);
  return { ...report, rootCauses };
}

export const diagnosticsReportTool: ToolDefinition = {
  name:        'build_diagnostics_report',
  category:    'verifier',
  description: 'Build a full diagnostics report from a list of errors',
  inputSchema: {
    runId:  { type: 'string', description: 'Run ID',            required: true },
    errors: { type: 'array',  description: 'ParsedError array', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const report = buildFullDiagnosticsReport(input.runId as string, input.errors as ParsedError[]);
    return toToolOk(report, Date.now() - start);
  },
};
