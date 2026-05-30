# File Explorer Module — Deep Scan Report

**Project:** Nura-X Deployer  
**Scope:** `client/src/components/file-explorer/` aur saari related files  
**Total Files Covered:** 16

---

## Architecture Overview

```
client/src/
├── components/
│   ├── file-explorer/              ← Main module (11 files)
│   │   ├── index.ts                ← Public barrel export
│   │   ├── types.ts                ← TypeScript type definitions
│   │   ├── FileExplorer.tsx        ← Main sidebar component (live/AI-aware)
│   │   ├── FileTreePanel.tsx       ← Lightweight local-state tree panel
│   │   ├── TreeNode.tsx            ← Single tree row (file ya folder)
│   │   ├── ContextMenu.tsx         ← Right-click menu
│   │   ├── InlineInput.tsx         ← Rename/create ke liye inline input + ActionIcon
│   │   ├── FileHistoryPanel.tsx    ← File version history + diff panel
│   │   ├── file-icon.tsx           ← File type icons, lang detection, emoji icons
│   │   ├── tree-helpers.ts         ← Tree CRUD + optimistic update utilities
│   │   └── use-file-explorer.ts    ← Core state hook (realtime, dirty, AI tracking)
│   └── modals/
│       ├── files-modal.tsx         ← Full-screen file manager modal
│       └── FileTree.tsx            ← Modal ke andar tree rendering
├── hooks/
│   ├── use-file-system.ts          ← Low-level FS hook (open/save/conflict check)
│   └── useFileActions.ts           ← CRUD actions (create/upload/download/delete)
└── state/
    └── fileStatus.ts               ← Global file status store (dirty/conflict/AI)
```

---

## File-by-File Deep Scan

---

### 1. `types.ts`
**Kya karta hai:** Poore module ki TypeScript type definitions

| Type | Fields | Use |
|------|--------|-----|
| `FileNode` | id, name, type, children, content, lang | Local (in-memory) tree nodes |
| `RawTreeNode` | name, type, children, optimistic | Server se aaya hua raw tree |
| `ContextMenuState` | x, y, path, isDir (ya null) | Right-click menu position + target |

**Key point:** `FileNode` has `id` (local UUID), `RawTreeNode` does NOT — raw tree comes from API without IDs. `optimistic: true` flag batata hai ki file abhi server pe confirmed nahi hui.

---

### 2. `file-icon.tsx`
**Kya karta hai:** File type ke hisaab se icon, language, aur emoji detect karna

**Teen exported functions:**

| Function | Kya karta hai |
|----------|--------------|
| `fileIcon(name, type, open?)` | Lucide React icon return karta hai color ke saath (.tsx=blue, .ts=green, .json=yellow, .css=pink, .html=orange, .md=slate, .env=lime, images=purple) |
| `guessLang(name)` | Monaco editor ke liye language string return karta hai ("typescript", "javascript", "css", "html", "json", "markdown", "plaintext") |
| `emojiIcon(name, type)` | Emoji return karta hai (📁 folder, 🧩 tsx/jsx, 📜 ts/js, 📄 json, 🌐 html, 🎨 css, 📃 baaki) |

---

### 3. `tree-helpers.ts`
**Kya karta hai:** Tree data structure pe pure utility functions (koi side effects nahi)

| Function | Parameters | Kya karta hai |
|----------|-----------|--------------|
| `uid()` | — | Random 7-char ID generate karta hai |
| `flattenFiles(nodes, path)` | FileNode[], string | Poore tree ko flat list me convert karta hai (search ke liye) |
| `deleteNodeById(nodes, id)` | FileNode[], string | ID se node recursively delete karta hai |
| `renameNodeById(nodes, id, newName)` | FileNode[], string, string | Node rename karta hai, lang bhi update karta hai |
| `addNodeToRoot(nodes, node)` | FileNode[], FileNode | Node ko tree ke top pe add karta hai |
| `optimisticInsertFile(tree, filePath)` | RawTreeNode[], string | File create hone se pehle UI me instantly dikhata hai |
| `removeOptimisticFile(tree, filePath)` | RawTreeNode[], string | Agar file create fail ho toh optimistic entry hata deta hai |
| `makeInitialTree()` | — | Default demo project structure return karta hai (FileTreePanel ke liye) |

**Key pattern:** `optimisticInsertFile` + `removeOptimisticFile` milke "optimistic UI" implement karte hain — user ko file turant dikhti hai, server confirm kare ya fail kare uske pehle.

