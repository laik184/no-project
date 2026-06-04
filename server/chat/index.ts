/**
 * server/chat/index.ts
 *
 * PUBLIC surface for the chat module.
 *
 * Exports `chatOrchestrator` — the facade that main.ts calls.
 * It wraps the @services/chat chatOrchestrator with two lifecycle methods:
 *   - mountRoutes(app)   → registers all /api/chat/* /api/run/* /api/checkpoints/* routes
 *   - bootstrap(server)  → starts WebSocket manager + heartbeat
 */

import type { Express }      from 'express';
import type * as http        from 'http';
import { chatOrchestrator as coreService } from '@services/chat';
import { chatRouter }        from './api/chat.routes.ts';
import { runRouter }         from './api/run.routes.ts';
import { runStartRouter }    from './api/run-start.router.ts';
import { questionRouter }    from './api/question.routes.ts';
import { checkpointRouter }  from './api/checkpoint.routes.ts';
import { attachmentRouter }  from './api/attachment.routes.ts';
import { historyRouter }     from './api/history.routes.ts';
import { websocketManager }  from './realtime/websocket-manager.ts';
import { heartbeatManager }  from './realtime/heartbeat-manager.ts';

export const chatOrchestrator = {
  startRun:  coreService.startRun.bind(coreService),
  cancelRun: coreService.cancelRun.bind(coreService),

  mountRoutes(app: Express): void {
    app.use('/api/chat',        chatRouter);
    app.use('/api/run',         runStartRouter);
    app.use('/api/runs',        runRouter);
    app.use('/api/questions',   questionRouter);
    app.use('/api/checkpoints', checkpointRouter);
    app.use('/api/attachments', attachmentRouter);
    app.use('/api/history',     historyRouter);
  },

  bootstrap(server: http.Server): void {
    websocketManager.initialize(server);
    heartbeatManager.start();
  },
};

// ── Re-exports for consumers of the chat module ───────────────────────────────

export { conversationManager }  from './orchestration/conversation-manager.ts';
export { questionManager }      from './questions/question-manager.ts';
export { messageBuilder }       from './messages/message-builder.ts';
export { contextLoader }        from './context/context-loader.ts';
export { buildContext }         from './context/context-builder.ts';
export { chatCheckpointStore }  from './persistence/checkpoint-store.ts';
export { runWriter }            from './persistence/run-writer.ts';
export { eventPublisher }       from './realtime/event-publisher.ts';
export { timelineManager }      from './timeline/timeline-manager.ts';

export * from './types/chat.types.ts';
export * from './types/run.types.ts';
export * from './types/message.types.ts';
export * from './types/checkpoint.types.ts';
export * from './types/event.types.ts';
export * from './types/question.types.ts';
