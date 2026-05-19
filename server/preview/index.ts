/**
 * IQ2000 — Preview Pipeline Controller
 *
 * Single entry point for all preview module routes.
 * Mounts all sub-routers under /api, boots the orchestrator,
 * and exposes the aggregate health endpoint at /api/preview/health.
 *
 * Usage in main.ts:
 *   import previewPipeline from './preview/index.ts';
 *   app.use('/api', previewPipeline);
 */

import { Router, type Application } from 'express';
import { previewOrchestrator } from './preview.orchestrator.ts';
import runtimeRouter from './runtime/runtime.router.ts';
import filesRouter from './files/files.router.ts';
import tunnelRouter from './tunnel/tunnel.router.ts';
import devtoolsRouter from './devtools/devtools.router.ts';
import stateRouter from './state/state.router.ts';
import metricsRouter from './metrics/metrics.router.ts';

// ─── Pipeline Stage Registry ──────────────────────────────────────────────────

interface PipelineStage {
  name: string;
  router: Router;
  mountPath: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { name: 'runtime', router: runtimeRouter, mountPath: '/' },
  { name: 'files',   router: filesRouter,   mountPath: '/' },
  { name: 'tunnel',  router: tunnelRouter,  mountPath: '/' },
  { name: 'devtools',router: devtoolsRouter,mountPath: '/' },
  { name: 'state',   router: stateRouter,   mountPath: '/' },
  { name: 'metrics', router: metricsRouter, mountPath: '/' },
];

// ─── Pipeline Controller ───────────────────────────────────────────────────────

class PreviewPipelineController {
  private router: Router;
  private booted = false;

  constructor() {
    this.router = Router();
  }

  /**
   * Boot the pipeline:
   * 1. Initialize the orchestrator (cross-module wiring)
   * 2. Mount all stage routers
   * 3. Register health + meta endpoints
   */
  boot(): Router {
    if (this.booted) return this.router;

    previewOrchestrator.init();

    this.mountStages();
    this.registerHealthEndpoint();
    this.registerMetaEndpoint();

    this.booted = true;
    console.log('[IQ2000] Preview pipeline booted — stages:', PIPELINE_STAGES.map(s => s.name).join(', '));

    return this.router;
  }

  /**
   * Mount all pipeline stages in order.
   * Each stage router is self-contained (its own routes + controller + service).
   */
  private mountStages(): void {
    for (const stage of PIPELINE_STAGES) {
      this.router.use(stage.mountPath, stage.router);
      console.log(`[IQ2000] Stage mounted: [${stage.name}] at ${stage.mountPath}`);
    }
  }

  /**
   * Aggregate health — polls all modules via orchestrator.
   * GET /api/preview/health
   */
  private registerHealthEndpoint(): void {
    this.router.get('/preview/health', (_req, res) => {
      const health = previewOrchestrator.getHealth();
      const httpStatus = health.status === 'ready' ? 200 : 503;
      res.status(httpStatus).json(health);
    });
  }

  /**
   * Pipeline metadata — lists all stages and their routes for dev tooling.
   * GET /api/preview/meta
   */
  private registerMetaEndpoint(): void {
    this.router.get('/preview/meta', (_req, res) => {
      res.status(200).json({
        ok: true,
        pipeline: 'IQ2000 Preview Pipeline',
        version: '1.0.0',
        stages: PIPELINE_STAGES.map(s => s.name),
        endpoints: {
          runtime: [
            'POST /api/run-project',
            'POST /api/stop-project',
            'POST /api/restart',
            'GET  /api/project-status',
            'GET  /api/project-status/:id',
          ],
          files: [
            'GET    /api/files/list',
            'POST   /api/files/create',
            'POST   /api/files/upload',
            'GET    /api/files/download',
            'DELETE /api/files/*',
          ],
          tunnel: [
            'GET    /api/tunnel-info',
            'GET    /api/tunnel/ports',
            'POST   /api/tunnel/ports',
            'DELETE /api/tunnel/ports/:id',
            'GET    /api/tunnel/public-url',
          ],
          devtools: [
            'GET    /sse/console',
            'GET    /sse/preview',
            'GET    /__sse_reload',
            'POST   /api/devtools/log',
            'POST   /api/devtools/reload',
            'DELETE /api/devtools/logs',
            'GET    /api/devtools/snapshot',
          ],
          state: [
            'GET    /api/preview-state',
            'POST   /api/preview-state',
            'DELETE /api/preview-state',
            'PATCH  /api/preview-state/url',
            'PATCH  /api/preview-state/device',
            'PATCH  /api/preview-state/grid',
          ],
          health: [
            'GET /api/preview/health',
            'GET /api/preview/meta',
          ],
        },
      });
    });
  }

  getRouter(): Router {
    return this.router;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

const pipeline = new PreviewPipelineController();
const previewPipeline = pipeline.boot();

export default previewPipeline;
export { previewOrchestrator };
