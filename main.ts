4/**
 * main.ts — Application entry point
 *
 * Boots all server modules and starts the HTTP server on port 3001.
 * The Vite dev server (port 5000) proxies /api, /sse, /events, /preview, /ws to this server.
 */

import http from 'http';
import express from 'express';

import { bootstrapMemory }          from './server/memory/index.ts';
import { chatOrchestrator, runStartRouter } from './server/chat/index.ts';
import consolePipeline              from './server/console/index.ts';
import previewPipeline              from './server/preview/index.ts';
import { initOrchestration, createOrchestrationRouter } from './server/orchestration/index.ts';
import projectsRouter               from './server/projects/projects.router.ts';

// ── App setup ─────────────────────────────────────────────────────────────────

const app  = express();
const PORT = Number(process.env.API_PORT ?? 3001);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Memory platform ───────────────────────────────────────────────────────────
// Must run before any module that stores to or reads from memoryEngine.

bootstrapMemory();

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── Mount modules ─────────────────────────────────────────────────────────────

// Chat module: /api/chat/* (includes SSE at /api/chat/stream)
app.use('/api/chat',    chatOrchestrator.buildChatRouter());

// Console pipeline: /api/console/*
app.use('/api',         consolePipeline);

// Preview pipeline: /api/preview/*, /api/run-project, /api/files/*, etc.
app.use('/api',         previewPipeline);

// Orchestration: /api/orchestration/*
app.use('/api/orchestration', createOrchestrationRouter());

// Projects: /api/projects/*
app.use('/api', projectsRouter);

// Run: POST /api/run, POST /api/run/:runId/cancel, GET /api/run/active
app.use('/api/run', runStartRouter);

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(app);

// WebSocket upgrade handling (chat WS)
chatOrchestrator.attachWebSocket(server);

// ── Start ─────────────────────────────────────────────────────────────────────

initOrchestration();
chatOrchestrator.startPersistence();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] API server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down');
  server.close(() => process.exit(0));
});
