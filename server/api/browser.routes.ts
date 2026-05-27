/**
 * server/api/browser.routes.ts
 *
 * GET /api/browser/sessions          — list all known browser sessions
 * GET /api/browser/screenshot        — serve a screenshot PNG by file path
 * GET /api/browser/screenshots/:runId — list screenshots for a run
 */

import fs                             from 'fs';
import path                           from 'path';
import { Router, type Request, type Response } from 'express';
import {
  listActiveSessions,
  getSessionCount,
}                                     from '../agents/browser/core/browser-state.ts';
import { getScreenshotDir }           from '../agents/browser/utils/screenshot-utils.ts';

export function createBrowserRouter(): Router {
  const router = Router();

  // ── GET /api/browser/sessions ─────────────────────────────────────────────
  router.get('/sessions', (_req: Request, res: Response) => {
    const active = listActiveSessions();
    res.json({
      ok:       true,
      count:    getSessionCount(),
      active:   active.length,
      sessions: active.map((s) => ({
        sessionId:  s.sessionId,
        runId:      s.runId,
        projectId:  s.projectId,
        status:     s.status,
        pagesOpen:  s.pagesOpen,
        launchedAt: s.launchedAt?.toISOString() ?? null,
        closedAt:   s.closedAt?.toISOString()   ?? null,
      })),
    });
  });

  // ── GET /api/browser/screenshot?path=<filepath> ───────────────────────────
  router.get('/screenshot', (req: Request, res: Response) => {
    const filePath = req.query['path'] as string | undefined;
    if (!filePath) {
      res.status(400).json({ ok: false, error: 'Missing ?path= query param' });
      return;
    }

    // Security: restrict to the screenshots directory only
    const screenshotDir = getScreenshotDir();
    const resolvedPath  = path.resolve(filePath);
    if (!resolvedPath.startsWith(screenshotDir)) {
      res.status(403).json({ ok: false, error: 'Access denied' });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ ok: false, error: 'Screenshot not found' });
      return;
    }

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    fs.createReadStream(resolvedPath).pipe(res);
  });

  // ── GET /api/browser/screenshots/:runId ───────────────────────────────────
  router.get('/screenshots/:runId', (req: Request, res: Response) => {
    const { runId } = req.params;
    if (!runId) {
      res.status(400).json({ ok: false, error: 'Missing runId' });
      return;
    }

    const screenshotDir = getScreenshotDir();
    if (!fs.existsSync(screenshotDir)) {
      res.json({ ok: true, screenshots: [] });
      return;
    }

    const files = fs.readdirSync(screenshotDir)
      .filter((f) => f.startsWith(runId) && f.endsWith('.png'))
      .sort()
      .map((f) => ({
        filename:  f,
        path:      path.join(screenshotDir, f),
        label:     f.replace(`${runId}_`, '').replace(/_\d+\.png$/, ''),
        sizeBytes: fs.statSync(path.join(screenshotDir, f)).size,
        url:       `/api/browser/screenshot?path=${encodeURIComponent(path.join(screenshotDir, f))}`,
      }));

    res.json({ ok: true, runId, screenshots: files });
  });

  return router;
}
