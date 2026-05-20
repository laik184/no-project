import './registry/tool-catalog.ts';
import { unifiedRegistry } from './registry/tool-registry.ts';
import type { ToolContext, ToolDef } from './registry/tool-types.ts';

export type { ToolContext };

export const toolOrchestrator = {
  has(name: string): boolean {
    return unifiedRegistry.has(name);
  },
  async execute(name: string, args: Record<string, unknown>, ctx: ToolContext) {
    return unifiedRegistry.execute(name, args, ctx);
  },
};

export const TERMINAL_TOOL_NAMES: Set<string> = unifiedRegistry.terminalToolNames;

export const TOOL_DEFS: ToolDef[] = unifiedRegistry.toolDefs;

export async function runToolsOperation(input: unknown): Promise<unknown> {
  const req = input as Record<string, unknown>;
  const name = req?.tool as string;
  const args = (req?.args ?? {}) as Record<string, unknown>;
  const ctx: ToolContext = {
    projectId: (req?.projectId as number) ?? 0,
    runId:     (req?.runId     as string) ?? 'tools-op',
  };
  if (!name) return { ok: false, error: 'Missing tool name' };
  return unifiedRegistry.execute(name, args, ctx);
}
