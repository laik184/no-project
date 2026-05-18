/**
 * recovery.routes.ts
 *
 * GET /api/recovery/snapshot?projectId=N&runId=R
 *
 * Returns a lightweight recovery snapshot for the frontend to rehydrate
 * after a page refresh or reconnect:
 *   - The run record (status, startedAt)
 *   - The last 50 persisted agent events for the run (oldest → newest)
 *   - The last 100 console log lines for the project
 *
 * Used by client/src/realtime/useRunRecovery.ts on mount when an active
 * run is detected.
 */

import { Router, type Request, type Response } from "express";
import { db } from "../infrastructure/db/index.ts";
import { agentRuns, agentEvents, consoleLogs } from "../../shared/schema.ts";
import { and, eq, desc } from "drizzle-orm";

export function createRecoveryRouter(): Router {
  const router = Router();

  router.get("/snapshot", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? Number(req.query.projectId) : null;
      const runId     = req.query.runId as string | undefined;

      if (!projectId || !runId) {
        return res.status(400).json({ ok: false, error: "projectId and runId are required" });
      }

      const [[run], rawEvents, rawLogs] = await Promise.all([
        db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1),

        db.select()
          .from(agentEvents)
          .where(eq(agentEvents.runId, runId))
          .orderBy(desc(agentEvents.ts))
          .limit(50),

        db.select()
          .from(consoleLogs)
          .where(and(
            eq(consoleLogs.projectId, projectId),
          ))
          .orderBy(desc(consoleLogs.ts))
          .limit(100),
      ]);

      if (!run) {
        return res.status(404).json({ ok: false, error: "Run not found" });
      }

      return res.json({
        ok:           true,
        run:          { runId: run.id, projectId: run.projectId, status: run.status, startedAt: run.startedAt },
        recentEvents: rawEvents.reverse(),
        recentLogs:   rawLogs.reverse().map((l) => l.line),
      });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
