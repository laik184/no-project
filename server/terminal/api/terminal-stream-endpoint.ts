/**
 * server/terminal/api/terminal-stream-endpoint.ts
 *
 * SSE endpoint handler for live terminal output streaming.
 * Attaches the request to the connection pool for the given session.
 */

import type { Request, Response } from 'express';
import { terminalSseManager }     from '../streaming/terminal-sse-manager.ts';
import { terminalSessionManager } from '../runtime/terminal-session-manager.ts';

export const terminalStreamEndpoint = {
  handle(req: Request, res: Response): void {
    const sessionId = req.params.sessionId ?? (req.query.sessionId as string);

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required.' });
      return;
    }

    const session = terminalSessionManager.get(sessionId);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${sessionId}` });
      return;
    }

    terminalSseManager.attach(req, res, sessionId);
  },
};
