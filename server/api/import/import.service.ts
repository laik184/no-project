/**
 * import.service.ts
 * In-memory import job registry with SSE fan-out.
 * Max 250 lines.
 */

import { randomUUID } from "crypto";
import type { Response } from "express";
import type { FileNode, ImportJob, ImportStatus } from "./import.types.ts";

const jobs = new Map<string, ImportJob>();
const subscribers = new Map<string, Set<Response>>();

export function createJob(stepLabels: string[]): ImportJob {
  const id = randomUUID();
  const job: ImportJob = {
    id,
    projectId: null,
    status: "pending",
    steps: stepLabels.map((label, i) => ({ label, done: false, active: i === 0 })),
    percent: 0,
  };
  jobs.set(id, job);
  subscribers.set(id, new Set());
  return job;
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
}

export function advance(id: string, stepIndex: number): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "running";
  job.steps = job.steps.map((s, i) => ({
    ...s,
    done: i < stepIndex,
    active: i === stepIndex,
  }));
  job.percent = Math.min(Math.round((stepIndex / job.steps.length) * 95), 95);
  publish(id);
}

export function complete(id: string, projectId: number, tree?: FileNode[]): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "done";
  job.projectId = projectId;
  job.percent = 100;
  job.steps = job.steps.map((s) => ({ ...s, done: true, active: false }));
  if (tree) job.tree = tree;
  publish(id);
  setTimeout(() => {
    jobs.delete(id);
    subscribers.delete(id);
  }, 300_000);
}

export function fail(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "error";
  job.error = error;
  job.steps = job.steps.map((s) => ({ ...s, active: false }));
  publish(id);
}

export function subscribe(id: string, res: Response): void {
  const subs = subscribers.get(id);
  if (!subs) {
    res.write(`data: ${JSON.stringify({ status: "error", error: "Import job not found" })}\n\n`);
    res.end();
    return;
  }
  subs.add(res);
  res.on("close", () => subs.delete(res));
  const job = jobs.get(id);
  if (job) res.write(`data: ${JSON.stringify(job)}\n\n`);
}

function publish(id: string): void {
  const job = jobs.get(id);
  const subs = subscribers.get(id);
  if (!job || !subs) return;
  const data = `data: ${JSON.stringify(job)}\n\n`;
  for (const res of subs) {
    try {
      res.write(data);
    } catch {
      subs.delete(res);
    }
  }
}

export function buildFileTree(basePath: string, entries: string[]): FileNode[] {
  const root: FileNode = { name: basePath, type: "dir", children: [] };
  for (const entry of entries) {
    const parts = entry.split("/").filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        current.children = current.children ?? [];
        current.children.push({ name: part, type: "file" });
      } else {
        current.children = current.children ?? [];
        let dir = current.children.find((c) => c.name === part && c.type === "dir");
        if (!dir) {
          dir = { name: part, type: "dir", children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }
  return root.children ?? [];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
