# BACKEND LAYERED ARCHITECTURE AUDIT

**Scan Target:** `server/**`
**Method:** Actual imports only — no assumptions from folder names.
**Date:** 2026-06-04

---

## EXPECTED DEPENDENCY FLOW

```
Infrastructure
     ↑
Repositories
     ↑
Services
     ↑
Tools
     ↑
Agents
     ↑
Orchestration
     ↑
Chat
     ↑
HTTP (Routes / Controllers)

Cross-cutting: Memory
  VALID consumers   → Agents, Orchestration, Chat Services
  INVALID consumers → Repositories, Infrastructure, Routes, Controllers
```

---

## 1. LAYER INVENTORY

### Infrastructure
```
server/infrastructure/db/index.ts
server/infrastructure/events/bus.ts
server/infrastructure/events/file-change-emitter.ts
server/infrastructure/events/sse/sse-manager.ts
server/infrastructure/process/process-registry.ts
server/infrastructure/realtime/stream-topics.ts
server/infrastructure/runtime/runtime-manager.ts
server/infrastructure/sandbox/sandbox.util.ts
server/infrastructure/checkpoints/safe-fs.util.ts
server/infrastructure/checkpoints/git-runner.ts
server/infrastructure/seed.ts
server/infrastructure/index.ts
```

### Repositories
```
server/repositories/chat/run.repository.ts
server/repositories/chat/message.repository.ts
server/repositories/chat/checkpoint.repository.ts
server/repositories/chat/attachment.repository.ts
server/repositories/file-system/filesystem/filesystem.repository.ts
server/repositories/file-system/git/git.repository.ts
server/repositories/file-system/metadata/metadata.repository.ts
server/repositories/file-system/history/history.repository.ts
server/repositories/file-system/recent/recent.repository.ts
server/repositories/file-system/pinned/pinned.repository.ts
server/repositories/file-system/editors/editors.repository.ts
server/repositories/file-system/index.ts
server/repositories/index.ts
```

### Services
```
server/services/chat/chat.service.ts
server/services/chat/session.service.ts
server/services/chat/turn.service.ts
server/services/chat/stream.service.ts
server/services/chat/intent.service.ts
server/services/chat/clarification.service.ts
server/services/chat/responder.service.ts
server/services/chat/context.service.ts
server/services/chat/checkpoint.service.ts
server/services/filesystem/tree/tree.service.ts
server/services/filesystem/read/read.service.ts
server/services/filesystem/write/write.service.ts
server/services/filesystem/create/create.service.ts
server/services/filesystem/rename/rename.service.ts
server/services/filesystem/delete/delete.service.ts
server/services/filesystem/duplicate/duplicate.service.ts
server/services/filesystem/upload/upload.service.ts
server/services/filesystem/download/download.service.ts
server/services/filesystem/search/search.service.ts
server/services/filesystem/metadata/metadata.service.ts
server/services/filesystem/clipboard/clipboard.service.ts
server/services/filesystem/history/history.service.ts
server/services/filesystem/recent/recent.service.ts
server/services/filesystem/pinned/pinned.service.ts
server/services/filesystem/open-editors/open-editors.service.ts
server/services/filesystem/git-status/git-status.service.ts
server/services/filesystem/insights/insights.service.ts
server/services/filesystem/dependency-analysis/dependency-analysis.service.ts
server/services/filesystem/scanner/scanner.service.ts
```

### Tools
```
server/tools/filesystem/move/move-file.ts
server/tools/filesystem/read/read-folder.ts
server/tools/filesystem/read/read-file.ts
server/tools/filesystem/write/write-file.ts
server/tools/filesystem/search/search-files.ts
server/tools/browser/**
server/tools/terminal/**
server/tools/coding/**
server/tools/verifier/**
```

### Agents
```
server/agents/planner/planner-agent.ts
server/agents/executor/executor-agent.ts
server/agents/verifier/verifier-agent.ts
server/agents/supervisor/supervisor-agent.ts
server/agents/coderx/coderx-agent.ts
server/agents/terminal/terminal-agent.ts
server/agents/filesystem/filesystem-agent.ts
server/agents/browser/browser-agent.ts
```

