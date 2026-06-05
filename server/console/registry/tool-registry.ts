/**
 * server/console/registry/tool-registry.ts
 *
 * Singleton ToolRegistry scoped to the console module.
 * Provides: register, unregister, get, execute, list.
 */

export interface ConsoleTool<TInput, TOutput> {
  readonly id:          string;
  readonly description: string;
  execute(input: TInput): Promise<TOutput>;
}

export interface ConsoleToolResult<T = unknown> {
  ok:     boolean;
  data?:  T;
  error?: string;
}

type AnyConsoleTool = ConsoleTool<unknown, unknown>;

class ConsoleToolRegistry {
  private readonly tools = new Map<string, AnyConsoleTool>();

  register<I, O>(tool: ConsoleTool<I, O>): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`[ConsoleToolRegistry] Tool "${tool.id}" is already registered.`);
    }
    this.tools.set(tool.id, tool as AnyConsoleTool);
  }

  unregister(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  get<I, O>(toolId: string): ConsoleTool<I, O> | undefined {
    return this.tools.get(toolId) as ConsoleTool<I, O> | undefined;
  }

  async execute<I, O>(toolId: string, input: I): Promise<O> {
    const tool = this.tools.get(toolId) as ConsoleTool<I, O> | undefined;
    if (!tool) throw new Error(`[ConsoleToolRegistry] Tool "${toolId}" not found.`);
    return tool.execute(input);
  }

  list(): ReadonlyArray<{ id: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      id:          t.id,
      description: t.description,
    }));
  }
}

export const consoleToolRegistry = new ConsoleToolRegistry();