---

### 4. `InlineInput.tsx`
**Kya karta hai:** Do reusable micro-components export karta hai

**`InlineInput` component:**
- Jab file/folder rename ya create karo toh tree ke andar hi input field dikhata hai
- `Enter` = confirm, `Escape` = cancel, `onBlur` = auto-confirm
- Auto-select on mount (pura naam select ho jaata hai)
- Styled: purple-tint background with border

**`ActionIcon` component:**
- Pencil/Trash2/FilePlus/X jaise icon buttons ke liye wrapper
- `danger=true` ho toh red color, normal ho toh slate color
- Hover pe background highlight aata hai
- `data-testid` support for automated testing

---

### 5. `ContextMenu.tsx`
**Kya karta hai:** Right-click context menu render karta hai

- `ContextMenuState` (x, y, path, isDir) se position leta hai
- 4 actions: **New File**, **New Folder**, **Rename**, **Delete** (Delete red color me)
- `menu === null` ho toh kuch render nahi hota
- Fixed position, z-index 9999, dark theme
- `data-testid` attributes on every item

---

### 6. `TreeNode.tsx`
**Kya karta hai:** File tree ka ek single row — file ya folder — render karta hai

**Folder behavior:**
- Click pe open/close toggle (ChevronRight ↔ ChevronDown)
- Depth 0 aur 1 default se open rahte hain
- Hover pe Pencil + Trash2 action icons dikhte hain
- Rename mode me `InlineInput` dikhata hai

**File behavior:**
- Active file `rgba(124,141,255,0.12)` background se highlight hoti hai
- Hover pe Pencil + Trash2 action icons
- `fileIcon()` se colored icon milta hai
- Recursive rendering: folder ke andar `TreeNode` children

**Props:** `node`, `depth`, `activeFileName`, `onSelect`, `onDelete`, `onRename`

---

### 7. `use-file-explorer.ts`
**Kya karta hai:** File Explorer ka main brain — sari state aur realtime events manage karta hai

**State tracked:**
| State | Type | Kya track karta hai |
|-------|------|---------------------|
| `tree` | `RawTreeNode[]` | Server se aaya file tree |
| `dirtyFiles` | `Set<string>` | Unsaved changes wali files |
| `aiFiles` | `Set<string>` | AI ne jo files likhi hain |
| `writingFiles` | `Set<string>` | AI abhi likh raha hai (in-flight) |
| `writingSizes` | `Map<string,number>` | In-flight files ka byte size |
| `focusedPath` | `string\|null` | Keyboard shortcuts ke liye |
| `hoveredPath` | `string\|null` | Hover highlight |

**API calls:**
- `GET /api/list-files?projectPath=...` → file tree fetch
- `POST /api/rename-file` → rename
- `POST /api/delete-file` → delete  
- `POST /api/save-file` → save/create

**Realtime events (via SSE):**
- `"agent"` event type `"diff"` → AI ne file likhi, `aiFiles` me add, tree refresh
- `"file"` event type `"writing"` → spinner/badge dikhao, 15s safety fallback timer lagao
- `"file"` event add/change/unlink → writing state clear karo, 200ms debounce ke saath tree refresh

**Window events:**
- `file-refresh` / `explorer:refresh` → tree reload
- `file-create-failed` → optimistic entry remove karo
- `file-dirty` / `file-saved` → dirty state update
- Keyboard: `Delete` = delete, `F2` = rename, `Ctrl+S` = global save

**Key safety mechanisms:**
1. **15-second fallback timer** — agar AI writing complete event miss ho jaye toh spinner auto-clear
2. **200ms debounce** — N rapid file changes pe sirf 1 API call
3. **projectId matching** — sirf current project ke events process karo

---

### 8. `FileExplorer.tsx`
**Kya karta hai:** Main sidebar file explorer component — `use-file-explorer` hook use karta hai

**Features:**
- Server se real tree show karta hai (live, production-ready)
- Active file highlight (dark blue `#16355a`)
- Dirty files pe dot `•` badge
- AI files pe green `AI` badge
- In-flight writes pe animated purple spinner + byte size badge (CSS keyframe animations)
- Right-click → `ContextMenu` component
- Keyboard Delete/F2/Ctrl+S support

**CSS animations (module scope pe inject hoti hain):**
- `fe-writing-pulse` — spinner ka fade in/out
- `fe-writing-dots` — "writing..." animated dots
- `spin` — spinner rotation

