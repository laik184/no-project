/**
 * tool-result.ts
 * Standardised result envelope returned by every tool dispatcher call.
 */

export type ToolStatus = 'ok' | 'error';

export interface ToolResult {
  status:    ToolStatus;
  output:    string;
  filePath?: string;
  error?:    string;
  meta?:     Record<string, unknown>;
}

export function ok(output: string, filePath?: string, meta?: Record<string, unknown>): ToolResult {
  return { status: 'ok', output, filePath, meta };
}

export function err(error: string, output = ''): ToolResult {
  return { status: 'error', output, error };
}

export function isOk(result: ToolResult): boolean {
  return result.status === 'ok';
}

/** Summarise a result for injection into LLM context (keeps it short). */
export function summarise(result: ToolResult, maxLen = 800): string {
  const text = result.status === 'ok' ? result.output : `ERROR: ${result.error ?? result.output}`;
  return text.length > maxLen ? `${text.slice(0, maxLen)}…(truncated)` : text;
}
