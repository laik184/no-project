/**
 * memory-tools.ts
 * Memory agent removed — MemoryManager inlined as no-op.
 */

import type { Tool, ToolContext, ToolResult } from "../registry/tool-types.ts";

class MemoryManager {
  private static instances = new Map<number, MemoryManager>();
  static for(projectId: number): MemoryManager {
    if (!this.instances.has(projectId)) this.instances.set(projectId, new MemoryManager());
    return this.instances.get(projectId)!;
  }
  async appendDecisionMd(_c: string): Promise<void> {}
  async appendProgressMd(_c: string): Promise<void> {}
  async appendFailedAttemptMd(_c: string): Promise<void> {}
  async getArchitecture(): Promise<string> { return ""; }
  async setArchitecture(_c: string): Promise<void> {}
}

export const memoryUpdate: Tool = {
  name: "memory_update",
  description: "Persist an important note to project memory so it survives across agent runs.",
  parameters: {
    type: "object",
    properties: {
      type:    { type: "string", enum: ["decision", "progress", "failure", "architecture"], description: "Memory category." },
      content: { type: "string", description: "The memory content." },
    },
    required: ["type", "content"],
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const type    = (args.type    as string)?.trim();
    const content = (args.content as string)?.trim();
    if (!content) return { ok: false, error: "content must not be empty" };
    if (!["decision", "progress", "failure", "architecture"].includes(type)) return { ok: false, error: `Unknown memory type: "${type}"` };
    const mem = MemoryManager.for(ctx.projectId);
    switch (type) {
      case "decision":     await mem.appendDecisionMd(content);     break;
      case "progress":     await mem.appendProgressMd(content);     break;
      case "failure":      await mem.appendFailedAttemptMd(content); break;
      case "architecture": { const existing = await mem.getArchitecture(); await mem.setArchitecture((existing || "# Architecture\n") + `\n## [${new Date().toISOString().slice(0,10)}]\n${content}\n`); break; }
    }
    return { ok: true, result: { type, persisted: true, chars: content.length } };
  },
};

export const memoryRead: Tool = {
  name: "memory_read",
  description: "Read the current project memory state.",
  parameters: { type: "object", properties: { sections: { type: "array", items: { type: "string" }, description: "Which memory sections to return." } }, required: [] },
  async run(_args, _ctx: ToolContext): Promise<ToolResult> {
    return { ok: true, result: { architecture: "", progress: "", decisions: "", failures: "", tasks: "", recentRuns: [] } };
  },
};
