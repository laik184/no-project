/**
 * git/orchestrator.ts — infrastructure git action runner.
 *
 * Moved from agents/infrastructure/git/ → server/infrastructure/git/
 * (infrastructure domain, not an agent).
 *
 * Executes common git operations in a sandboxed project directory.
 * Called by master-registry.ts as a platform-services orchestrator.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitAction =
  | "commit"
  | "branch"
  | "checkout"
  | "merge"
  | "log"
  | "status"
  | "add"
  | "diff"
  | "reset";

export interface GitActionPayload {
  cwd?: string;
  message?: string;
  branch?: string;
  target?: string;
  files?: string[];
  args?: string[];
}

export interface GitActionResult {
  success: boolean;
  action: GitAction;
  stdout?: string;
  stderr?: string;
  error?: string;
}

async function git(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout: 30_000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    throw new Error(e.stderr ?? e.message ?? String(err));
  }
}

export async function runGitAction(
  action: GitAction,
  payload: GitActionPayload = {},
): Promise<GitActionResult> {
  const cwd = payload.cwd ?? process.cwd();

  try {
    switch (action) {
      case "status": {
        const { stdout } = await git(cwd, ["status", "--short"]);
        return { success: true, action, stdout };
      }
      case "log": {
        const args = ["log", "--oneline", "--decorate", "-20"];
        const { stdout } = await git(cwd, args);
        return { success: true, action, stdout };
      }
      case "add": {
        const files = payload.files?.length ? payload.files : ["."];
        const { stdout } = await git(cwd, ["add", ...files]);
        return { success: true, action, stdout };
      }
      case "commit": {
        const msg = payload.message ?? "chore: automated commit";
        const { stdout } = await git(cwd, ["commit", "-m", msg]);
        return { success: true, action, stdout };
      }
      case "branch": {
        const args = payload.branch
          ? ["checkout", "-b", payload.branch]
          : ["branch"];
        const { stdout } = await git(cwd, args);
        return { success: true, action, stdout };
      }
      case "checkout": {
        const target = payload.target ?? payload.branch ?? "main";
        const { stdout } = await git(cwd, ["checkout", target]);
        return { success: true, action, stdout };
      }
      case "merge": {
        const target = payload.target ?? payload.branch ?? "";
        if (!target) throw new Error("merge requires target branch");
        const { stdout } = await git(cwd, ["merge", target]);
        return { success: true, action, stdout };
      }
      case "diff": {
        const args = payload.args ?? ["--stat"];
        const { stdout } = await git(cwd, ["diff", ...args]);
        return { success: true, action, stdout };
      }
      case "reset": {
        const args = payload.args ?? ["--soft", "HEAD~1"];
        const { stdout } = await git(cwd, ["reset", ...args]);
        return { success: true, action, stdout };
      }
      default: {
        return {
          success: false,
          action,
          error: `Unknown git action: ${action}`,
        };
      }
    }
  } catch (err: unknown) {
    return {
      success: false,
      action,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
