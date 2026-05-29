import express from 'express';
import { createServer } from 'http';
import { chatOrchestrator }                    from './server/chat/index.ts';
import { loadAllTools }                        from './server/tools/registry/tool-loader.ts';
import { initOrchestration, createOrchestrationRouter } from './server/orchestration/index.ts';

const app  = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Bootstrap — tools must be registered before orchestration initializes ─────
loadAllTools();
initOrchestration();

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/chat',          chatOrchestrator.buildChatRouter());
app.use(                      chatOrchestrator.buildSseRouter());
app.use('/api/orchestration', createOrchestrationRouter());

const server = createServer(app);

chatOrchestrator.attachWebSocket(server);
chatOrchestrator.startPersistence();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[nura-x] API server running on port ${PORT}`);
});

export default app;
