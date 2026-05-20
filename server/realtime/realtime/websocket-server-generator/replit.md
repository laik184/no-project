# WebSocket Server Generator (HVP)

## 1) WebSocket flow
1. Client initiates connection request.
2. Orchestrator bootstraps a WebSocket provider server (`custom`, `ws`, or `socket.io` adapter).
3. Auth middleware validates token and resolves identity.
4. Connection manager registers the socket and namespace.
5. Event router validates payload + spam limits, then routes events.
6. Room manager handles joins/leaves and membership lifecycle.
7. Disconnect handler removes connection from rooms/namespaces and cleans state.

Flow summary: `client → connect → auth → event → room → broadcast`.

## 2) Event lifecycle
1. `routeEvent()` receives raw event payload.
2. `event-parser.util.ts` normalizes the message.
3. `payload-validator.util.ts` validates shape and payload size.
4. `event-router.agent.ts` applies anti-spam guard (window + max events).
5. Validated event is returned to caller for provider-level broadcast/send.

## 3) File responsibilities
- `orchestrator.ts` (L1): wiring and runtime flow only.
- `agents/*.agent.ts` (L2): one responsibility per runtime step.
- `utils/*.util.ts` (L3): helpers only (parse, validate, ids, config, logs).
- `types.ts` and `state.ts` (L0): contracts and in-memory state.
- `index.ts`: public API exports.

## 4) Import structure
- Allowed: `orchestrator -> agents -> utils (+ types/state)`.
- No agent-to-agent imports.
- No upward imports from utils/state/types into higher forbidden layers.

## 5) Chat example
```ts
import { startWebSocketServer } from './index.js';

const ws = await startWebSocketServer({
  port: 8080,
  provider: 'custom',
  allowAnonymous: false,
  jwtSecret: process.env.JWT_SECRET,
  namespaces: ['/', '/chat'],
});

const conn = await ws.connect({ token: 'Bearer <jwt>', namespace: '/chat' });
ws.joinRoom(conn.id, 'room:general');
ws.routeEvent({
  connectionId: conn.id,
  event: 'chat:message',
  room: 'room:general',
  data: { text: 'Hello world' },
});
```
