/**
 * memory-store-core.ts
 *
 * Core memory I/O: ensureMemoryDir + context.md + architecture.md.
 * Extracted from memory-store.ts (keep each file ≤250 lines).
 *
 * Single responsibility: directory init + text context storage only.
 */

import fs from "fs/promises";
import {
  getMemoryDir,
  getContextPath,
  getArchitecturePath,
} from "./memory-paths.ts";
import { memoryWriteQueue } from "../../../quantum/memory/index.ts";

const OWNER = "memory-store";

export async function ensureMemoryDir(projectId: number): Promise<void> {
  await fs.mkdir(getMemoryDir(projectId), { recursive: true });
}

// ── context.md ────────────────────────────────────────────────────────────────

export async function readContextMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getContextPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function writeContextMd(projectId: number, content: string): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getContextPath(projectId),
    content,
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
  });
}

// ── architecture.md ───────────────────────────────────────────────────────────

export async function readArchitectureMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getArchitecturePath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function writeArchitectureMd(projectId: number, content: string): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getArchitecturePath(projectId),
    content,
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
  });
}
