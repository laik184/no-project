/**
 * github.handler.ts
 * Real git clone import handler.
 * Used for GitHub, Bolt, Lovable, and Vercel imports (all GitHub-based).
 */

import { spawn } from "child_process";
import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/index.ts";
import { projects } from "../../../shared/schema.ts";
import { ensureProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import * as svc from "./import.service.ts";
import type { GitImportBody } from "./import.types.ts";

const GIT_STEPS = [
  "Connecting to repository…",
  "Resolving remote refs…",
  "Cloning files…",
  "Writing to sandbox…",
  "Finalizing workspace…",
];

export interface GitImportResult {
  importId: string;
  projectId: number;
}

export async function startGitImport(body: GitImportBody): Promise<GitImportResult> {
  const { repoUrl, name, visibility = "private", source } = body;

  if (!isValidHttpUrl(repoUrl)) {
    throw new Error("Invalid repository URL. Must be a valid http/https URL.");
  }

  const projectName = name ?? deriveNameFromUrl(repoUrl);

  const [project] = await db
    .insert(projects)
    .values({ name: projectName, description: `Imported from ${source ?? "GitHub"}: ${repoUrl}`, status: "importing" })
    .returning();

  const projectId = project.id;
  const dir = await ensureProjectDir(projectId);

  const job = svc.createJob(GIT_STEPS);

  void runCloneAsync(job.id, projectId, repoUrl, dir);

  return { importId: job.id, projectId };
}

async function runCloneAsync(jobId: string, projectId: number, repoUrl: string, dir: string): Promise<void> {
  try {
    svc.advance(jobId, 0);
    await svc.sleep(200);

    svc.advance(jobId, 1);
    await svc.sleep(200);

    await gitClone(jobId, repoUrl, dir);

    svc.advance(jobId, 3);
    await svc.sleep(300);

    svc.advance(jobId, 4);
    await svc.sleep(200);

    await db.update(projects).set({ status: "idle", updatedAt: new Date() }).where(eq(projects.id, projectId));

    svc.complete(jobId, projectId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(projects).set({ status: "error", updatedAt: new Date() }).where(eq(projects.id, projectId));
    svc.fail(jobId, msg);
  }
}

function gitClone(jobId: string, repoUrl: string, dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", ["clone", "--depth=1", "--progress", repoUrl, "."], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let didCloning = false;

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!didCloning && (text.includes("Receiving objects") || text.includes("Counting objects"))) {
        didCloning = true;
        svc.advance(jobId, 2);
      }
    });

    let stderr = "";
    proc.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone failed (exit ${code}): ${stderr.slice(-500)}`));
    });

    proc.on("error", reject);
  });
}

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveNameFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "imported-project";
    return last.replace(/\.git$/, "");
  } catch {
    return "imported-project";
  }
}
