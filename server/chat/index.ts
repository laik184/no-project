/**
 * server/chat/index.ts — Chat module bootstrap and public API.
 *
 * Responsibilities:
 *   - Mount all chat API routes (including SSE)
 *   - Export the module's public contract
 *   - Export application-layer facade (chatOrchestrator) consumed by main.ts
 *
 * No business logic here.
 */
import { Router }       from 'express';
import type { Server }  from 'http';
import type { Request, Response } from 'express';
import { chatRoutes }       from './api/chat.routes.ts';
import { runRoutes }        from './api/run.routes.ts';
import { historyRoutes }    from './api/history.routes.ts';
import { attachmentRoutes } from './api/attachment.routes.ts';
import { questionRoutes }   from './api/question.routes.ts';
import { heartbeatManager } from './realtime/heartbeat-manager.ts';
import { websocketManager } from './realtime/websocket-manager.ts';
import { TOPIC, sseManager as infraSseManager } from '../infrastructure';

// ── Chat router ───────────────────────────────────────────────────────────────

export const chatRouter = Router();

chatRouter.use('/',            chatRoutes);
chatRouter.use('/runs',        runRoutes);
chatRouter.use('/history',     historyRoutes);
chatRouter.use('/attachments', attachmentRoutes);
chatRouter.use('/questions',   questionRoutes);

// ── SSE route — mounted at /api/chat/stream ───────────────────────────────────

/**
 * GET /api/chat/stream?projectId=N&runId=X&topics=agent,lifecycle
 * Chat-scoped SSE stream. Delegates to infrastructure SSE manager.
 * Mounted on chatRouter so effective path is /api/chat/stream.
 */
chatRouter.get('/stream', (req: Request, res: Response) => {
  const projectId = req.query.projectId ? Number(req.query.projectId) : null;
  const runId     = (req.query.runId as string | undefined);

  const requestedTopics = req.query.topics
    ? String(req.query.topics).split(',').map((t) => t.trim())
    : Object.values(TOPIC);

  const topicSet = new Set<string>(requestedTopics);

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const cleanup = infraSseManager.register(
    res,
    topicSet as unknown as ReadonlySet<string>,
    projectId,
    runId,
  );

  req.on('close', () => cleanup());
});

// ── Application-layer facade — consumed by main.ts ────────────────────────────

/**
 * chatOrchestrator — Application facade.
 *
 * main.ts imports this object and calls:
 *   - buildChatRouter()       → Express Router for /api/chat/* (includes SSE)
 *   - attachWebSocket(server) → Registers WS handlers on the HTTP server
 *   - startPersistence()      → Starts heartbeat + background services
 *
 * Internal orchestration logic lives in orchestration/chat-orchestrator.ts.
 * This facade only wires external I/O.
 */
export const chatOrchestrator = {
  buildChatRouter(): Router {
    return chatRouter;
  },

  attachWebSocket(server: Server): void {
    server.on('upgrade', (request, socket, head) => {
      const url      = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      // Only handle /ws/chat/* — other WS paths are owned by other modules
      if (!pathname.startsWith('/ws/chat')) return;

      const projectId = Number(url.searchParams.get('projectId') ?? '0');
      if (!projectId) {
        socket.destroy();
        return;
      }

      // Dynamic import to avoid circular dependency at module load time
      import('ws').then(({ WebSocketServer }) => {
        const wss = new WebSocketServer({ noServer: true });
        wss.handleUpgrade(request, socket, head, (ws) => {
          websocketManager.register(projectId, ws as any);
          wss.emit('connection', ws, request);
        });
      }).catch(() => {
        socket.destroy();
      });
    });
  },

  startPersistence(): void {
    heartbeatManager.start();
    console.log('[chat] Module online — heartbeat ✓ SSE facade ✓ WS adapter ✓');
  },
};

// ── Public API re-exports ─────────────────────────────────────────────────────

export { conversationManager }   from './orchestration/conversation-manager.ts';
export { sessionManager }        from './orchestration/session-manager.ts';
export { turnManager }           from './orchestration/turn-manager.ts';
export { streamManager }         from './orchestration/stream-manager.ts';
export { messageBuilder }        from './messages/message-builder.ts';
export { questionManager }       from './questions/question-manager.ts';
export { answerManager }         from './questions/answer-manager.ts';
export { clarificationManager }  from './questions/clarification-manager.ts';
export { attachmentManager }     from './attachments/attachment-manager.ts';
export { timelineManager }       from './timeline/timeline-manager.ts';
export { chatStore }             from './persistence/chat-store.ts';
export { eventPublisher }        from './realtime/event-publisher.ts';

// ── Type re-exports ───────────────────────────────────────────────────────────

export type { ChatRun, RunStartPayload, RunStatus } from './types/run.types.ts';
export type { ChatMessageRecord, MessageRole, StreamChunk } from './types/message.types.ts';
export type { ChatQuestion, AskQuestionPayload, AnswerPayload } from './types/question.types.ts';
export type { Conversation, ChatSession, ChatTurn } from './types/chat.types.ts';
export type { ChatEventType, ChatEvent } from './types/event.types.ts';
export type { TimelineEntry, TimelineEntryKind } from './timeline/event-timeline.ts';