**Props:** `projectPath`, `onSelect`, `activeFile`

**Sub-component `RenderNode`:** Recursive renderer jo folder ke andar folder ke andar file render karta hai

---

### 9. `FileTreePanel.tsx`
**Kya karta hai:** Lightweight, in-memory-only file tree panel (local state, koi API calls nahi)

**`FileExplorer.tsx` se fark:**
| | FileExplorer | FileTreePanel |
|--|-------------|--------------|
| Data source | Server API | In-memory state |
| Real-time | Haan (SSE) | Nahi |
| Use case | Live project files | Standalone IDE mode |
| Search | Nahi | Haan (inline search) |

**Features:**
- `makeInitialTree()` se demo project structure se start
- Search bar — live fuzzy filter across all files
- Inline file/folder creation with `InlineInput`
- `TreeNode` components recursively render
- `onFileOpen(name, content, lang)` callback when file selected

---

### 10. `FileHistoryPanel.tsx`
**Kya karta hai:** Kisi specific file ki version history dikhata hai

- `getFileHistory(projectId, filePath)` API call karta hai (`agent-ultra.service` se)
- Har version ka ID, author, timestamp dikhata hai
- Kisi bhi version pe click karo → `onSelectForDiff(oldText, newText)` callback fire hota hai
- Diff viewer ke saath integrate hota hai (DiffApprovalModal, DiffViewer)

**Props:** `projectId`, `filePath`, `onSelectForDiff?`

---

### 11. `index.ts`
**Kya karta hai:** Module ka public API — barrel export

```typescript
// Types
export type { FileNode, RawTreeNode, ContextMenuState }

// Utilities
export { fileIcon, guessLang, emojiIcon }
export { uid, flattenFiles, deleteNodeById, renameNodeById, addNodeToRoot, makeInitialTree }

// Components
export { InlineInput, ActionIcon }
export { TreeNode }
export { FileTreePanel }
export { ContextMenu }
export { useFileExplorer }
export { default as FileExplorer }
export { default as FileHistoryPanel }
```

---

### 12. `hooks/use-file-system.ts`
**Kya karta hai:** Low-level file system hook — direct API calls ke saath

**API endpoints use karta hai:**
| Method | Endpoint | Kya karta hai |
|--------|----------|--------------|
| GET | `/api/fs/tree` | Workspace tree fetch |
| GET | `/api/fs/file?path=...` | File content read |
| POST | `/api/fs/file` | File save |
| POST | `/api/fs/conflict-check` | SHA-256 hash se conflict detect |
| POST | `/api/fs/conflict-details` | Conflict hone pe server version fetch |

**Conflict detection flow:**
1. File open hone pe SHA-256 hash calculate karke `baseHash` store karo
2. Save karne se pehle server pe hash compare karo
3. Hash alag hai → conflict! Server content fetch karo
4. Error object throw karo `{type: "conflict", path, baseHash, serverContent, clientContent}`
5. UI ye error catch karke diff modal dikhata hai

**Returns:** `tree`, `activeFile`, `setActiveFile`, `refreshTree`, `openFile`, `saveFile`, `undoFile`, `isSaving`

---

### 13. `hooks/useFileActions.ts`
**Kya karta hai:** File manager modal ke liye CRUD operations

| Function | API Call | Kya karta hai |
|----------|----------|--------------|
| `handleNewFile` | `POST /api/files/create` | Prompt se naam lo, file create karo |
| `handleNewFolder` | `POST /api/files/create` | Prompt se naam lo, folder create karo |
| `handleUploadFiles` | `POST /api/files/upload` | Hidden `<input type=file>` se multiple files upload |
| `handleDownloadZip` | `GET /api/files/download` | Poora project ZIP me download |
| `handleDeleteFile` | `DELETE /api/files/:path` | Confirm karke file/folder delete |

Har operation ke baad `onSuccess()` callback call hota hai (list refresh ke liye).  
Har error/success pe `toast` notification dikhata hai.

---

### 14. `state/fileStatus.ts`
**Kya karta hai:** Global, framework-agnostic file status store

**Status type:**
```typescript
type Status = {
  dirty?:     boolean;  // Unsaved changes hain
  conflict?:  boolean;  // Server se conflict hai
  aiPending?: boolean;  // AI abhi likh raha hai
  timeline?:  boolean;  // Timeline me show karo
  synced?:    boolean;  // Fully saved aur synced
}
```

