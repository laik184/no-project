# CHAT_INFRASTRUCTURE_IMPORT_AUDIT.md

**Date:** 2026-05-30  
**Phase:** 1 — Import Audit (pre-migration snapshot)  
**Scope:** 6 chat files — infrastructure import survey

---

## Pre-Check Results

| Check | Result |
|---|---|
| `server/infrastructure/index.ts` exists | ✅ YES |
| `db` exported from barrel | ✅ YES — Line 12 |
| `bus` exported from barrel | ✅ YES — Line 15 |
| `sseManager` exported from barrel | ✅ YES — Line 23 |
| `TOPIC` exported from barrel | ✅ YES — Line 29 |

All required exports confirmed. Migration proceeded.

---

## File 1 — `server/chat/index.ts`

| Field | Value |
|---|---|
| **Current Import Line 22** | `import { TOPIC } from '../infrastructure/realtime/stream-topics.ts'` |
| **Current Import Line 23** | `import { sseManager as infraSseManager } from '../infrastructure/events/sse/sse-manager.ts'` |
| **Symbol: `TOPIC`** | Used at line 67 — `Object.values(TOPIC)` — default topics for SSE stream |
| **Symbol: `infraSseManager`** | Used at lines 73-78 — `infraSseManager.register(res, topicSet, projectId, runId)` |
| **Replacement** | `import { TOPIC, sseManager as infraSseManager } from '../infrastructure'` |
| **Lines Reduced** | 2 → 1 |

---

## File 2 — `server/chat/persistence/attachment-store.ts`

| Field | Value |
|---|---|
| **Current Import Line 6** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Symbol: `db`** | Used at lines 35, 47, 55, 63, 72 — all Drizzle ORM queries on `chatUploads` table |
| **Replacement** | `import { db } from '../../infrastructure'` |

---

## File 3 — `server/chat/persistence/message-store.ts`

| Field | Value |
|---|---|
| **Current Import Line 6** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Symbol: `db`** | Used at lines 31, 41, 52, 63, 72, 81, 88 — all Drizzle ORM queries on `chatMessages` table |
| **Replacement** | `import { db } from '../../infrastructure'` |

---

## File 4 — `server/chat/persistence/run-store.ts`

| Field | Value |
|---|---|
| **Current Import Line 7** | `import { db } from '../../infrastructure/db/index.ts'` |
| **Symbol: `db`** | Used at lines 29, 38, 53, 63 — read-only queries on `agentRuns` table |
| **Replacement** | `import { db } from '../../infrastructure'` |

---

## File 5 — `server/chat/realtime/event-publisher.ts`

| Field | Value |
|---|---|
| **Current Import Line 6** | `import { bus } from '../../infrastructure/events/bus.ts'` |
| **Symbol: `bus`** | Used at lines 38, 46 — `bus.emit('agent.event', event)` and `bus.emit('agent.event', payload)` |
| **Replacement** | `import { bus } from '../../infrastructure'` |

---

## File 6 — `server/chat/realtime/sse-manager.ts`

| Field | Value |
|---|---|
| **Current Import Line 12** | `import { sseManager as infraSseManager } from '../../infrastructure/events/sse/sse-manager.ts'` |
| **Symbol: `infraSseManager`** | Used at lines 17, 21 — `infraSseManager.connectionCount`, `infraSseManager.stats()` |
| **Replacement** | `import { sseManager as infraSseManager } from '../../infrastructure'` |

---

## Summary

| File | Symbols | Old Path | New Path |
|---|---|---|---|
| `chat/index.ts` | `TOPIC`, `sseManager` | 2 deep paths | 1 barrel import |
| `persistence/attachment-store.ts` | `db` | `db/index.ts` | `infrastructure` |
| `persistence/message-store.ts` | `db` | `db/index.ts` | `infrastructure` |
| `persistence/run-store.ts` | `db` | `db/index.ts` | `infrastructure` |
| `realtime/event-publisher.ts` | `bus` | `events/bus.ts` | `infrastructure` |
| `realtime/sse-manager.ts` | `sseManager` | `events/sse/sse-manager.ts` | `infrastructure` |
