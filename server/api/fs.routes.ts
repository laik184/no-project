import { Router, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getProjectDir, resolveSafe, ensureProjectDir } from "../infrastructure/sandbox/sandbox.util.ts";
import { emitFileChange }   from "../infrastructure/events/file-change-emitter.ts";
import { safeWriteFile, safeDeleteFile } from "../infrastructure/checkpoints/safe-fs.util.ts";
import { watcherRegistry }  from "../infrastructure/filesystem/watcher/watcher-registry.ts";

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? ".sandbox";

function sandboxHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function resolveSandboxPath(filePath: string): string {
  const abs = path.resolve(SANDBOX_ROOT, filePath);
  const root = path.resolve(SANDBOX_ROOT);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Path traversal detected");
  }
  return abs;
}

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

      // Start OS-level watcher for this project (no-op if already watching)
      watcherRegistry.watchProject(projectId, projectDir);

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

      // Atomic write with .bak backup for existing files — crash-safe
      const result = await safeWriteFile(abs, content || "");
      if (!result.ok) return res.status(500).json({ ok: false, error: result.error });

      emitFileChange(projectId, existed ? "change" : "add", filePath);
      res.json({ ok: true, path: filePath, written: true, backup: result.backupPath ?? undefined });
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

      // Safe delete — backs up the file before removal
      const result = await safeDeleteFile(abs, true);
      if (!result.ok) return res.status(500).json({ ok: false, error: result.error });

      emitFileChange(projectId, "unlink", filePath);
      res.json({ ok: true, path: filePath, deleted: true, backup: result.backupPath ?? undefined });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post("/conflict-check", async (req: Request, res: Response) => {
    try {
      const { path: filePath, hash } = req.body as { path?: string; hash?: string };
      if (!filePath || !hash) {
        return res.status(400).json({ ok: false, error: "path and hash are required" });
      }
      const abs = resolveSandboxPath(filePath);
      const content = await fs.readFile(abs, "utf-8").catch(() => null);
      if (content === null) {
        return res.json({ ok: true, conflict: false });
      }
      const serverHash = sandboxHash(content);
      res.json({ ok: true, conflict: serverHash !== hash, serverHash });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post("/conflict-details", async (req: Request, res: Response) => {
    try {
      const { path: filePath } = req.body as { path?: string };
      if (!filePath) {
        return res.status(400).json({ ok: false, error: "path is required" });
      }
      const abs = resolveSandboxPath(filePath);
      const serverContent = await fs.readFile(abs, "utf-8").catch(() => "");
      const serverHash = sandboxHash(serverContent);
      const serverVersionId = `${Date.now()}`;
      res.json({ ok: true, serverContent, serverHash, serverVersionId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