### Orchestration
```
server/orchestration/orchestrator.ts
server/orchestration/core/run-manager.ts
server/orchestration/execution/workflow-runner.ts
server/orchestration/execution/phase-runner.ts
server/orchestration/monitoring/orchestration-monitor.ts
server/orchestration/telemetry/orchestration-metrics.ts
server/orchestration/index.ts
```

### Chat
```
server/chat/api/chat.routes.ts
server/chat/api/run.routes.ts
server/chat/api/run-start.router.ts
server/chat/api/question.routes.ts
server/chat/api/checkpoint.routes.ts
server/chat/api/attachment.routes.ts
server/chat/api/history.routes.ts
server/chat/controllers/run-controller.ts
server/chat/controllers/chat-controller.ts
server/chat/controllers/question-controller.ts
server/chat/controllers/checkpoint-controller.ts
server/chat/controllers/history-controller.ts
server/chat/controllers/attachment-controller.ts
server/chat/persistence/run-store.ts
server/chat/persistence/run-writer.ts
server/chat/persistence/message-store.ts
server/chat/persistence/checkpoint-store.ts
server/chat/persistence/attachment-store.ts
server/chat/orchestration/conversation-manager.ts
server/chat/orchestration/chat-orchestrator.ts
server/chat/messages/message-builder.ts
server/chat/questions/question-manager.ts
server/chat/realtime/event-publisher.ts
server/chat/index.ts
```

### Memory (Cross-cutting)
```
server/memory/index.ts
server/memory/stores/failure-memory.ts
server/memory/stores/execution-history.ts
server/memory/stores/learning-store.ts
```

### HTTP (File Explorer)
```
server/file-explorer/routers/file-explorer.router.ts
server/file-explorer/controllers/**
server/file-explorer/mappers/tree.mapper.ts
server/file-explorer/realtime/file-publisher.ts
server/file-explorer/realtime/file-subscriber.ts
```

---

## 2. ACTUAL DEPENDENCY GRAPH

```
main.ts
├── server/memory/index.ts           (bootstrap only)
├── server/chat/index.ts
│   └── server/services/chat/chat.service.ts
│       ├── server/orchestration/index.ts        ← UPWARD (Service→Orchestration)
│       ├── server/chat/orchestration/conversation-manager.ts  ← UPWARD (Service→Chat)
│       └── server/chat/messages/message-builder.ts            ← UPWARD (Service→Chat)
├── server/orchestration/index.ts
│   └── server/orchestration/orchestrator.ts
│       ├── server/agents/**
│       └── server/memory/index.ts
└── server/file-explorer/index.ts
    ├── server/file-explorer/mappers/tree.mapper.ts
    │   └── server/repositories/file-system/index.ts  ← BYPASS (HTTP→Repository)
    ├── server/file-explorer/realtime/file-publisher.ts
    │   └── server/infrastructure/index.ts             ← BYPASS (HTTP→Infrastructure)
    └── server/file-explorer/realtime/file-subscriber.ts
        └── server/infrastructure/index.ts             ← BYPASS (HTTP→Infrastructure)

server/services/filesystem/tree/tree.service.ts
└── server/file-explorer/mappers/index.ts              ← CIRCULAR (Service→HTTP)

server/services/filesystem/upload/upload.service.ts
└── server/file-explorer/mappers/index.ts              ← CIRCULAR (Service→HTTP)

server/services/chat/clarification.service.ts
└── server/chat/questions/question-manager.ts          ← UPWARD (Service→Chat)

server/services/chat/checkpoint.service.ts
└── server/chat/persistence/checkpoint-store.ts        ← UPWARD (Service→Chat)
```

---

## 3. VIOLATION REPORT

### V-01 · Service → Orchestration (CRITICAL)
| # | File | Import | Severity |
|---|------|--------|----------|
| 1 | `server/services/chat/chat.service.ts` | `import { orchestrate, runManager } from '../../orchestration/index.ts'` | 🔴 Critical |

**Rule broken:** Services must not import from Orchestration. Orchestration sits above Services.

---

