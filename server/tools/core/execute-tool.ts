/**
 * server/tools/core/execute-tool.ts
 *
 * Low-level tool executor — invoked by the node executor.
 * Takes a registered entry + args + context, runs the handler,
 * and returns a normalized { ok, result, error } envelope.
 */

import type { ToolContext } from './tool-context.ts';

export interface RegisteredToolEntry {
  tool: {
    name:        string;
    description: string;
    parameters?: Record<string, unknown>;
  };
  category:    string;
  terminal:    boolean;
  permissions: readonly string[];
  handler:     (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  timeoutMs:   number;
}

export interface ToolExecuteResult {
  ok:      boolean;
  result?: unknown;
  error?:  string;
  durationMs: number;
}

/**
 * Execute a registered tool entry with timeout protection.
 * Never throws — always returns ToolExecuteResult.
 */
export async function executeTool(
  entry:  RegisteredToolEntry,
  args:   Record<string, unknown>,
  ctx:    ToolContext,
): Promise<ToolExecuteResult> {
  const start = Date.now();
  const ms    = entry.timeoutMs ?? 30_000;

  try {
    const result = await Promise.race([
      entry.handler(args, ctx),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool "${entry.tool.name}" timed out after ${ms}ms`)), ms),
      ),
    ]);
    return { ok: true, result, durationMs: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error, durationMs: Date.now() - start };
  }
}
