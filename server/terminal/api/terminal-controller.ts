/**
 * server/terminal/api/terminal-controller.ts
 *
 * Express request handlers for the terminal API.
 * Thin layer — delegates all logic to runtime and service modules.
 * Data persistence goes exclusively through the repository layer.
 */

import type { Request, Response }    from 'express';
import { terminalSessionManager }    from '../runtime/terminal-session-manager.ts';
import { terminalLifecycle }         from '../runtime/terminal-lifecycle.ts';
import { terminalStreamBroker }      from '../streaming/terminal-stream-broker.ts';
import { errorParser }               from '../parsers/error-parser.ts';
import { commandService }            from '../../services/terminal/index.ts';
import { terminalLogRepository, commandRepository } from '../../repositories/terminal/index.ts';
import type { CommandInput }         from '../contracts/command-input.ts';

export const terminalController = {
  // POST /api/terminal/sessions
  createSession(req: Request, res: Response): void {
    const { projectId, cwd, env } = req.body as { projectId: number; cwd: string; env?: Record<string, string> };
    if (!projectId || !cwd) {
      res.status(400).json({ error: 'projectId and cwd are required.' });
      return;
    }
    try {
      const session = terminalSessionManager.create(Number(projectId), cwd, env);
      res.status(201).json({
        sessionId: session.id,
        projectId: session.projectId,
        cwd:       session.cwd,
        createdAt: session.createdAt,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create session.' });
    }
  },

  // GET /api/terminal/sessions/:sessionId
  getSession(req: Request, res: Response): void {
    const session = terminalSessionManager.get(req.params.sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found.' }); return; }
    res.json(session);
  },

  // GET /api/terminal/sessions?projectId=N
  listSessions(req: Request, res: Response): void {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    res.json(terminalSessionManager.list(projectId));
  },

  // DELETE /api/terminal/sessions/:sessionId
  destroySession(req: Request, res: Response): void {
    const { sessionId } = req.params;
    terminalLifecycle.stop(sessionId, false);
    const closed = terminalSessionManager.close(sessionId);
    res.json({ ok: closed });
  },

  // POST /api/terminal/sessions/:sessionId/run
  async runCommand(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const body = req.body as CommandInput;

    const session = terminalSessionManager.get(sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found.' }); return; }
    if (!body.command?.trim()) { res.status(400).json({ error: 'command is required.' }); return; }

    try {
      const result = await commandService.stream(body.command, {
        cwd:         session.cwd,
        env:         { ...session.env, ...(body.env ?? {}) },
        timeoutMs:   body.timeoutMs,
        sandboxRoot: session.cwd,
      });

      // Fan out lines to SSE subscribers
      result.stdout.split('\n').filter(Boolean).forEach(line => {
        const sev = errorParser.classify(line);
        terminalStreamBroker.publishLine(sessionId, line, sev === 'error' || sev === 'fatal' ? 'stderr' : 'stdout');
      });
      result.stderr.split('\n').filter(Boolean).forEach(line => {
        terminalStreamBroker.publishLine(sessionId, line, 'stderr');
      });

      // Persist logs via repository layer
      terminalLogRepository.saveMany(
        [...result.stdout.split('\n'), ...result.stderr.split('\n')]
          .filter(Boolean)
          .map((line, i) => ({
            id:        `${sessionId}_${Date.now()}_${i}`,
            sessionId,
            projectId: session.projectId,
            line,
            source:    'stdout' as const,
            level:     'unknown' as const,
            timestamp: Date.now(),
          })),
      ).catch(() => void 0);

      // Persist command history via repository layer
      commandRepository.appendHistory(sessionId, {
        command:   body.command,
        exitCode:  result.exitCode,
        timestamp: Date.now(),
      });

      res.json({ sessionId, command: body.command, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Command failed.' });
    }
  },

  // POST /api/terminal/sessions/:sessionId/runtime/start
  startRuntime(req: Request, res: Response): void {
    const { sessionId } = req.params;
    const { command }   = req.body as { command: string };

    if (!command?.trim()) { res.status(400).json({ error: 'command is required.' }); return; }

    try {
      const handle = terminalLifecycle.start(sessionId, command, {
        onLine: (line, src) => terminalStreamBroker.publishLine(sessionId, line, src),
        onCrash: () => terminalStreamBroker.publishLine(sessionId, 'Process crashed.', 'system'),
      });
      res.json({ sessionId, pid: handle.pid, running: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to start runtime.' });
    }
  },

  // POST /api/terminal/sessions/:sessionId/runtime/stop
  stopRuntime(req: Request, res: Response): void {
    const { sessionId } = req.params;
    const force = Boolean(req.body?.force);
    const stopped = terminalLifecycle.stop(sessionId, force);
    res.json({ sessionId, stopped });
  },

  // POST /api/terminal/sessions/:sessionId/runtime/restart
  async restartRuntime(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const { command }   = req.body as { command?: string };
    try {
      const handle = await terminalLifecycle.restart(sessionId, command ?? '', {
        onLine: (line, src) => terminalStreamBroker.publishLine(sessionId, line, src),
      });
      res.json({ sessionId, pid: handle.pid, restarted: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to restart.' });
    }
  },

  // GET /api/terminal/sessions/:sessionId/logs
  async getLogs(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const session       = terminalSessionManager.get(sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found.' }); return; }

    const limit = Number(req.query.limit ?? 200);
    const logs  = await terminalLogRepository.findByProject(session.projectId, limit);
    res.json({ sessionId, logs });
  },

  // GET /api/terminal/sessions/:sessionId/history
  getHistory(req: Request, res: Response): void {
    const { sessionId } = req.params;
    const limit         = Number(req.query.limit ?? 50);
    const entries       = commandRepository.readHistory(sessionId, limit);
    res.json({ sessionId, entries });
  },
};