**Functions:**
- `getStatus(path)` → kisi file ka current status (default: `{synced: true}`)
- `setStatus(path, patch)` → partial update, sare subscribers notify karo
- `subscribeAll(cb)` → koi bhi component status changes sun sakta hai, unsubscribe function return hota hai

**Pattern:** Yeh React state ya context nahi hai — plain JS module-level singleton. Iska fayda: koi bhi file status change kar sakta hai bina React tree ke andar hue.

---

### 15. `components/modals/files-modal.tsx`
**Kya karta hai:** Full-screen file manager modal dialog

**Features:**
- `GET /api/files/list` se file list load karta hai
- `FileTree` component se tree render
- 4 action buttons: New File, New Folder, Upload, Download
- **Draggable buttons** — user button order apni marzi se change kar sakta hai (drag & drop)
- Loading spinner aur empty state handle
- `onFileOpen` callback when user koi file select kare

**Props:** `isOpen`, `onClose`, `onFileOpen?`

---

### 16. `components/modals/FileTree.tsx`
**Kya karta hai:** `files-modal.tsx` ke andar file tree render karna

*(Actual implementation file-explorer ke tree components use karti hai — modal ka presentation layer)*

---

## Data Flow Diagram

```
User Action
    │
    ▼
FileExplorer.tsx  ←──── useFileExplorer.ts (state + API + realtime)
    │                         │
    │                         ├── GET /api/list-files  (tree fetch)
    │                         ├── useRealtimeEvent("agent") → AI diff events
    │                         ├── useRealtimeEvent("file")  → write progress
    │                         └── window events (file-refresh, file-dirty, etc.)
    │
    ├── RenderNode (recursive) ← tree-helpers (optimisticInsert/remove)
    ├── ContextMenu.tsx
    └── [onSelect callback] → Parent component (editor open)


use-file-system.ts (low-level hook)
    ├── GET  /api/fs/tree
    ├── GET  /api/fs/file
    ├── POST /api/fs/file          (save)
    ├── POST /api/fs/conflict-check
    └── POST /api/fs/conflict-details


fileStatus.ts (global singleton)
    └── setStatus() / subscribeAll()
        ↑ called from anywhere (hooks, services, etc.)
```

---

## Do Alag Systems: Kyun?

Is project me file explorer ke **do versions** hain:

| System | Files | Use Case |
|--------|-------|---------|
| **Live System** | `FileExplorer.tsx` + `use-file-explorer.ts` | Production use — server se real-time file tree, AI write tracking, SSE events |
| **Local System** | `FileTreePanel.tsx` + `TreeNode.tsx` | Standalone/demo mode — in-memory state, koi API dependency nahi, search feature |

Dono same `InlineInput`, `ActionIcon`, `fileIcon`, `tree-helpers`, aur `types` share karte hain.

---

## Summary Table

| File | Category | Lines | Complexity |
|------|----------|-------|------------|
| `types.ts` | Types | 23 | ⭐ Low |
| `file-icon.tsx` | Utility | 50 | ⭐ Low |
| `tree-helpers.ts` | Utility | 119 | ⭐⭐ Medium |
| `InlineInput.tsx` | UI Component | 70 | ⭐ Low |
| `ContextMenu.tsx` | UI Component | 48 | ⭐ Low |
| `TreeNode.tsx` | UI Component | 117 | ⭐⭐ Medium |
| `use-file-explorer.ts` | State/Logic Hook | 216 | ⭐⭐⭐ High |
| `FileExplorer.tsx` | UI Component | 247 | ⭐⭐⭐ High |
| `FileTreePanel.tsx` | UI Component | 147 | ⭐⭐ Medium |
| `FileHistoryPanel.tsx` | UI Component | 55 | ⭐ Low |
| `index.ts` | Barrel Export | 10 | ⭐ Low |
| `use-file-system.ts` | FS Hook | 191 | ⭐⭐⭐ High |
| `useFileActions.ts` | Actions Hook | 103 | ⭐⭐ Medium |
| `fileStatus.ts` | Global State | 27 | ⭐ Low |
| `files-modal.tsx` | Modal Component | 111 | ⭐⭐ Medium |
| `FileTree.tsx` (modal) | UI Component | — | ⭐ Low |

---

*Report generated by deep scan of Nura-X Deployer workspace*
