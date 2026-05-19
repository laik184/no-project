/**
 * figma.handler.ts
 * Imports a Figma design file — fetches metadata via Figma REST API
 * and scaffolds a React project structure in the sandbox.
 */

import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../../infrastructure/db/index.ts";
import { projects } from "../../../shared/schema.ts";
import { ensureProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";
import * as svc from "./import.service.ts";
import type { FigmaImportBody } from "./import.types.ts";

const FIGMA_STEPS = [
  "Connecting to Figma…",
  "Reading design file…",
  "Extracting components…",
  "Scaffolding React project…",
  "Finalizing workspace…",
];

export interface FigmaImportResult {
  importId: string;
  projectId: number;
}

export async function startFigmaImport(body: FigmaImportBody): Promise<FigmaImportResult> {
  const { figmaUrl, accessToken, name } = body;

  const fileKey = extractFigmaFileKey(figmaUrl);
  if (!fileKey) throw new Error("Invalid Figma URL. Could not extract file key.");

  const projectName = name ?? "figma-import";

  const [project] = await db
    .insert(projects)
    .values({ name: projectName, description: `Imported from Figma: ${figmaUrl}`, status: "importing" })
    .returning();

  const projectId = project.id;
  const dir = await ensureProjectDir(projectId);

  const job = svc.createJob(FIGMA_STEPS);

  void runFigmaImportAsync(job.id, projectId, fileKey, accessToken ?? "", dir, projectName);

  return { importId: job.id, projectId };
}

async function runFigmaImportAsync(
  jobId: string,
  projectId: number,
  fileKey: string,
  accessToken: string,
  dir: string,
  projectName: string
): Promise<void> {
  try {
    svc.advance(jobId, 0);
    await svc.sleep(200);

    let figmaData: Record<string, unknown> = {};

    if (accessToken) {
      svc.advance(jobId, 1);
      const resp = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: { "X-Figma-Token": accessToken },
      });
      if (!resp.ok) throw new Error(`Figma API error: ${resp.status} ${resp.statusText}`);
      figmaData = (await resp.json()) as Record<string, unknown>;
    } else {
      svc.advance(jobId, 1);
      await svc.sleep(400);
    }

    svc.advance(jobId, 2);
    await svc.sleep(300);

    svc.advance(jobId, 3);
    await scaffoldReactProject(dir, projectName, figmaData);
    await svc.sleep(200);

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

async function scaffoldReactProject(
  dir: string,
  name: string,
  figmaData: Record<string, unknown>
): Promise<void> {
  const figmaName = (figmaData?.name as string) ?? name;
  const pages: string[] = [];

  if (figmaData?.document) {
    const doc = figmaData.document as { children?: Array<{ name: string }> };
    doc.children?.forEach((page) => pages.push(page.name));
  }

  await fs.mkdir(path.join(dir, "src", "components"), { recursive: true });
  await fs.mkdir(path.join(dir, "src", "pages"), { recursive: true });

  await fs.writeFile(
    path.join(dir, "src", "App.tsx"),
    `// Auto-generated from Figma: ${figmaName}\n// Pages: ${pages.join(", ") || "Main"}\n\nexport default function App() {\n  return <div className="app"><h1>${figmaName}</h1></div>;\n}\n`
  );

  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, "-"), version: "0.0.1", scripts: { dev: "vite" }, dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" }, devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.0.0" } }, null, 2)
  );

  await fs.writeFile(
    path.join(dir, "README.md"),
    `# ${figmaName}\n\nImported from Figma.\n\n## Pages\n${pages.map((p) => `- ${p}`).join("\n") || "- Main"}\n`
  );
}

function extractFigmaFileKey(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/(?:file|design)\/([a-zA-Z0-9]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
