import { Router, type Request, type Response } from "express";
import { chatOrchestrator } from "../chat/index.ts";

export function createSoloPilotRouter(): Router {
  const router = Router();

  router.post("/run", async (req: Request, res: Response) => {
    try {
      const { projectId, goal, mode } = req.body;
      if (!projectId || !goal) {
        return res.status(400).json({ ok: false, error: "projectId and goal are required" });
      }
      const handle = await chatOrchestrator.run.runGoal({
        projectId: Number(projectId),
        goal:      String(goal),
        mode:      mode || "agent",
      });
      res.status(202).json({ ok: true, runId: handle.runId, status: handle.status });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get("/status/:runId", (req: Request, res: Response) => {
    const handle = chatOrchestrator.run.get(req.params.runId);
    if (!handle) return res.status(404).json({ ok: false, error: "Run not found" });
    res.json({ ok: true, run: handle });
  });

  return router;
}
