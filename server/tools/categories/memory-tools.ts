/**
 * memory-tools.ts
 *
 * Agent-callable tools for reading and writing project memory mid-run.
 *
 * Previously the memory system only wrote context at run END (fire-and-forget
 * from the executor). These tools let the agent persist important decisions,
 * progress milestones, and failure notes at ANY point during a run, so they
 * survive even if the run hits max_steps or crashes.
 *
 * ── memory_update ─────────────────────────────────────────────────────────────
 * Appends a structured note to one of four .nura/ memory files:
 *   "decision"     → decisions.md    (technical/architectural choices)
 *   "progress"     → progress.md     (completed milestones, current state)
 *   "failure"      → failed-attempts.md (broken approaches to avoid)
 *   "architecture" → architecture.md (system design narrative)
 *
 * ── memory_read ───────────────────────────────────────────────────────────────
 * Returns one or more memory sections so the agent can re-check prior
 * decisions mid-run without relying solely on the startup context injection.
 *
 * Ownership: tools/categories — no orchestration logic.
 */

import type { Tool, ToolContext, ToolResult } from "../registry/tool-types.ts";
import { MemoryManager } from "../../agents/memory/index.ts";

// ─── memory_update ────────────────────────────────────────────────────────────

export const memoryUpdate: Tool = {
  name: "memory_update",
  description:
    "Persist an important note to project memory so it survives across agent runs. " +
    "Use for: architectural decisions ('decision'), completed milestones ('progress'), " +
    "broken approaches to avoid ('failure'), system design notes ('architecture'). " +
    "Call this immediately after making a significant choice — do not wait until task_complete.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["decision", "progress", "failure", "architecture"],
        description:
          "Memory category. " +
          "'decision' = technical/package/framework choice; " +
          "'progress' = completed milestone or current project state; " +
          "'failure' = approach that failed and must not be repeated; " +
          "'architecture' = system design or structural note.",
      },
      content: {
        type: "string",
        description:
          "The memory content. Be specific and actionable — vague notes are useless. " +
          "Good: 'Using JWT with bcrypt, tokens expire 7d, refresh stored in httpOnly cookie.' " +
          "Bad: 'Added auth.'",
      },
    },
    required: ["type", "content"],
  },

  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const type    = (args.type    as string)?.trim();
    const content = (args.content as string)?.trim();

    if (!content) return { ok: false, error: "content must not be empty" };
    if (!["decision", "progress", "failure", "architecture"].includes(type)) {
      return { ok: false, error: `Unknown memory type: "${type}"` };
    }

    const mem = MemoryManager.for(ctx.projectId);

    switch (type) {
      case "decision":     await mem.appendDecisionMd(content);     break;
      case "progress":     await mem.appendProgressMd(content);     break;
      case "failure":      await mem.appendFailedAttemptMd(content); break;
      case "architecture": {
        const existing = await mem.getArchitecture();
        const date     = new Date().toISOString().slice(0, 10);
        const appended = (existing || "# Architecture Decisions\n") +
          `\n## [${date}]\n${content}\n`;
        await mem.setArchitecture(appended);
        break;
      }
    }

    return { ok: true, result: { type, persisted: true, chars: content.length } };
  },
};

// ─── memory_read ──────────────────────────────────────────────────────────────

const ALL_SECTIONS = ["architecture", "progress", "decisions", "failures", "tasks", "recent-runs"] as const;
type Section = typeof ALL_SECTIONS[number];

export const memoryRead: Tool = {
  name: "memory_read",
  description:
    "Read the current project memory state. Returns the contents of .nura/ memory files " +
    "so you can check prior architectural decisions, completed work, and known failures " +
    "at any point during a run. Specify 'sections' to limit what's returned.",
  parameters: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "string",
          enum: [...ALL_SECTIONS],
        },
        description:
          "Which memory sections to return. " +
          "Omit to get all sections. " +
          "Options: 'architecture', 'progress', 'decisions', 'failures', 'tasks', 'recent-runs'.",
      },
    },
    required: [],
  },

  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const sections: Section[] = ((args.sections as string[]) ?? [...ALL_SECTIONS]) as Section[];
    const mem = MemoryManager.for(ctx.projectId);

    const result: Record<string, unknown> = {};

    await Promise.all(
      sections.map(async (section) => {
        switch (section) {
          case "architecture":  result.architecture  = await mem.getArchitecture();       break;
          case "progress":      result.progress      = await mem.getProgressMd();         break;
          case "decisions":     result.decisions     = await mem.getDecisionsMd();        break;
          case "failures":      result.failures      = await mem.getFailedAttemptsMd();   break;
          case "tasks":         result.tasks         = await mem.getTasksMd();            break;
          case "recent-runs":   result.recentRuns    = await mem.getRecentRuns(5);        break;
        }
      }),
    );

    return { ok: true, result };
  },
};
