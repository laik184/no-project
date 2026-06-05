/**
 * server/tools/contracts/tool-registry.ts
 *
 * Lightweight singleton ToolRegistry.
 * Provides: register, unregister, get, execute, list.
 *
 * This registry is for the Clean-Architecture tool layer.
 * It coexists with the existing platform tool-registry.
 */

import type { Tool, AnyTool } from './tool.ts';

class ToolRegistry {
  private readonly tools = new Map<string, AnyTool>();

  register<I, O>(tool: Tool<I, O>): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`[ToolRegistry] Tool "${tool.id}" is already registered.`);
    }
    this.tools.set(tool.id, tool as AnyTool);
  }

  unregister(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  get<I, O>(toolId: string): Tool<I, O> | undefined {
    return this.tools.get(toolId) as Tool<I, O> | undefined;
  }

  async execute<I, O>(toolId: string, input: I): Promise<O> {
    const tool = this.tools.get(toolId) as Tool<I, O> | undefined;
    if (!tool) {
      throw new Error(`[ToolRegistry] Tool "${toolId}" not found.`);
    }
    return tool.execute(input);
  }

  list(): ReadonlyArray<{ id: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      id:          t.id,
      description: t.description,
    }));
  }
}

export const toolRegistry = new ToolRegistry();