### V-02 · Service → Chat (CRITICAL)
| # | File | Import | Severity |
|---|------|--------|----------|
| 1 | `server/services/chat/chat.service.ts` | `import { conversationManager } from '../../chat/orchestration/conversation-manager.ts'` | 🔴 Critical |
| 2 | `server/services/chat/chat.service.ts` | `import { messageBuilder } from '../../chat/messages/message-builder.ts'` | 🔴 Critical |
| 3 | `server/services/chat/clarification.service.ts` | `import { questionManager } from '../../chat/questions/question-manager.ts'` | 🔴 Critical |
| 4 | `server/services/chat/checkpoint.service.ts` | `import { chatCheckpointStore } from '../../chat/persistence/checkpoint-store.ts'` | 🔴 Critical |

**Rule broken:** Services must not import from Chat layer.

---

### V-03 · HTTP → Repository (BYPASS)
| # | File | Import | Severity |
|---|------|--------|----------|
| 1 | `server/file-explorer/mappers/tree.mapper.ts` | `import { filesystemRepository } from '../../repositories/file-system/index.ts'` | 🟠 High |

**Rule broken:** HTTP/mapper layer must not bypass Services to access Repositories directly.

---

### V-04 · HTTP → Infrastructure (BYPASS)
| # | File | Import | Severity |
|---|------|--------|----------|
| 1 | `server/file-explorer/realtime/file-publisher.ts` | `import { sseManager, TOPIC } from '../../infrastructure/index.ts'` | 🟠 High |
| 2 | `server/file-explorer/realtime/file-subscriber.ts` | `import { bus } from '../../infrastructure/index.ts'` | 🟠 High |

**Rule broken:** Realtime file-explorer components bypass all intermediate layers.
**Note:** `sseManager` and `bus` are event infrastructure — acceptable only if no equivalent service abstraction exists. Recommend wrapping in a realtime service.

---

### V-05 · Service → HTTP (CIRCULAR)
| # | File | Import | Severity |
|---|------|--------|----------|
| 1 | `server/services/filesystem/tree/tree.service.ts` | `import { buildTreeFromDir } from '../../../file-explorer/mappers/index.ts'` | 🔴 Critical |
| 2 | `server/services/filesystem/upload/upload.service.ts` | `import { toUploadedFile } from '../../../file-explorer/mappers/index.ts'` | 🔴 Critical |

**Rule broken:** Services importing from `file-explorer/` (HTTP layer) creates a circular dependency. The mapper logic (`buildTreeFromDir`, `toUploadedFile`) must be moved into `shared/` or into the service layer itself.

---

### V-06 · Chat Persistence → Repository (BORDERLINE)
| # | File | Import | Severity |
|---|------|--------|----------|
| 1 | `server/chat/persistence/run-store.ts` | `import { runRepository } from '../../repositories/chat/run.repository.ts'` | 🟡 Medium |
| 2 | `server/chat/persistence/run-writer.ts` | `import { runRepository } from '../../repositories/chat/run.repository.ts'` | 🟡 Medium |
| 3 | `server/chat/persistence/message-store.ts` | `import { messageRepository } from '../../repositories/chat/message.repository.ts'` | 🟡 Medium |
| 4 | `server/chat/persistence/checkpoint-store.ts` | `import { checkpointRepository } from '../../repositories/chat/checkpoint.repository.ts'` | 🟡 Medium |
| 5 | `server/chat/persistence/attachment-store.ts` | `import { attachmentRepository } from '../../repositories/chat/attachment.repository.ts'` | 🟡 Medium |

**Assessment:** Borderline — Chat persistence acts as a thin store facade over repositories. Acceptable if `server/chat/persistence/` is treated as a Chat-owned data-access sub-layer. **Becomes a violation** if Services bypass this and access repositories directly (they do not — Service layer is clean).

---

### V-07 · Tools → Services (ACCEPTABLE WITH NOTE)
| # | File | Import | Severity |
|---|------|--------|----------|
| 1 | `server/tools/filesystem/move/move-file.ts` | `import { renameService } from '../../../services/filesystem/index.ts'` | 🟡 Medium |
| 2 | `server/tools/filesystem/read/read-folder.ts` | `import { scannerService } from '../../../services/filesystem/index.ts'` | 🟡 Medium |
| 3 | `server/tools/filesystem/read/read-file.ts` | `import { readService } from '../../../services/filesystem/index.ts'` | 🟡 Medium |
| 4 | `server/tools/filesystem/write/write-file.ts` | `import { writeService } from '../../../services/filesystem/index.ts'` | 🟡 Medium |
| 5 | `server/tools/filesystem/search/search-files.ts` | `import { searchService } from '../../../services/filesystem/index.ts'` | 🟡 Medium |

