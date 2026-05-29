---
name: Chat module integration contract
description: How server/chat/index.ts must integrate with main.ts and the infrastructure layer — critical shims and facade shape.
---

## Rule

`server/chat/index.ts` must export a named `chatOrchestrator` object with exactly four methods:

```ts
chatOrchestrator.buildChatRouter()        // → Express Router for /api/chat/*
chatOrchestrator.buildSseRouter()         // → Express Router for /api/chat/stream SSE endpoint
chatOrchestrator.attachWebSocket(server)  // → registers WS upgrade handler on the HTTP server
chatOrchestrator.startPersistence()       // → starts heartbeat + logs module online
```

main.ts calls all four — any missing method causes a `TypeError: chatOrchestrator.X is not a function` crash at boot.

## Hard dependency: sse-utils.ts

`server/infrastructure/events/core/backpressure.ts` imports `sseSendId` from:
```
../../../chat/streams/sse-utils.ts
```
This path resolves to `server/chat/streams/sse-utils.ts`. The file must exist and export:
- `sseSendId(res, topic, data, seqId)` — writes a sequenced SSE frame with `id:` field
- (optional helpers) `sseSend`, `ssePing`

If this file is missing the server crashes at startup with `ERR_MODULE_NOT_FOUND` before any route is registered.

## SSE setup pattern

There is no `sse.ts` helper file in `server/infrastructure/events/sse/`. Inline SSE header setup directly:
```ts
res.writeHead(200, {
  'Content-Type':  'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection':    'keep-alive',
  'X-Accel-Buffering': 'no',
});
res.flushHeaders?.();
```
Then call `infraSseManager.register(res, topicSet, projectId, runId)` and wire `req.on('close', cleanup)`.

**Why:** These files are pre-existing infrastructure contracts. Any new chat sub-module must satisfy them or the server won't start.

**How to apply:** Whenever the chat module is rebuilt or reset, verify both the facade shape in `index.ts` and the presence of `server/chat/streams/sse-utils.ts` before running the server.
