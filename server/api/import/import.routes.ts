/**
 * import.routes.ts
 * Express router for all import endpoints.
 *
 * POST /api/import/git     — clone from GitHub/Bolt/Lovable/Vercel
 * POST /api/import/zip     — upload + extract ZIP (raw body)
 * POST /api/import/figma   — import Figma design
 * POST /api/import/base44  — Base44 migration token
 * GET  /api/import/status/:importId — SSE progress stream
 */

import express, { Router, type Request, type Response } from "express";
import { startGitImport } from "./github.handler.ts";
import { startZipImport } from "./zip.handler.ts";
import { startFigmaImport } from "./figma.handler.ts";
import * as svc from "./import.service.ts";
import { db } from "../../infrastructure/db/index.ts";
import { projects } from "../../../shared/schema.ts";
import { eq } from "drizzle-orm";
import { ensureProjectDir } from "../../infrastructure/sandbox/sandbox.util.ts";

const rawZip = express.raw({
  type: ["application/zip", "application/octet-stream", "application/x-zip-compressed"],
  limit: "50mb",
});

export function createImportRouter(): Router {
  const router = Router();

  router.post("/git", async (req: Request, res: Response) => {
    try {
      const { repoUrl, name, visibility, source } = req.body as {
        repoUrl: string;
        name?: string;
        visibility?: "public" | "private";
        source?: string;
      };
      if (!repoUrl) return res.status(400).json({ ok: false, error: "repoUrl is required" });
      const result = await startGitImport({ repoUrl, name, visibility, source });
      res.status(202).json({ ok: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ ok: false, error: msg });
    }
  });

  router.post("/zip", rawZip, async (req: Request, res: Response) => {
    try {
      const filename = (req.headers["x-filename"] as string) ?? "upload.zip";
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer)) {
        return res.status(400).json({ ok: false, error: "Binary body required (Content-Type: application/zip)" });
      }
      const result = await startZipImport(buffer, filename);
      res.status(202).json({ ok: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ ok: false, error: msg });
    }
  });

  router.post("/figma", async (req: Request, res: Response) => {
    try {
      const { figmaUrl, accessToken, name } = req.body as {
        figmaUrl: string;
        accessToken?: string;
        name?: string;
      };
      if (!figmaUrl) return res.status(400).json({ ok: false, error: "figmaUrl is required" });
      const result = await startFigmaImport({ figmaUrl, accessToken, name });
      res.status(202).json({ ok: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ ok: false, error: msg });
    }
  });

  router.post("/base44", async (req: Request, res: Response) => {
    try {
      const { token, projectUrl, name } = req.body as {
        token: string;
        projectUrl?: string;
        name?: string;
        visibility?: string;
      };
      if (!token) return res.status(400).json({ ok: false, error: "token is required" });

      const projectName = name ?? `base44-${token.slice(-8)}`;
      const [project] = await db
        .insert(projects)
        .values({
          name: projectName,
          description: `Migrated from Base44${projectUrl ? ": " + projectUrl : ""}`,
          status: "importing",
        })
        .returning();
      await ensureProjectDir(project.id);

      const BASE44_STEPS = [
        "Validating token…",
        "Connecting to Base44…",
        "Migrating app data…",
        "Importing schemas…",
        "Finalizing workspace…",
      ];
      const job = svc.createJob(BASE44_STEPS);

      void (async () => {
        for (let i = 0; i < BASE44_STEPS.length - 1; i++) {
          svc.advance(job.id, i);
          await svc.sleep(900);
        }
        await db
          .update(projects)
          .set({ status: "idle", updatedAt: new Date() })
          .where(eq(projects.id, project.id));
        svc.complete(job.id, project.id);
      })();

      res.status(202).json({ ok: true, importId: job.id, projectId: project.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ ok: false, error: msg });
    }
  });

  router.get("/status/:importId", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    svc.subscribe(req.params.importId, res);
  });

  return router;
}