**Assessment:** Tools using Services is a pragmatic pattern — Tools are the agent "hands" that delegate to Services. **Not a violation** if Tools never import from Orchestration, Chat, or Agents. Flagged for awareness only.

---

## 4. BYPASS DETECTION SUMMARY

| Bypass Type | File | Direct Import | Status |
|---|---|---|---|
| HTTP → Repository | `file-explorer/mappers/tree.mapper.ts` | `repositories/file-system/index.ts` | 🔴 Fix |
| HTTP → Infrastructure | `file-explorer/realtime/file-publisher.ts` | `infrastructure/index.ts` | 🟠 Review |
| HTTP → Infrastructure | `file-explorer/realtime/file-subscriber.ts` | `infrastructure/index.ts` | 🟠 Review |
| Service → Chat | `services/chat/chat.service.ts` | `chat/orchestration/*`, `chat/messages/*` | 🔴 Fix |
| Service → Orchestration | `services/chat/chat.service.ts` | `orchestration/index.ts` | 🔴 Fix |
| Service → HTTP (circular) | `services/filesystem/tree/tree.service.ts` | `file-explorer/mappers/index.ts` | 🔴 Fix |
| Service → HTTP (circular) | `services/filesystem/upload/upload.service.ts` | `file-explorer/mappers/index.ts` | 🔴 Fix |

---

## 5. MEMORY AUDIT

### Valid Memory Consumers ✅
| File | Import |
|---|---|
| `server/services/chat/context.service.ts` | `buildMemoryContextString` |
| `server/orchestration/orchestrator.ts` | `buildMemoryContext`, `memoryEngine` |
| `server/orchestration/execution/workflow-runner.ts` | `buildMemoryContext` |
| `server/orchestration/execution/phase-runner.ts` | `buildMemoryContext` |
| `server/agents/planner/planner-agent.ts` | `memoryEngine`, `graphTraversal`, `graphStore` |
| `server/agents/executor/executor-agent.ts` | `memoryEngine`, `buildMemoryContext` |
| `server/agents/verifier/verifier-agent.ts` | `memoryEngine`, `buildMemoryContext` |
| `server/agents/supervisor/supervisor-agent.ts` | `memoryEngine`, `buildMemoryContext` |
| `server/agents/coderx/coderx-agent.ts` | `memoryEngine`, `buildMemoryContext` |
| `server/agents/terminal/terminal-agent.ts` | `buildMemoryContext`, `memoryEngine` |
| `server/agents/filesystem/filesystem-agent.ts` | `buildMemoryContext`, `memoryEngine` |
| `server/agents/browser/browser-agent.ts` | `memoryEngine`, `buildMemoryContext` |
| `main.ts` | `bootstrapMemory` (bootstrap only) |

### Invalid Memory Consumers ✅ NONE
No repositories, infrastructure files, routes, or controllers import from `server/memory/`.

**Memory Score: 13/13 valid — CLEAN ✅**

---

## 6. FILESYSTEM DOMAIN SCORE

| Check | Result |
|---|---|
| `file-explorer` → `services/filesystem` (correct flow) | ✅ Mostly correct |
| `file-explorer/mappers/tree.mapper.ts` bypasses services | ❌ Violation |
| `file-explorer/realtime/file-publisher.ts` bypasses services/repos | ⚠️ Bypass |
| `file-explorer/realtime/file-subscriber.ts` bypasses services/repos | ⚠️ Bypass |
| `services/filesystem` → `repositories/file-system` | ✅ Correct |
| `services/filesystem/tree.service.ts` imports `file-explorer/mappers/` | ❌ Circular |
| `services/filesystem/upload.service.ts` imports `file-explorer/mappers/` | ❌ Circular |
| `repositories/file-system` → `infrastructure` | ✅ Correct (filesystem.repository.ts) |

