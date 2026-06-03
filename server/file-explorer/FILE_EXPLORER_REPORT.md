# server/file-explorer/ — Deep Scan Report

## Folder Structure

```
server/file-explorer/
├── index.ts                              # Public entry point — routers & watchers export
│
├── config/
│   └── index.ts                          # FE_CONFIG: sandboxRoot, excluded patterns, file size limits
│
├── contracts/
│   └── index.ts                          # Shared TS interfaces: har Request/Response ka type contract
│
├── types/
│   └── index.ts                          # Internal domain types: filesystem nodes, metadata
│
├── routes/
│   ├── index.ts                          # Routes barrel export
│   └── file-explorer.routes.ts           # Express routers define karta hai:
│                                         #   fileExplorerRouter  → /api/file-explorer/*
│                                         #   legacyFileRouter    → /api/list-files, /api/save-file etc.
│
├── controllers/
│   ├── index.ts                          # Controller barrel export
│   └── file-explorer.controller.ts       # HTTP adapter: request parse → guard → orchestrator → JSON response
│                                         # (koi business logic nahi)
│
├── orchestrator/
│   ├── index.ts                          # Orchestrator barrel export
│   └── explorer.orchestrator.ts          # Module ka "brain": high-level ops coordinate karta hai
│                                         # (history snapshot → service call → event trigger)
│
├── guards/
│   └── index.ts                          # Runtime checks: path traversal prevention, upload assertions
│
├── validators/
│   ├── index.ts                          # Validators barrel export
│   ├── create.validator.ts               # File/folder create request validation
│   ├── delete.validator.ts               # Delete request validation
│   ├── rename.validator.ts               # Rename request validation
│   └── upload.validator.ts               # File upload validation
│
├── mappers/
│   ├── index.ts                          # Mappers barrel export
│   ├── tree.mapper.ts                    # Raw fs stats → RawTreeNode (frontend tree component format)
│   └── file.mapper.ts                    # File metadata + content → contract-compliant shape
│
├── realtime/
│   ├── index.ts                          # Realtime barrel export
│   ├── file-publisher.ts                 # SSE publish karta hai: created/modified/writing events → TOPIC.FILE
│   ├── file-events.service.ts            # Internal operation results → public SSE events mapping
│   └── file-subscriber.ts               # Agent file-change events subscribe karta hai
│
├── watchers/
│   ├── index.ts                          # Watchers barrel export
│   ├── file-watcher.service.ts           # chokidar se .sandbox/ monitor karta hai (external changes)
│   └── directory-watcher.service.ts      # Directory structure changes ke liye specialized watcher
│
└── tests/
    ├── index.ts                          # Tests barrel
    ├── read.service.test.ts              # Read service unit tests
    ├── rename.service.test.ts            # Rename service unit tests
    ├── tree.service.test.ts              # Tree service unit tests
    └── write.service.test.ts             # Write service unit tests
```

---

## Har File Ka Kaam

| File | Kaam |
|---|---|
| `index.ts` | `fileExplorerRouter`, `legacyFileRouter`, `startFileWatcher`, `startDirectoryWatcher`, `subscribeToAgentFileEvents` export karta hai |
| `config/index.ts` | `FE_CONFIG` — sandboxRoot path, `node_modules` jaise excluded folders, max file size |
| `contracts/index.ts` | Har operation ka Request/Response interface — controller aur orchestrator ke beech type safety |
| `types/index.ts` | `FileNode`, `TreeNode`, metadata jaise internal domain types |
| `routes/file-explorer.routes.ts` | Do routers: canonical (`/api/file-explorer/*`) aur legacy (`/api/list-files`, `/api/save-file` etc.) |
| `controllers/file-explorer.controller.ts` | Request body parse, guard call, orchestrator invoke, response format — sirf adapter |
| `orchestrator/explorer.orchestrator.ts` | High-level flow coordinate karta hai: snapshot → service → event |
| `guards/index.ts` | `../../../` jaise path traversal attacks rok ta hai, upload validations |
| `validators/*.ts` | Create / delete / rename / upload requests ka schema validate karta hai |
| `mappers/tree.mapper.ts` | `fs.statSync` results → nested `RawTreeNode` tree (frontend ke liye) |
| `mappers/file.mapper.ts` | File content + stats → typed response object |
| `realtime/file-publisher.ts` | `sseManager` ke zariye `TOPIC.FILE` pe SSE events broadcast karta hai |
| `realtime/file-events.service.ts` | Operation result (`writeOk`, `renamed`) → SSE event type map karta hai |
| `realtime/file-subscriber.ts` | Agent ke file events sun ta hai aur publisher ko forward karta hai |
| `watchers/file-watcher.service.ts` | `chokidar` se `.sandbox/` watch karta hai, debounce ke baad SSE fire karta hai |
| `watchers/directory-watcher.service.ts` | Directory add/remove ke liye dedicated watcher |
| `tests/*.test.ts` | Read, write, rename, tree services ke unit tests |

