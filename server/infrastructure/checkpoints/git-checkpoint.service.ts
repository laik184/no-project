/**
 * git-checkpoint.service.ts
 * Git-based checkpoint engine.
 * Creates safety commits and supports git-level rollback (reset --hard).
 */

import { spawn }       from "child_process";
import fs              from "fs/promises";
import path            from "path";
import {
  GIT_AUTHOR_NAME,
  GIT_AUTHOR_EMAIL,
  GIT_COMMIT_PREFIX,
} from "./checkpoint.constants.ts";

// ─── Low-level git runner ─────────────────────────────────────────────────────

export interface GitResult {
  ok:       boolean;
  stdout:   string;
  stderr:   string;
  exitCode: number;
}

export function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    let stdout = "", stderr = "";
    const proc = spawn("git", args, {
      cwd,
      shell: false,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({
      ok: code === 0,
      stdout: stdout.slice(0, 8000),
      stderr: stderr.slice(0, 2000),
      exitCode: code ?? 1,
    }));
    proc.on("error", (e) => resolve({ ok: false, stdout: "", stderr: e.message, exitCode: 1 }));
  });
}

// ─── Repo bootstrap ───────────────────────────────────────────────────────────

export async function ensureGitRepo(cwd: string): Promise<void> {
  try {
    await fs.stat(path.join(cwd, ".git"));
  } catch {
    await runGit(["init"], cwd);
    await runGit([
      "-c", `user.name=${GIT_AUTHOR_NAME}`,
      "-c", `user.email=${GIT_AUTHOR_EMAIL}`,
      "commit", "--allow-empty", "-m", `${GIT_COMMIT_PREFIX} init`,
    ], cwd);
  }
}

// ─── Checkpoint commit ────────────────────────────────────────────────────────

/**
 * Stage all changes and create a checkpoint commit.
 * Returns the new commit SHA, or null on failure.
 */
export async function createCheckpointCommit(
  sandboxRoot:  string,
  checkpointId: string,
  label?:       string,
): Promise<string | null> {
  try {
    await ensureGitRepo(sandboxRoot);

    const hasChanges = await repoHasChanges(sandboxRoot);
    if (!hasChanges) {
      // Return HEAD sha even if nothing changed — still a valid anchor
      return getHeadSha(sandboxRoot);
    }

    await runGit(["add", "-A"], sandboxRoot);
    const msg  = `${GIT_COMMIT_PREFIX} ${checkpointId}${label ? ` — ${label}` : ""}`;
    const args = [
      "-c", `user.name=${GIT_AUTHOR_NAME}`,
      "-c", `user.email=${GIT_AUTHOR_EMAIL}`,
      "commit", "-m", msg,
    ];
    const result = await runGit(args, sandboxRoot);
    if (!result.ok) return null;
    return getHeadSha(sandboxRoot);
  } catch {
    return null;
  }
}

// ─── Rollback via git reset ───────────────────────────────────────────────────

/**
 * Hard-reset the sandbox to a specific commit SHA.
 * Restores all tracked files to that commit state.
 */
export async function gitResetToSha(sandboxRoot: string, sha: string): Promise<boolean> {
  const result = await runGit(["reset", "--hard", sha], sandboxRoot);
  return result.ok;
}

/**
 * Restore a single file from a specific commit SHA.
 */
export async function gitRestoreFile(
  sandboxRoot:  string,
  sha:          string,
  relativePath: string,
): Promise<boolean> {
  const result = await runGit(["checkout", sha, "--", relativePath], sandboxRoot);
  return result.ok;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getHeadSha(sandboxRoot: string): Promise<string | null> {
  const r = await runGit(["rev-parse", "HEAD"], sandboxRoot);
  return r.ok ? r.stdout.trim() : null;
}

async function repoHasChanges(sandboxRoot: string): Promise<boolean> {
  const r = await runGit(["status", "--porcelain"], sandboxRoot);
  return r.ok && r.stdout.trim().length > 0;
}

/** List recent checkpoint commits (those with our prefix) */
export async function listCheckpointCommits(
  sandboxRoot: string,
  limit = 20,
): Promise<Array<{ sha: string; message: string; ts: string }>> {
  const r = await runGit([
    "log", `--grep=${GIT_COMMIT_PREFIX}`,
    `--max-count=${limit}`,
    "--format=%H|%s|%ai",
  ], sandboxRoot);
  if (!r.ok || !r.stdout.trim()) return [];
  return r.stdout.trim().split("\n").map((line) => {
    const [sha, message, ts] = line.split("|");
    return { sha, message, ts };
  });
}
