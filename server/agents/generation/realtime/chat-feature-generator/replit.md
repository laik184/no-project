# Chat Feature Generator

## 1) Chat architecture

The generator is organized with strict HVP layering:

- **L0**: `types.ts`, `state.ts`
- **L1**: `orchestrator.ts`
- **L2**: dedicated agents (`agents/*.agent.ts`)
- **L3**: utility helpers (`utils/*.util.ts`)

The orchestrator only coordinates generation. It does not contain chat business logic.

## 2) Event flow (send → receive)

Flow implemented in generated module contracts:

`client → socket-client → socket-server → room-manager/message-handler → event-dispatcher → broadcast → client`

Detailed send/receive pattern:

1. Frontend emits `chat:message.send`
2. Server event dispatcher routes to `onSendMessage`
3. Message handler normalizes the message payload
4. Message is broadcast to room via `chat:message.received`
5. Read receipts and typing indicators are dispatched as independent events

## 3) File responsibilities

- `chat-schema.agent.ts`: message + room schema templates
- `message-handler.agent.ts`: message send/receive behavior template
- `room-manager.agent.ts`: room create/join template
- `presence-manager.agent.ts`: online/offline emission template
- `event-dispatcher.agent.ts`: socket event routing template
- `socket-server.agent.ts`: backend websocket setup (redis optional)
- `socket-client.agent.ts`: frontend socket/reconnect setup
- `read-receipt.agent.ts`: read receipt emission template
- `typing-indicator.agent.ts`: typing state emission template
- `chat-ui.agent.ts`: frontend chat UI scaffold template

## 4) Import structure

Rules enforced by design:

- Allowed: `orchestrator → agents`
- Allowed: `agents → utils`
- Allowed: `orchestrator/agents → types`
- Forbidden: `agent → agent`

This keeps high cohesion and low coupling.

## 5) Frontend-backend connection

The generated frontend client (`socket-client`) includes reconnect behavior and listens for realtime events. The generated backend socket server accepts connections, and the event dispatcher binds core realtime handlers:

- Rooms
- Presence
- Typing indicators
- Read receipts
- Message send/receive

For horizontal scaling, `socket-server` supports optional Redis adapter wiring for multi-instance broadcasts.