---

## Module Connections (Kaun Kisse Baat Karta Hai)

```
main.ts
  ├── /api/file-explorer/*  →  fileExplorerRouter
  └── /api/*                →  legacyFileRouter
         │
         ▼
  file-explorer.routes.ts
         │
         ▼
  file-explorer.controller.ts  ←  guards/  ←  validators/
         │
         ▼
  explorer.orchestrator.ts
         ├──► server/services/filesystem/   (treeService, writeService, readService…)
         │         │
         │         ▼
         │    server/repositories/file-system/   (raw fs + history storage)
         │
         └──► realtime/file-events.service.ts
                    │
                    ▼
             realtime/file-publisher.ts
                    │
                    ▼
             server/infrastructure/sseManager  →  Frontend (SSE stream)

watchers/file-watcher.service.ts  (chokidar)
  └──► realtime/file-publisher.ts  →  sseManager  →  Frontend

server/agents/*  →  realtime/file-subscriber.ts  →  file-publisher.ts
```

---

## Runtime Workflow — End-to-End

### 1. File Tree Load — `GET /api/list-files`

```
Frontend request
  └── legacyFileRouter → controller.listFiles()
        └── guard: path traversal check
              └── orchestrator.getTree(sandboxRoot)
                    └── treeService.buildTree()
                          └── fs.readdirSync() + tree.mapper.ts
                                └── RawTreeNode[] → JSON response
```

### 2. File Save — `POST /api/save-file`

```
Frontend: { filePath, content }
  └── legacyFileRouter → controller.writeFile()
        └── validators/create.validator.ts → body validate
              └── guard: path traversal check
                    └── orchestrator.writeFile()
                          ├── historyService.snapshotBeforeWrite()   ← backup pehle
                          ├── writeService.saveFile()                ← atomic disk write
                          └── fileEventsService.onModified()
                                └── file-publisher.ts
                                      └── sseManager.broadcast(TOPIC.FILE, { event: 'modified' })
                                            └── Frontend tree auto-refresh
                                                  │
                                    (parallel) chokidar bhi detect karta hai change
                                      └── file-watcher → debounce → file-publisher (fallback)

Response: { ok: true }
```

### 3. File Read — `GET /api/read-file?path=...`

```
Frontend: ?path=src/index.ts
  └── legacyFileRouter → controller.readFile()
        └── guard: path check
              └── orchestrator.readFile()
                    └── readService.read()
                          └── fs.readFileSync() + file.mapper.ts
                                └── { content, language, size } → JSON response
```

### 4. File Rename — `POST /api/rename-file`

```
Frontend: { oldPath, newPath }
  └── legacyFileRouter → controller.renameFile()
        └── validators/rename.validator.ts
              └── orchestrator.renameFile()
                    ├── renameService.rename()  ← fs.renameSync()
                    └── fileEventsService.onRenamed()
                          └── file-publisher → SSE broadcast → Frontend tree update
```

### 5. Agent File Change (Realtime)

```
AI Agent writes a file
  └── emitFileChange() [server/infrastructure]
        └── bus.emit('file.change', { path, type })
              └── file-subscriber.ts listening
                    └── file-publisher.publishWriting(path)
                          └── sseManager → TOPIC.FILE
                                └── Frontend: "Agent is typing..." indicator in file tree
```

### 6. External Change (Terminal / Git)

```
User ya git command se file badli
  └── chokidar detects change in .sandbox/
        └── file-watcher.service.ts
              └── debounce (300ms)
                    └── file-publisher.publishModified(path)
                          └── sseManager → TOPIC.FILE → Frontend auto-refresh
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    server/file-explorer/                     │
│                                                             │
│  Routes → Controller → Guards/Validators                    │
│                │                                            │
│                ▼                                            │
│          Orchestrator  ──►  Services  ──►  Repository (fs)  │
│                │                                            │
│                ▼                                            │
│         Realtime Layer  ──►  SSE Manager  ──►  Frontend     │
│                                                             │
│  Watchers (chokidar) ──────────────────►  SSE Manager       │
│  Agent Events (bus)  ──────────────────►  SSE Manager       │
└─────────────────────────────────────────────────────────────┘
```

**Storage:** `.sandbox/` directory (configurable via `AGENT_PROJECT_ROOT`)
**Realtime:** SSE via `TOPIC.FILE` — tree auto-updates without page refresh
**Safety:** Path traversal guards, atomic writes, history snapshots before every save
**Watchers:** chokidar ensures external changes (git, terminal) bhi sync hote hain
