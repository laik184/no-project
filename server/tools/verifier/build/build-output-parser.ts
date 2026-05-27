import { analyzeBuildOutput }                  from '../../../agents/verifier/build/build-output-analyzer.ts';
import type { BuildOutputAnalysis }             from '../../../agents/verifier/build/build-output-analyzer.ts';
import type { ToolDefinition }                  from '../../registry/tool-types.ts';
import { toToolOk }                             from '../shared/verifier-result.ts';

export { analyzeBuildOutput };
export type { BuildOutputAnalysis };

export function summarizeBuildOutput(analysis: BuildOutputAnalysis): string {
  const parts: string[] = [];
  if (analysis.hasErrors)   parts.push('errors detected');
  if (analysis.hasWarnings) parts.push('warnings detected');
  if (analysis.outputFiles.length) parts.push(`${analysis.outputFiles.length} output file(s)`);
  if (analysis.buildTimeMs) parts.push(`built in ${analysis.buildTimeMs}ms`);
  return parts.length > 0 ? parts.join(', ') : 'Build output parsed';
}

export const parseBuildOutputTool: ToolDefinition = {
  name:        'parse_build_output',
  category:    'verifier',
  description: 'Analyze and parse build stdout/stderr output',
  inputSchema: {
    stdout: { type: 'string', description: 'Build stdout', required: true },
    stderr: { type: 'string', description: 'Build stderr' },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = analyzeBuildOutput(input.stdout as string, (input.stderr as string) ?? '');
    return toToolOk(result, Date.now() - start);
  },
};
