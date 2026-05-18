import { Router, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import { getProjectDir, resolveSafe, ensureProjectDir } from "../infrastructure/sandbox/sandbox.util.ts";
import { emitFileChange } from "../infrastructure/events/file-change-emitter.ts";

export function createFsRouter(): Router {
  const router = Router();

  router.get("/tree/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectDir = getProjectDir(projectId);
      await ensureProjectDir(projectId);
      const subPath = (req.query.path as string) || ".";
      const maxDepth = Number(req.query.depth) || 4;

      async function buildTree(dir: string, depth = 0): Promise<unknown> {
        if (depth >= maxDepth) return [];
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        return entries
          .filter((e) => !["node_modules", ".git", "dist", ".cache"].includes(e.name))
          .map((e) => ({
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
            path: path.relative(projectDir, path.join(dir, e.name)),
          }));
      }

      const targetDir = resolveSafe(projectDir, subPath);
      const tree = await buildTree(targetDir);
      res.json({ ok: true, projectId, path: subPath, tree });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get("/file/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectDir = getProjectDir(projectId);
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ ok: false, error: "path query param required" });
      const abs = resolveSafe(projectDir, filePath);
      const content = await fs.readFile(abs, "utf-8");
      res.json({ ok: true, path: filePath, content });
    } catch (e: any) {
      res.status(e.code === "ENOENT" ? 404 : 500).json({ ok: false, error: e.message });
    }
  });

  router.post("/file/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectDir = getProjectDir(projectId);
      const { path: filePath, content } = req.body;
      if (!filePath) return res.status(400).json({ ok: false, error: "path is required" });
      const abs = resolveSafe(projectDir, filePath);
      const existed = await fs.stat(abs).catch(() => null);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content || "", "utf-8");
      emitFileChange(projectId, existed ? "change" : "add", filePath);
      res.json({ ok: true, path: filePath, written: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.delete("/file/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const projectDir = getProjectDir(projectId);
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ ok: false, error: "path query param required" });
      const abs = resolveSafe(projectDir, filePath);
      await fs.rm(abs, { recursive: true, force: true });
      emitFileChange(projectId, "unlink", filePath);
      res.json({ ok: true, path: filePath, deleted: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
