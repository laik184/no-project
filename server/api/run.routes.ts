import { Router, type Request, type Response } from "express";
import { chatOrchestrator } from "../chat/index.ts";
import { db } from "../infrastructure/db/index.ts";
import { agentRuns } from "../../shared/schema.ts";
import { and, eq, desc } from "drizzle-orm";

export function createRunRouter(): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    try {
      const { projectId, goal, mode, context, systemPrompt } = req.body;
      if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required" });
      if (!goal) return res.status(400).json({ ok: false, error: "goal is required" });

      const handle = await chatOrchestrator.run.runGoal({
        projectId: Number(projectId),
        goal: String(goal),
        mode: mode || "agent",
        context: context || {},
        systemPrompt,
      });

      res.status(202).json({ ok: true, runId: handle.runId, status: handle.status });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get("/:runId", (req: Request, res: Response) => {
    const handle = chatOrchestrator.run.get(req.params.runId);
    if (!handle) return res.status(404).json({ ok: false, error: "Run not found" });
    res.json({ ok: true, run: handle });
  });

  router.post("/:runId/cancel", (req: Request, res: Response) => {
    const cancelled = chatOrchestrator.run.cancel(req.params.runId);
    if (!cancelled) return res.status(404).json({ ok: false, error: "Run not found or already done" });
    res.json({ ok: true, cancelled: true, runId: req.params.runId });
  });

  router.get("/", (_req: Request, res: Response) => {
    const allRuns = [...chatOrchestrator.runRegistry.values()];
    res.json({ ok: true, runs: allRuns });
  });

  // ── GET /api/run/active?projectId=N ─────────────────────────────────────────
  // Returns the currently-running run for a project, or { run: null }.
  // Checks in-memory registry first (fastest), then falls back to DB
  // (handles cases where the server restarted mid-run).
  router.get("/active", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : null;
      if (!projectId) return res.status(400).json({ ok: false, error: "projectId required" });

      // In-memory: run is definitely live if it's here
      const inMemory = [...chatOrchestrator.runRegistry.values()]
        .find((h) => h.projectId === projectId && h.status === "running");
      if (inMemory) {
        return res.json({ ok: true, run: { runId: inMemory.runId, projectId, status: "running", startedAt: inMemory.startedAt } });
      }

      // DB fallback: a run marked "running" that started within the last 30 min
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);
      const [dbRun] = await db
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.projectId, projectId), eq(agentRuns.status, "running")))
        .orderBy(desc(agentRuns.startedAt))
        .limit(1);

      if (dbRun && dbRun.startedAt && dbRun.startedAt > cutoff) {
        return res.json({ ok: true, run: { runId: dbRun.id, projectId, status: "running", startedAt: dbRun.startedAt } });
      }

      return res.json({ ok: true, run: null });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
