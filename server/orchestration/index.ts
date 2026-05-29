/**
 * server/orchestration/index.ts
 *
 * Public surface of the orchestration layer.
 * Exports the primary orchestrate() entry point, router, and diagnostics.
 * All internal details stay encapsulated within the orchestration/ subtree.
 */

import { Router, type Request, type Response } from 'express';
import {
  orchestrate,
  initOrchestrator,
  shutdownOrchestrator,
  getOrchestratorDiagnostics,
  cleanupOrchestrationRun,
} from './orchestrator.ts';
import { allSnapshots, getStuckOrchestrations, activeCount } from './monitoring/orchestration-monitor.ts';
import { globalSummary }    from './telemetry/orchestration-metrics.ts';
import { newOrchestrationId } from './utils/orchestration-utils.ts';

export type { OrchestrationRequest, OrchestrationResult } from './types/orchestration.types.ts';
export { orchestrate, initOrchestrator, shutdownOrchestrator };
export { runManager } from './core/run-manager.ts';
export type { RunRecord } from './core/run-manager.ts';

// ── Initialization ────────────────────────────────────────────────────────────

export function initOrchestration(): void {
  initOrchestrator();
  console.log('[orchestration] Orchestration layer initialized');
}

// ── Express router ────────────────────────────────────────────────────────────

export function createOrchestrationRouter(): Router {
  const router = Router();

  // POST /api/orchestration/run — submit an orchestration request
  router.post('/run', async (req: Request, res: Response) => {
    const {
      runId, projectId, sandboxRoot, goal, context, options,
    } = req.body as {
      runId?:       string;
      projectId?:   string;
      sandboxRoot?: string;
      goal?:        string;
      context?:     Record<string, unknown>;
      options?:     Record<string, unknown>;
    };

    if (!runId || !projectId || !sandboxRoot || !goal) {
      return res.status(400).json({
        ok:    false,
        error: 'Missing required fields: runId, projectId, sandboxRoot, goal',
      });
    }

    const result = await orchestrate({
      orchestrationId: newOrchestrationId(),
      runId,
      projectId,
      sandboxRoot,
      goal,
      context,
      options: options as never,
    });

    return res.status(result.ok ? 200 : 500).json(result);
  });

  // GET /api/orchestration/active — all active orchestration snapshots
  router.get('/active', (_req: Request, res: Response) => {
    res.json({ ok: true, snapshots: allSnapshots(), count: activeCount() });
  });

  // GET /api/orchestration/stuck — detect stuck orchestration loops
  router.get('/stuck', (_req: Request, res: Response) => {
    const stuck = getStuckOrchestrations();
    res.json({ ok: true, stuck, count: stuck.length });
  });

  // GET /api/orchestration/metrics — global metrics summary
  router.get('/metrics', (_req: Request, res: Response) => {
    res.json({ ok: true, metrics: globalSummary() });
  });

  // GET /api/orchestration/diagnostics/:runId — per-run diagnostics
  router.get('/diagnostics/:runId', (req: Request, res: Response) => {
    const { runId } = req.params;
    res.json({ ok: true, runId, diagnostics: getOrchestratorDiagnostics(runId) });
  });

  // DELETE /api/orchestration/cleanup/:runId — evict run metrics
  router.delete('/cleanup/:runId', (req: Request, res: Response) => {
    const { runId } = req.params;
    cleanupOrchestrationRun(runId);
    res.json({ ok: true, runId, message: 'Run metrics evicted' });
  });

  return router;
}