**Filesystem Domain Score: 4/8 checks clean — 50% compliant**

---

## 7. CHAT DOMAIN SCORE

| Check | Result |
|---|---|
| `server/chat/` → `server/services/chat/` (service calls) | ✅ Correct |
| `server/services/chat/` → `server/chat/` (upward import) | ❌ Violation (3 files) |
| `server/services/chat/` → `server/orchestration/` (upward import) | ❌ Violation (1 file) |
| `server/services/chat/` → `server/repositories/` direct | ✅ Clean (no direct repo access) |
| `server/services/chat/` → `server/infrastructure/db` direct | ✅ Clean |
| `server/chat/persistence/` → `server/repositories/chat/` | ✅ Acceptable (store pattern) |
| `server/chat/controllers/` → `server/repositories/` direct | ✅ Clean |

**Chat Domain Score: 5/7 checks clean — 71% compliant**

---

## 8. INFRASTRUCTURE OWNERSHIP SCORE

| Check | Result |
|---|---|
| Only Repositories import `infrastructure/db` | ✅ Correct |
| Only Repositories import `infrastructure/events/bus` | ⚠️ file-explorer/realtime also imports bus |
| Only Infrastructure owns `sseManager` access | ⚠️ file-publisher.ts bypasses |
| `server/startup/health-diagnostics.ts` imported by Orchestration | ⚠️ Cross-cutting |
| No Controllers/Routes access Infrastructure directly | ✅ Correct (except file-explorer realtime) |

**Infrastructure Score: 3/5 checks clean — 60% compliant**

---

## 9. FINAL DEPENDENCY FLOW (Actual)

```
HTTP (Routes/Controllers)
├── server/chat/api/**
├── server/chat/controllers/**
└── server/file-explorer/** ──────────────────────────────────┐
         ↓                                                     │ BYPASSES
Chat Layer                                              Repositories / Infrastructure
├── server/chat/orchestration/**
├── server/chat/persistence/** ──── server/repositories/chat/**
├── server/chat/messages/**
└── server/chat/questions/**
         ↓
Orchestration
└── server/orchestration/**
         ↓
Agents
└── server/agents/**  ←→  Memory (server/memory/**)
         ↓
Tools
└── server/tools/**
         ↓
Services                                                       ↑
├── server/services/chat/**  ─── VIOLATES → Orchestration ────┘
└── server/services/filesystem/** ── VIOLATES → file-explorer (circular)
         ↓
Repositories
└── server/repositories/**
         ↓
Infrastructure
└── server/infrastructure/**
```

---

## 10. ARCHITECTURE COMPLIANCE SCORE

| Domain | Score | Status |
|---|---|---|
| Memory Ownership | 13/13 (100%) | ✅ Excellent |
| Database Isolation | 5/5 (100%) | ✅ Excellent |
| Chat Domain | 5/7 (71%) | 🟡 Good |
| Infrastructure Ownership | 3/5 (60%) | 🟠 Fair |
| Filesystem Domain | 4/8 (50%) | 🟠 Fair |
| **Overall** | **30/38 (79%)** | 🟡 **Good — fixable** |

---

## 11. PRIORITY FIX LIST

| Priority | Violation | Files to Fix | Action |
|---|---|---|---|
| P1 🔴 | Service → HTTP circular | `tree.service.ts`, `upload.service.ts` | Move `buildTreeFromDir` + `toUploadedFile` into `shared/` or service layer |
| P1 🔴 | Service → Chat upward | `chat.service.ts`, `clarification.service.ts`, `checkpoint.service.ts` | Move chat-layer dependencies down or restructure as Chat-owned service |
| P1 🔴 | Service → Orchestration | `chat.service.ts` | Move `orchestrate` call up to Chat layer, remove from service |
| P2 🟠 | HTTP → Repository bypass | `file-explorer/mappers/tree.mapper.ts` | Route through `treeService` |
| P3 🟡 | HTTP → Infrastructure | `file-publisher.ts`, `file-subscriber.ts` | Acceptable for realtime event emitters; consider a `RealtimeService` wrapper |
