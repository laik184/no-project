/**
 * server/tools/categories/file-tools.ts
 *
 * File tools: file_list, file_read, file_write, file_delete
 *
 * Security: file_write routes through the diff approval gate for existing files.
 * New files are written directly. The gate is bypassed when DISABLE_DIFF_APPROVAL=true.
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir, resolveSafe }     from "../../infrastructure/sandbox/sandbox.util.ts";
import { emitFileChange, emitFileWriting }  from "../../infrastructure/events/file-change-emitter.ts";
import { requestApproval, isApprovalEnabled } from "../../approvals/diff-approval.service.ts";
import { atomicWrite }                     from "../../infrastructure/checkpoints/atomic-write.util.ts";
import { checkpointStore }                 from "../../infrastructure/checkpoints/checkpoint.service.ts";
import type { Tool, ToolContext, ToolResult } from "../types.ts";

// ── file_list ─────────────────────────────────────────────────────────────────

async function buildTree(dir: string, maxDepth: number, depth = 0): Promise<string[]> {
  if (depth >= maxDepth) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const lines: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") && depth === 0) continue;
    if (["node_modules", ".git", "dist", ".cache"].includes(e.name)) continue;
    const indent = "  ".repeat(depth);
    if (e.isDirectory()) {
      lines.push(`${indent}${e.name}/`);
      lines.push(...await buildTree(path.join(dir, e.name), maxDepth, depth + 1));
    } else {
      lines.push(`${indent}${e.name}`);
    }
  }
  return lines;
}

export const fileList: Tool = {
  name: "file_list",
  description: "List the directory tree of the project sandbox.",
  parameters: {
    type: "object",
    properties: {
      path:     { type: "string", description: "Subdirectory to list (default: project root)" },
      maxDepth: { type: "number", description: "Max depth (default 4)" },
    },
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const projectDir = getProjectDir(ctx.projectId);
    const subPath    = (args.path as string) || ".";
    const maxDepth   = (args.maxDepth as number) || 4;
    try {
      const targetDir = resolveSafe(projectDir, subPath);
      const tree = await buildTree(targetDir, maxDepth);
      return { ok: true, result: { path: subPath, tree: tree.join("\n"), count: tree.length } };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
};

// ── file_read ─────────────────────────────────────────────────────────────────

export const fileRead: Tool = {
  name: "file_read",
  description: "Read the contents of a file in the project sandbox.",
  parameters: {
    type: "object",
    properties: {
      path:   { type: "string", description: "Relative file path" },
      offset: { type: "number", description: "Start line (1-indexed, optional)" },
      limit:  { type: "number", description: "Max lines to read (optional)" },
    },
    required: ["path"],
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const projectDir = getProjectDir(ctx.projectId);
    try {
      const abs = resolveSafe(projectDir, args.path as string);
      let content = await fs.readFile(abs, "utf-8");
      if (args.offset || args.limit) {
        const lines = content.split("\n");
        const start = ((args.offset as number) || 1) - 1;
        const end   = args.limit ? start + (args.limit as number) : lines.length;
        content = lines.slice(start, end).join("\n");
      }
      const stat = await fs.stat(abs);
      return { ok: true, result: { path: args.path, content, size: stat.size } };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
};

// ── file_write ────────────────────────────────────────────────────────────────

export const fileWrite: Tool = {
  name: "file_write",
  description:
    "Create or overwrite a file in the project sandbox. " +
    "For existing files, a diff is sent to the user for approval before writing. " +
    "New files are created immediately.",
  parameters: {
    type: "object",
    properties: {
      path:    { type: "string", description: "Relative file path" },
      content: { type: "string", description: "File content" },
    },
    required: ["path", "content"],
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const projectDir  = getProjectDir(ctx.projectId);
    const filePath    = args.path as string;
    const newContent  = args.content as string;

    try {
      const abs         = resolveSafe(projectDir, filePath);
      const existedStat = await fs.stat(abs).catch(() => null);
      const isNewFile   = existedStat === null;

      // ── Approval gate: only for existing files ───────────────────────────────
      if (!isNewFile && isApprovalEnabled()) {
        const oldContent = await fs.readFile(abs, "utf-8").catch(() => "");

        if (oldContent === newContent) {
          return { ok: true, result: { path: filePath, written: true, unchanged: true } };
        }

        const { sessionId, diffId, additions, deletions } = await requestApproval({
          sessionId:  "", // generated inside requestApproval
          projectId:  ctx.projectId,
          runId:      ctx.runId,
          filePath,
          isNewFile:  false,
          oldContent,
          newContent,
        });

        return {
          ok: true,
          result: {
            path:             filePath,
            pending:          true,
            approvalRequired: true,
            sessionId,
            diffId,
            additions,
            deletions,
            message:
              `Diff sent for user approval (+${additions}/-${deletions} lines). ` +
              `File will be written when the user approves. ` +
              `Do not attempt to re-write this file until the user confirms.`,
          },
        };
      }

      // ── Direct write: new file or approval disabled (atomic) ─────────────────
      emitFileWriting(ctx.projectId, filePath);
      await atomicWrite(abs, newContent);
      const stat = await fs.stat(abs);
      emitFileChange(ctx.projectId, isNewFile ? "add" : "change", filePath);
      return { ok: true, result: { path: filePath, size: stat.size, written: true } };

    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
};

// ── file_delete ───────────────────────────────────────────────────────────────

export const fileDelete: Tool = {
  name: "file_delete",
  description: "Delete a file or directory in the project sandbox.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative file or directory path" },
    },
    required: ["path"],
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    const projectDir = getProjectDir(ctx.projectId);
    try {
      const abs = resolveSafe(projectDir, args.path as string);

      // ── Pre-destructive checkpoint — snapshot before deletion ─────────────
      checkpointStore.create({
        projectId:   ctx.projectId,
        sandboxRoot: getProjectDir(ctx.projectId),
        trigger:     "pre_destructive",
        runId:       ctx.runId,
        label:       `pre-delete: ${String(args.path).slice(0, 60)}`,
      }).catch(() => { /* non-fatal — never block a delete */ });

      await fs.rm(abs, { recursive: true, force: true });
      emitFileChange(ctx.projectId, "unlink", args.path as string);
      return { ok: true, result: { path: args.path, deleted: true } };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
};
