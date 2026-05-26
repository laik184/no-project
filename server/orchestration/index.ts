import { Router, type Request, type Response } from 'express';
import { orchestrator } from './core/orchestrator.ts';
import { initDagExecutors } from '../engine/execution/index.ts';
import { distributedOrchestrationWiring } from '../distributed/orchestration/distributed-orchestration-wiring.ts';
import { runLogger } from './telemetry/run-logger.ts';
import { validateStartRun } from './utils/validators.ts';
import { metricsCollector } from './telemetry/metrics.ts';
import { performanceMonitor } from './telemetry/performance-monitor.ts';

let initialized = false;

export function initOrchestration(): void {
  if (initialized) return;
  initialized = true;

  try {
    orchestrator.init();
  } catch (err) {
    console.warn('[orchestration] orchestrator.init failed:', err instanceof Error ? err.message : err);
  }

  try {
    initDagExecutors();
  } catch (err) {
    console.warn('[orchestration] initDagExecutors failed:', err instanceof Error ? err.message : err);
  }

  try {
    distributedOrchestrationWiring.wire().then((report) => {
      console.log(`[orchestration] Distributed wiring complete — ${report.wired.length} systems wired, backend=${report.backend}`);
    }).catch((err) => {
      console.warn('[orchestration] Distributed wiring warning:', err instanceof Error ? err.message : err);
    });
  } catch (err) {
    console.warn('[orchestration] distributedOrchestrationWiring.wire failed:', err instanceof Error ? err.message : err);
  }

  performanceMonitor.start({ intervalMs: 30_000, memoryThresholdMb: 768 });

  console.log('[orchestration] Orchestration layer initialized');
}

export function createOrchestrationRouter(): Router {
  const router = Router();

  router.post('/runs', async (req: Request, res: Response) => {
    try {
      const input = validateStartRun(req.body);
      const result = await orchestrator.startRun(input);
      res.status(result.success ? 200 : 500).json({ ok: result.success, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ ok: false, error: msg });
    }
  });

  router.get('/runs/:runId', (req: Request, res: Response) => {
    const { runId } = req.params;
    const status = orchestrator.getRunStatus(runId);
    if (!status.lifecycle && !status.state) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }
    res.json({ ok: true, runId, ...status });
  });

  router.get('/runs/:runId/logs', (req: Request, res: Response) => {
    const { runId } = req.params;
    const level = req.query.level as string | undefined;
    const count = Number(req.query.count) || 100;
    const logs = level
      ? runLogger.getLogs(runId, level as any)
      : runLogger.getRecentLogs(runId, count);
    res.json({ ok: true, runId, count: logs.length, logs });
  });

  router.get('/runs/:runId/metrics', (req: Request, res: Response) => {
    const { runId } = req.params;
    const snapshot = metricsCollector.getSnapshot(runId);
    res.json({ ok: true, runId, ...snapshot });
  });

  router.get('/active', (_req: Request, res: Response) => {
    const activeRuns = orchestrator.getActiveRuns();
    res.json({ ok: true, count: activeRuns.length, runs: activeRuns });
  });

  router.get('/health', (_req: Request, res: Response) => {
    const perf = performanceMonitor.summarize();
    res.json({ ok: true, ...perf });
  });

  return router;
}
