/**
 * server/terminal/api/terminal-routes.ts
 *
 * Express router for all /api/terminal/* endpoints.
 */

import { Router }                  from 'express';
import { terminalController }      from './terminal-controller.ts';
import { terminalStreamEndpoint }  from './terminal-stream-endpoint.ts';

const router = Router();

// ── Session CRUD ──────────────────────────────────────────────────────────────
router.post('/sessions',              (req, res) => terminalController.createSession(req, res));
router.get('/sessions',               (req, res) => terminalController.listSessions(req, res));
router.get('/sessions/:sessionId',    (req, res) => terminalController.getSession(req, res));
router.delete('/sessions/:sessionId', (req, res) => terminalController.destroySession(req, res));

// ── Command execution ─────────────────────────────────────────────────────────
router.post('/sessions/:sessionId/run', (req, res) => terminalController.runCommand(req, res));

// ── Runtime control ───────────────────────────────────────────────────────────
router.post('/sessions/:sessionId/runtime/start',   (req, res) => terminalController.startRuntime(req, res));
router.post('/sessions/:sessionId/runtime/stop',    (req, res) => terminalController.stopRuntime(req, res));
router.post('/sessions/:sessionId/runtime/restart', (req, res) => terminalController.restartRuntime(req, res));

// ── Logs and history ──────────────────────────────────────────────────────────
router.get('/sessions/:sessionId/logs',    (req, res) => terminalController.getLogs(req, res));
router.get('/sessions/:sessionId/history', (req, res) => terminalController.getHistory(req, res));

// ── SSE stream ────────────────────────────────────────────────────────────────
router.get('/sessions/:sessionId/stream', (req, res) => terminalStreamEndpoint.handle(req, res));

export { router as terminalRouter };
