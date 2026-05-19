import type { Request, Response } from 'express';
import { runtimeService } from './runtime.service.ts';
import { runtimeManager } from '../../infrastructure/runtime/runtime-manager.ts';
import { getLifecycleManager } from '../../preview/lifecycle/preview-lifecycle.manager.ts';
import type { RunProjectInput, StopProjectInput, RestartProjectInput } from './runtime.types.ts';

export class RuntimeController {
  async runProject(req: Request, res: Response): Promise<void> {
    const { id, projectPath, command, port, env } = req.body as RunProjectInput;

    if (!id || !projectPath) {
      res.status(400).json({ ok: false, error: 'Fields required: id, projectPath' });
      return;
    }

    const result = await runtimeService.run({ id, projectPath, command, port, env });
    const status = result.ok ? 200 : 409;
    res.status(status).json(result);
  }

  async stopProject(req: Request, res: Response): Promise<void> {
    const { id, signal, timeoutMs } = req.body as StopProjectInput;

    if (!id) {
      res.status(400).json({ ok: false, error: 'Field required: id' });
      return;
    }

    const result = await runtimeService.stop({ id, signal, timeoutMs });
    const status = result.ok ? 200 : 404;
    res.status(status).json(result);
  }

  /**
   * POST /api/restart
   *
   * Two modes:
   *  a) Body has { id, projectPath } → restart that specific project (legacy).
   *  b) Body is empty / missing id  → restart ALL currently-running processes
   *     using runtimeManager and emit preview.lifecycle SSE events.
   */
  async restartProject(req: Request, res: Response): Promise<void> {
    const { id, projectPath, command, port, reloadType } = req.body as Partial<RestartProjectInput>;

    // ── Mode A: specific project (legacy callers) ──────────────────────────
    if (id && projectPath) {
      const result = await runtimeService.restart({ id, projectPath, command, port, reloadType });
      const status = result.ok ? 200 : 500;
      res.status(status).json(result);
      return;
    }

    // ── Mode B: restart all running servers (preview page "Run Project" button)
    try {
      const all = runtimeManager.all().filter(e => e.status === 'running' || e.status === 'starting');

      if (all.length === 0) {
        res.json({ ok: true, restarted: [], message: 'No running servers to restart.' });
        return;
      }

      const results: Array<{ projectId: number; ok: boolean; port?: number; error?: string }> = [];

      for (const entry of all) {
        const mgr = getLifecycleManager(entry.projectId);
        mgr.forceTransition('restarting', 'Restarting server…');

        const result = await runtimeManager.restart(entry.projectId);

        if (result.ok) {
          mgr.forceTransition('ready', 'Restart complete.', { port: result.port });
          results.push({ projectId: entry.projectId, ok: true, port: result.port });
        } else {
          mgr.forceTransition('crashed', result.error ?? 'Restart failed.', { error: result.error });
          results.push({ projectId: entry.projectId, ok: false, error: result.error });
        }
      }

      res.json({ ok: true, restarted: results });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }

  getStatus(_req: Request, res: Response): void {
    const result = runtimeService.getStatus();
    res.status(200).json(result);
  }

  getProcess(req: Request, res: Response): void {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ ok: false, error: 'Param required: id' });
      return;
    }

    const proc = runtimeService.getProcess(id);
    if (!proc) {
      res.status(404).json({ ok: false, error: `No process found for id: ${id}` });
      return;
    }

    res.status(200).json({ ok: true, process: proc });
  }

  healthCheck(_req: Request, res: Response): void {
    const { running, total } = runtimeService.getStatus();
    res.status(200).json({
      ok: true,
      module: 'runtime',
      runningCount: running.filter(p => p.status === 'running').length,
      total,
    });
  }
}

export const runtimeController = new RuntimeController();
