/**
 * zip.handler.ts
 * Handles ZIP file upload + real extraction into sandbox.
 * Client sends raw binary body with Content-Type: application/zip.
 */

import AdmZip from "adm-zip";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/index.ts";
import { projects } from "../../../shared/schema.ts";
import { ensureProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import * as svc from "./import.service.ts";
import type { FileNode } from "./import.types.ts";

const ZIP_STEPS = [
  "Reading archive…",
  "Extracting files…",
  "Writing to sandbox…",
  "Building file tree…",
  "Finalizing workspace…",
];

export interface ZipImportResult {
  importId: string;
  projectId: number;
  tree: FileNode[];
}

export async function startZipImport(
  buffer: Buffer,
  filename: string
): Promise<ZipImportResult> {
  if (!buffer || buffer.length === 0) throw new Error("Empty file buffer");

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new Error("Invalid ZIP file");
  }

  const projectName = filename.replace(/\.zip$/i, "") || "zip-import";

  const [project] = await db
    .insert(projects)
    .values({ name: projectName, description: `Imported from ZIP: ${filename}`, status: "importing" })
    .returning();

  const projectId = project.id;
  const dir = await ensureProjectDir(projectId);

  const job = svc.createJob(ZIP_STEPS);

  const tree = await extractAndTrack(job.id, projectId, zip, dir, filename);

  return { importId: job.id, projectId, tree };
}

async function extractAndTrack(
  jobId: string,
  projectId: number,
  zip: AdmZip,
  dir: string,
  filename: string
): Promise<FileNode[]> {
  svc.advance(jobId, 0);
  await svc.sleep(100);

  svc.advance(jobId, 1);

  let tree: FileNode[] = [];

  try {
    const entries = zip.getEntries();
    const strippedEntries = stripTopLevel(entries.map((e) => e.entryName));

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const stripped = stripTopLevelEntry(entry.entryName);
      if (!stripped) continue;

      const destPath = path.join(dir, stripped);
      const destDir = path.dirname(destPath);

      const { mkdir, writeFile } = await import("fs/promises");
      await mkdir(destDir, { recursive: true });
      await writeFile(destPath, entry.getData());
    }

    svc.advance(jobId, 2);
    await svc.sleep(100);

    svc.advance(jobId, 3);
    await svc.sleep(100);

    tree = svc.buildFileTree(
      filename.replace(/\.zip$/i, ""),
      strippedEntries.filter((e) => !e.endsWith("/"))
    );

    svc.advance(jobId, 4);
    await svc.sleep(200);

    await db.update(projects).set({ status: "idle", updatedAt: new Date() }).where(eq(projects.id, projectId));

    svc.complete(jobId, projectId, tree);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(projects).set({ status: "error", updatedAt: new Date() }).where(eq(projects.id, projectId));
    svc.fail(jobId, msg);
  }

  return tree;
}

function stripTopLevel(entries: string[]): string[] {
  const topDirs = new Set<string>();
  for (const e of entries) {
    const first = e.split("/")[0];
    if (first) topDirs.add(first);
  }
  if (topDirs.size !== 1) return entries;
  const prefix = [...topDirs][0] + "/";
  return entries.map((e) => (e.startsWith(prefix) ? e.slice(prefix.length) : e)).filter(Boolean);
}

function stripTopLevelEntry(entry: string): string {
  const parts = entry.split("/");
  if (parts.length > 1) return parts.slice(1).join("/");
  return entry;
}
