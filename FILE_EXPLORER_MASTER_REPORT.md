# FILE EXPLORER MASTER REPORT
> Complete reverse-engineering of `client/src/components/file-explorer/`  
> Generated: 2026-05-31 | Total LOC: 2 341 across 18 files

---

## TABLE OF CONTENTS

1. [Complete Architecture Overview](#1-complete-architecture-overview)
2. [File Inventory](#2-file-inventory)
3. [Component Responsibility Map](#3-component-responsibility-map)
4. [UI Flow Analysis](#4-ui-flow-analysis)
5. [State Flow Analysis](#5-state-flow-analysis)
6. [UX Audit](#6-ux-audit)
7. [AI IDE Audit](#7-ai-ide-audit)
8. [Replit Comparison](#8-replit-comparison)
9. [VS Code Comparison](#9-vs-code-comparison)
10. [Cursor Comparison](#10-cursor-comparison)
11. [Missing Features — Gap Analysis](#11-missing-features--gap-analysis)
12. [Technical Debt](#12-technical-debt)
13. [Recommended Roadmap](#13-recommended-roadmap)

---

## 1. COMPLETE ARCHITECTURE OVERVIEW

### Dual-Explorer Architecture

There are **two completely separate explorer implementations** living side by side:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FILE EXPLORER SYSTEM                             │
│                                                                         │
│  ┌──────────────────────────┐     ┌──────────────────────────────────┐  │
│  │   FileExplorer.tsx       │     │   FileTreePanel.tsx              │  │
│  │   (Real Sandbox Explorer)│     │   (In-Memory Demo Explorer)      │  │
│  │                          │     │                                  │  │
│  │  ▸ Data: RawTreeNode[]   │     │  ▸ Data: FileNode[]             │  │
│  │  ▸ Source: Backend API   │     │  ▸ Source: in-memory state      │  │
│  │  ▸ Menu: right-click     │     │  ▸ Menu: hover 3-dot button     │  │
│  │  ▸ Writes: API calls     │     │  ▸ Writes: setState             │  │
│  │  ▸ Realtime: SSE events  │     │  ▸ Realtime: none               │  │
│  │  ▸ Used by: unified-grid │     │  ▸ Used by: CenterPanel         │  │
│  └──────────────────────────┘     └──────────────────────────────────┘  │
│            │                                    │                        │
│            ▼                                    ▼                        │
│     useFileExplorer()                      TreeNode.tsx                 │
│     ContextMenu.tsx                        TreeNodeMenu.tsx             │
│     OpenEditorsPanel.tsx                   InlineInput.tsx              │
│     AgentStatusPanel.tsx                   tree-helpers.ts              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Shared Infrastructure (used by both)

```
types.ts          — Type contracts
file-icon.tsx     — Icon mapping + language guessing
InlineInput.tsx   — Inline rename / create input
use-open-editors  — localStorage open-editor list
use-recent-files  — localStorage recent-files list
use-agent-status  — Realtime agent heartbeat
tree-helpers.ts   — Pure tree mutation utilities
```

### Data Flow Summary

```
Backend API ──────► useFileExplorer ──► FileExplorer ──► RenderNode
SSE Stream  ──────► useRealtimeEvent     (sidebar)        (recursive)
                                                │
                                         ContextMenu
                                         OpenEditorsPanel
                                         AgentStatusPanel

In-memory ────────► FileTreePanel ──────► TreeNode
makeInitialTree()   (panel)               (recursive)
                                          TreeNodeMenu (portal)
```

---

## 2. FILE INVENTORY

| # | File | Purpose | LOC | Key Exports |
|---|---|---|---|---|
| 1 | `types.ts` | Type contracts | 22 | FileNode, RawTreeNode, ContextMenuState |
| 2 | `index.ts` | Barrel re-exports | 18 | All 18 exports |
| 3 | `tree-helpers.ts` | Pure tree utilities | 136 | uid, flattenFiles, deleteNodeById, renameNodeById, addNodeToRoot, addNodeInsideFolder, optimisticInsertFile, removeOptimisticFile, makeInitialTree |
| 4 | `file-icon.tsx` | Icon + lang mapping | 49 | fileIcon, guessLang, emojiIcon |
| 5 | `InlineInput.tsx` | Inline text input | 79 | InlineInput, ActionIcon |
| 6 | `use-recent-files.ts` | Recent files store | 33 | useRecentFiles |
| 7 | `use-open-editors.ts` | Open editors store | 45 | useOpenEditors |
| 8 | `use-agent-status.ts` | Agent heartbeat | 69 | useAgentStatus, AgentStatus, AgentId, AgentState |
| 9 | `AIActivityBadge.tsx` | Animated activity badge | 36 | AIActivityBadge |
| 10 | `AgentStatusPanel.tsx` | Agent status sidebar panel | 92 | AgentStatusPanel |
| 11 | `OpenEditorsPanel.tsx` | Open editors sidebar panel | 110 | OpenEditorsPanel |
| 12 | `FileHistoryPanel.tsx` | File version history | 55 | FileHistoryPanel (default) |
| 13 | `ContextMenu.tsx` | Right-click context menu | 88 | ContextMenu |
| 14 | `TreeNodeMenu.tsx` | Hover 3-dot node menu | 178 | TreeNodeMenu |
| 15 | `TreeNode.tsx` | Recursive tree node | 213 | TreeNode |
| 16 | `use-file-explorer.ts` | Main explorer hook | 216 | useFileExplorer |
| 17 | `FileExplorer.tsx` | Real sandbox explorer | 490 | FileExplorer (default) |
| 18 | `FileTreePanel.tsx` | In-memory demo explorer | 412 | FileTreePanel |

### Dependency Graph

```
FileExplorer.tsx
  ├── useFileExplorer (use-file-explorer.ts)
  │     ├── types.ts
  │     ├── tree-helpers.ts (optimisticInsertFile, removeOptimisticFile)
  │     └── @/realtime/useRealtimeStream
  ├── useOpenEditors (use-open-editors.ts)
  ├── useRecentFiles (use-recent-files.ts)
  ├── OpenEditorsPanel (OpenEditorsPanel.tsx)
  │     └── file-icon.tsx
  ├── AgentStatusPanel (AgentStatusPanel.tsx)
  │     └── useAgentStatus (use-agent-status.ts)
  │           └── @/realtime/useRealtimeStream
  ├── ContextMenu (ContextMenu.tsx)
  │     └── types.ts
  ├── InlineInput (InlineInput.tsx)
  └── file-icon.tsx

FileTreePanel.tsx
  ├── TreeNode (TreeNode.tsx)
  │     ├── file-icon.tsx
  │     ├── InlineInput.tsx
  │     └── TreeNodeMenu (TreeNodeMenu.tsx)
  │           └── types.ts
  ├── InlineInput.tsx
  ├── file-icon.tsx
  └── tree-helpers.ts

FileHistoryPanel.tsx
  └── ../../services/agent-ultra.service (external)
```

---

## 3. COMPONENT RESPONSIBILITY MAP

### `FileExplorer.tsx` — Real Sandbox Explorer
- **What it does**: Renders the resizable sidebar explorer for a real project sandbox. Fetches file tree from `/api/list-files`, shows AI writing indicators, dirty-file dots, fuzzy search with highlight, right-click context menu, inline file/folder creation, Open Editors panel, Agent Status panel.
- **When it renders**: When a project is active in the workspace; mounted inside `unified-grid.tsx`.
- **Who calls it**: `unified-grid.tsx`
- **UI responsibility**: Sidebar layout, resize handle (160–480px), header with file/folder count, search bar, tree scroll area, empty state.
- **UX responsibility**: File selection → triggers editor open; right-click → context menu; keyboard Delete/F2/Ctrl+S forwarded via window events.
- **State**: `contextMenu`, `searchQuery`, `creating`, `width` — all local. Tree state owned by `useFileExplorer`.
- **AI features**: Writing indicator (pulsing blue border + byte size badge), AI-written badge (green "AI" pill), Agent Status panel at bottom.

### `FileTreePanel.tsx` — In-Memory Demo Explorer
- **What it does**: Standalone file explorer panel backed entirely by React state (no backend). Supports upload-folder (webkitdirectory), download-as-zip (JSZip), show/hide hidden files, collapse-all, inline create at root or inside folder. Header has 3-dot dropdown menu with 8 panel-level actions.
- **When it renders**: When user opens the Files panel inside the IDE's center column (`CenterPanel.tsx`).
- **Who calls it**: `CenterPanel.tsx`
- **UI responsibility**: Panel layout, search bar + 3-dot dropdown, inline create row, tree scroll area, empty state with quick-action buttons.
- **UX responsibility**: File open → calls `onFileOpen` prop; tree state is ephemeral (lost on unmount); supports folder upload from disk.
- **State**: `tree`, `searchQuery`, `creatingFile`, `creatingFolder`, `showMenu`, `showHidden`, `collapseRevision` — all local.
- **AI features**: None (no realtime connection).

### `TreeNode.tsx` — Recursive Tree Node
- **What it does**: Renders a single file or folder row inside `FileTreePanel`. Manages hover state, open/close toggle, inline rename (InlineInput), inline create inside folder (InlineInput), hover 3-dot button (opens TreeNodeMenu), collapse propagation via `collapseRevision` counter.
- **When it renders**: Once per visible node in `FileTreePanel`; recursively for children.
- **Who calls it**: `FileTreePanel` (root nodes), itself (children).
- **UI responsibility**: Row with indent, chevron, icon, name, 3-dot button; inline input overlay; recursive children.
- **UX responsibility**: Click → `onSelect`; hover → show dot button; dot click → TreeNodeMenu; rename → InlineInput; create inside → InlineInput child row.
- **State**: `open`, `renaming`, `hovered`, `creatingInside`, `localCollapse`, `menu` — all local.

### `TreeNodeMenu.tsx` — Hover 3-Dot Popup Menu
- **What it does**: Portal-rendered (document.body) popup menu for a file or folder node. 10 items for folders (Rename, Search dir, Add file, Add folder, Collapse children, Open shell, Copy path, Copy link, Download zip, Delete), 7 items for files (folder-only items hidden). Closes on outside click or Escape. Flips upward if near bottom of viewport.
- **When it renders**: When user clicks the ⋯ button on a hovered TreeNode.
- **Who calls it**: `TreeNode`
- **UI responsibility**: Fixed-position popup, min-width 208px, portal mount on `document.body`.
- **UX responsibility**: Each item fires a callback + closes menu. Shell and search dispatch window CustomEvents. Download uses dynamic `import("jszip")`.

### `ContextMenu.tsx` — Right-Click Context Menu
- **What it does**: Right-click context menu for `FileExplorer`. 7 items: New File, New Folder, Rename, Duplicate (stub), Copy Path, Copy Relative Path, Delete. Has a fixed backdrop div to capture outside clicks.
- **When it renders**: On right-click of any file or folder in `FileExplorer`.
- **Who calls it**: `FileExplorer`
- **Gap**: Duplicate action is a no-op (`onClick: () => {}`). No portal — renders inside explorer div.

### `useFileExplorer.ts` — Core Explorer Hook
- **What it does**: Owns all async state for `FileExplorer`. Fetches tree from `/api/list-files`. Tracks dirty files (file-dirty/file-saved window events), AI-written files (SSE agent events), in-flight write files (SSE file events with 15s safety fallback), writing byte sizes. Debounces tree refresh (200ms). Provides API helpers: `apiSaveFile`, `apiRenameFile`, `apiDeleteFile`, `handleRenamePath`, `handleDeletePath`. Handles keyboard: Delete, F2, Ctrl+S.
- **Realtime**: Subscribes to `"agent"` events (diff → mark AI file, refresh tree) and `"file"` events (writing → show indicator, done → coalesced tree refresh).

### `use-agent-status.ts` — Agent Heartbeat Hook
- **What it does**: Maintains state for 6 agents (planner, executor, verifier, supervisor, browser, filesystem). Subscribes to SSE `"agent"` events (agent:start → running, agent:done → completed → idle after 3s, agent:error → error → idle after 5s, diff → executor running briefly) and `"lifecycle"` events (run:start → planner running, run:complete → all idle, run:error → planner error).

### `use-open-editors.ts` — Open Editors Store
- **What it does**: localStorage-backed list of open file paths (max 12). `openFile` prepends and deduplicates. `closeFile` removes by path. `closeAll` clears. Persists across page refresh.

### `use-recent-files.ts` — Recent Files Store
- **What it does**: localStorage-backed list of recently opened files (max 8). Same prepend-dedup pattern as open editors. Only records paths that look like files (have an extension).

### `OpenEditorsPanel.tsx` — Open Editors Sidebar Section
- **What it does**: VS Code-style "OPEN EDITORS" section above the file tree. Shows up to 12 open files with file icon, name, active highlight (blue left border), hover X button to close, "Close All" X in header. Hidden when no files open.
- **Note**: Only wired to `FileExplorer`, not `FileTreePanel`.

### `AgentStatusPanel.tsx` — Agent Status Sidebar Section
- **What it does**: Collapsible "AGENTS" section at the bottom of `FileExplorer` sidebar. Shows 6 agent rows with pulsing color dot (idle = dim, running = blue pulse, error = red, completed = green). Shows active count badge. Collapses to header-only by default.

### `AIActivityBadge.tsx` — Activity Kind Badge
- **What it does**: Small animated badge showing AI activity kind (Creating/Editing/Reading/Analyzing/Refactoring) with pulsing dot. Used for per-file AI status indication. **Not currently wired into any explorer tree row** — exported but unused in the tree.

### `FileHistoryPanel.tsx` — File Version History
- **What it does**: Shows file version history from `getFileHistory()` API. Click to diff adjacent versions. Uses `any[]` for history type. **Not integrated into FileExplorer or FileTreePanel** — exists as standalone component.

### `InlineInput.tsx` — Shared Inline Input
- **What it does**: Single-line text input for inline rename/create. Auto-selects existing value on mount. Enter → confirm, Escape → cancel, blur → confirm if non-empty. Blue focus ring styling.
- **ActionIcon**: Small 20×20 icon button with hover highlight, danger variant.

### `file-icon.tsx` — Icon + Language Mapping
- **What it does**: Maps file extension → lucide React icon with color. Maps name → language string for editor. Emoji fallback for non-React contexts. Covers: tsx/jsx (blue), ts/js (green), json (yellow), css (pink), html (orange), md (slate), .env (lime), images (purple), default (gray).

### `tree-helpers.ts` — Pure Tree Utilities
- **What it does**: All tree mutation as pure functions (immutable, return new arrays).
  - `uid()` — random 7-char ID
  - `flattenFiles()` — recursively flatten to `{node, path}[]`
  - `deleteNodeById()` — recursive delete by ID
  - `renameNodeById()` — recursive rename + re-guess lang
  - `addNodeToRoot()` — prepend to root
  - `addNodeInsideFolder()` — insert as first child of matching folder ID
  - `optimisticInsertFile()` — insert optimistic placeholder for file path
  - `removeOptimisticFile()` — remove optimistic placeholder
  - `makeInitialTree()` — generate a demo FileNode tree with realistic content

---

## 4. UI FLOW ANALYSIS

### Explorer Load
```
App mounts unified-grid
  → FileExplorer mounts with projectPath
  → useFileExplorer runs useEffect([projectPath])
  → fetch /api/list-files?projectPath=...
  → setTree(response.tree)
  → RenderNode recursively renders tree
  → Folders at depth < 2 start open
```

### Search
**FileExplorer (real):**
```
User types in search input → setSearchQuery
  → RenderNode receives searchQuery prop
  → Files: if name !includes query → return null
  → Folders: always shown (so hierarchy is visible)
  → Matching chars wrapped in <span color="#fbbf24">
```

**FileTreePanel (in-memory):**
```
User types → setSearchQuery → sq derived
  → flattenFiles(tree).filter(path.includes(sq))
  → Shows flat list of matching files (no folder hierarchy)
  → Two-line rows: filename + parent path
```

### Open File
**FileExplorer:**
```
Click file row
  → setFocusedPath(full)
  → useOpenEditors.openFile(path)   [prepend to open editors list]
  → useRecentFiles.recordOpen(path) [prepend to recent files list]
  → selectHandler(path)             [prop callback → parent opens editor]
```

**FileTreePanel:**
```
Click TreeNode file
  → onSelect(node)
  → onFileOpen(name, content, lang) [prop callback → CenterPanel opens editor]
```

### Rename
**FileExplorer (real):**
```
Right-click → ContextMenu → "Rename"
  → window.prompt("Rename to:", oldName)
  → fetch POST /api/rename-file { oldPath, newPath }
  → refreshFiles(newPath) → optimistic insert + loadTree()
```

**FileTreePanel (in-memory):**
```
Hover TreeNode → click ⋯ → TreeNodeMenu → "Rename"
  → setRenaming(true)
  → InlineInput renders with current name, auto-selected
  → Enter → onRename(id, newName)
  → renameNodeById(tree, id, newName) + re-guesses lang
```

### Delete
**FileExplorer (real):**
```
Right-click → ContextMenu → "Delete"
  → window.confirm("Delete this file/folder?")
  → fetch POST /api/delete-file { targetPath }
  → refreshFiles()
```

**FileTreePanel (in-memory):**
```
Hover → ⋯ → TreeNodeMenu → "Delete"
  → window.confirm(`Delete "${node.name}"?`)
  → onDelete(node.id) → deleteNodeById(tree, id)
```

### Create File
**FileExplorer:**
```
Header "+" button OR context menu "New File"
  → setCreating("file")
  → InlineCreateRow renders at top of tree
  → Confirm → createFile(name) → fetch POST /api/save-file
  → refreshFiles(full) [optimistic + reload]
```

**FileTreePanel (root):**
```
Header 3-dot → "New file"
  → setCreatingFile(true)
  → InlineInput row at top of tree
  → Confirm → handleNewFile(name) → addNodeToRoot(tree, node)
  → onFileOpen(name, "", lang)
```

**FileTreePanel (inside folder via TreeNodeMenu):**
```
Hover folder → ⋯ → "Add file"
  → TreeNode: setOpen(true); setCreating("file")
  → InlineInput row renders as first child of open folder
  → Confirm → onCreateInside("file", name, parentId)
  → addNodeInsideFolder(tree, parentId, node)
  → onFileOpen(name, "", lang)
```

### Context Menu
**FileExplorer:**
```
onContextMenu on any row → openCtx(e, path, isDir)
  → setContextMenu({ x, y, path, isDir })
  → ContextMenu renders at mouse position
  → Outside click on explorer div → closeCtx()
```

**FileTreePanel (TreeNodeMenu):**
```
Hover any TreeNode → ⋯ button visible
  → openMenu(e) → getBoundingClientRect() → setMenu({x, y})
  → TreeNodeMenu portal-renders on document.body
  → 50ms delay before outside-click listener registers
  → Escape or outside mousedown → onClose → setMenu(null)
```

### Expand / Collapse Folder
**FileExplorer:**
```
Click folder row → setOpen(v => !v) [local state in RenderNode]
```

**FileTreePanel:**
```
Click folder row → setOpen(v => !v) [local state in TreeNode]
Panel-level "Collapse all" → setCollapseRevision(v => v+1)
  → passed as prop → all TreeNodes useEffect → setOpen(false)
TreeNodeMenu "Collapse child folders" → setLocalCollapse(v => v+1)
  → added to collapseRevision passed to children only
```

### Realtime Update (FileExplorer only)
```
SSE "file" event: { type: "writing", path, size }
  → setWritingFiles(add path)
  → setWritingSizes(add path → size)
  → Show pulsing rfe-badge + byte count on file row
  → 15s safety fallback to clear if completion missed

SSE "file" event: { type: "add" | "change" | "unlink", path }
  → Cancel safety timer
  → Clear writingFiles, writingSizes for path
  → Debounce 200ms → loadTree() [single fetch after burst]

SSE "agent" event: { type: "diff", diff.path }
  → setAiFiles(add path) [green AI pill on row]
  → refreshFiles() [reload tree]
```

### History View
```
FileHistoryPanel — standalone, not integrated into either explorer
Consumer must mount it separately with { projectId, filePath }
Calls getFileHistory() → renders version list
Click (i > 0) → onSelectForDiff(older.content, newer.content)
```

---

## 5. STATE FLOW ANALYSIS

### FileExplorer State Map

```
useFileExplorer (hook)
├── tree: RawTreeNode[]            ← API fetch, SSE refresh
├── dirtyFiles: Set<string>        ← window "file-dirty" / "file-saved" events
├── aiFiles: Set<string>           ← SSE agent "diff" events
├── writingFiles: Set<string>      ← SSE file "writing" events
├── writingSizes: Map<string,num>  ← SSE file "writing" events
├── focusedPath: string|null       ← click, keyboard
└── hoveredPath: string|null       ← mouse enter/leave

FileExplorer (component)
├── contextMenu: {x,y,path,isDir}|null  ← right-click
├── searchQuery: string                 ← input
├── creating: "file"|"folder"|null      ← header buttons
└── width: number                       ← drag resize → localStorage

useOpenEditors
└── openFiles: string[]                 ← localStorage "nura-x:open-editors"

useRecentFiles
└── recentFiles: string[]               ← localStorage "nura-x:recent-files"
```

### FileTreePanel State Map

```
FileTreePanel (component)
├── tree: FileNode[]                    ← in-memory, starts empty
├── searchQuery: string                 ← input
├── creatingFile: boolean               ← header 3-dot menu
├── creatingFolder: boolean             ← header 3-dot menu
├── showMenu: boolean                   ← header 3-dot button
├── showHidden: boolean                 ← 3-dot → toggle
└── collapseRevision: number            ← 3-dot → collapse all

TreeNode (per-node)
├── open: boolean                       ← defaults depth < 2
├── renaming: boolean                   ← TreeNodeMenu → Rename
├── hovered: boolean                    ← mouse enter/leave
├── creatingInside: "file"|"folder"|null ← TreeNodeMenu → Add file/folder
├── localCollapse: number               ← TreeNodeMenu → Collapse children
└── menu: {x,y}|null                    ← ⋯ button click
```

### Props Flow

```
FileExplorer
  Props IN:  projectPath, onSelect?, onFileSelect?, activeFile?
  Props OUT: (callbacks) → parent opens editor, nothing else

FileTreePanel
  Props IN:  onFileOpen(name, content, lang), onClose(), activeFileName?
  Props OUT: (callbacks) → parent opens editor, parent closes panel

TreeNode
  Props IN:  node, depth, activeFileName, onSelect, onDelete, onRename,
             onCreateInside?, collapseRevision?, showHidden?, path?
  Props OUT: callbacks propagated from FileTreePanel
```

### Realtime Events (SSE)

| Event Type | Sub-type | Handler | Effect |
|---|---|---|---|
| `"agent"` | `diff` | useFileExplorer | aiFiles ← path, refreshFiles() |
| `"agent"` | `agent:start` | useAgentStatus | agents ← running |
| `"agent"` | `agent:done` | useAgentStatus | agents ← completed → idle (3s) |
| `"agent"` | `agent:error` | useAgentStatus | agents ← error → idle (5s) |
| `"file"` | `writing` | useFileExplorer | writingFiles/Sizes ← path, 15s fallback |
| `"file"` | `add/change/unlink` | useFileExplorer | clear writing, debounced tree refresh |
| `"lifecycle"` | `run:start` | useAgentStatus | planner ← running |
| `"lifecycle"` | `run:complete` | useAgentStatus | all ← idle |
| `"lifecycle"` | `run:error` | useAgentStatus | planner ← error |

### Window Events

| Event | Direction | Purpose |
|---|---|---|
| `file-refresh` | dispatch → listen | Manual tree reload trigger |
| `file-create-failed` | dispatch → listen | Remove optimistic file |
| `explorer:refresh` | dispatch → listen | External refresh trigger |
| `file-dirty` | dispatch → listen | Mark file modified (unsaved) |
| `file-saved` | dispatch → listen | Clear dirty mark |
| `global-save` | dispatch | Ctrl+S → parent saves |
| `shell:open` | dispatch | TreeNodeMenu → shell panel |
| `explorer:search-dir` | dispatch | TreeNodeMenu → search in dir |

### localStorage Keys

| Key | Hook | Max | Purpose |
|---|---|---|---|
| `nura-x:open-editors` | useOpenEditors | 12 files | Open editor tabs |
| `nura-x:recent-files` | useRecentFiles | 8 files | Recent files list |
| `nura-x:explorer-width` | FileExplorer | 160–480px | Sidebar width |

---

## 6. UX AUDIT

### 6.1 Spacing and Density

| Metric | FileExplorer | FileTreePanel | Rating |
|---|---|---|---|
| Row height | 20px | 22px | **Good** |
| Font size | 12px | 12px | **Good** |
| Indent per level | 14px | 16px | **Good** |
| Icon size | 13px | 13px | **Good** |
| Header height | 32px | 36px | **Average** (slightly tall) |
| Overall density | VS Code-like | Slightly looser | **Good** |

**Rating: Good**

### 6.2 Hierarchy

- Indentation guides exist in `FileExplorer` (1px vertical lines per depth level). ✅
- `FileTreePanel` / `TreeNode` has no indent guides — only indentation. ⚠️
- Folder chevron (▶/▼) + colored folder icon gives good visual hierarchy. ✅
- Active file: blue left border + darker background. ✅

**Rating: Good**

### 6.3 Discoverability

- New File / New Folder buttons in header toolbar. ✅
- Empty state has quick-action buttons. ✅
- Hover-only 3-dot button (⋯) is hard to discover — no hint it exists. ⚠️
- Right-click context menu in `FileExplorer` — not discoverable without trying. ⚠️
- No tooltip on file/folder rows explaining available actions. ❌

**Rating: Average**

### 6.4 Accessibility

- No `role="tree"`, `role="treeitem"` on rows. ❌
- No `aria-expanded` on folder rows. ❌
- No `aria-selected` on active file. ❌
- No keyboard navigation (arrow keys to move focus between items). ❌
- Tab focus does not traverse tree items. ❌
- F2 and Delete work but only for `focusedPath` in `FileExplorer`. Partial. ⚠️

**Rating: Poor**

### 6.5 Keyboard Navigation

| Action | FileExplorer | FileTreePanel |
|---|---|---|
| F2 to rename | ✅ (focusedPath) | ❌ |
| Delete to delete | ✅ (focusedPath) | ❌ |
| Ctrl+S global save | ✅ | ❌ |
| Arrow keys (navigate) | ❌ | ❌ |
| Enter to open | ❌ | ❌ |
| Escape to cancel | ✅ (InlineInput) | ✅ (InlineInput) |

**Rating: Poor**

### 6.6 Search UX

| Feature | FileExplorer | FileTreePanel |
|---|---|---|
| Fuzzy match | Character-position highlight | Substring match only |
| Result display | Tree with non-matching files hidden | Flat list with path |
| Empty state | None — tree just empties | "No results for X" message |
| Folder collapse on search | No — tree still shows folders | N/A (flat results) |
| Clear button | ✅ X button | ✅ X button |
| Keyboard focus shortcut | None | None |

**Rating: Average**

### 6.7 Context Menu UX

| Feature | ContextMenu (FileExplorer) | TreeNodeMenu (FileTreePanel) |
|---|---|---|
| Trigger | Right-click | Hover + click ⋯ button |
| Items | 7 (Duplicate is a stub) | 10 for folders / 7 for files |
| Portal render | ❌ (inside explorer div) | ✅ (document.body) |
| Viewport flip | ❌ | ✅ |
| Outside click close | ✅ (backdrop div) | ✅ (mousedown listener) |
| Escape close | ❌ | ✅ |
| Keyboard open | ❌ | ❌ |

**Rating: Average**

### 6.8 Tree UX

| Feature | Exists? | Notes |
|---|---|---|
| Auto-expand on file create | ✅ | FileTreePanel opens folder before inline input |
| Scroll-to-active | ❌ | No auto-scroll to active file |
| Drag-and-drop reorder | ❌ | Not implemented |
| Multi-select | ❌ | Not implemented |
| Cut / Copy / Paste | ❌ | Not implemented |
| Show in explorer (reveal) | ❌ | No "reveal in tree" from editor |
| New file at cursor position | ✅ | TreeNodeMenu "Add file" inside folder |

**Rating: Average**

---

## 7. AI IDE AUDIT

| Feature | Status | Implementation |
|---|---|---|
| **AI Activity Badges** | ✅ Exists | Green "AI" pill on file rows (aiFiles Set) |
| **Writing Progress** | ✅ Exists | Blue pulsing badge + byte size on in-flight writes |
| **Agent Status Panel** | ✅ Exists | AgentStatusPanel: 6 agents, pulsing dots |
| **AIActivityBadge Component** | ⚠️ Exists, unused in tree | Exported but not wired to any row |
| **Open Editors Panel** | ✅ Exists | VS Code-style, localStorage-persisted |
| **Recent Files** | ✅ Hook exists | useRecentFiles exported but no panel UI |
| **File Ownership** | ❌ Missing | No per-file agent assignment indicator |
| **Realtime Feedback** | ✅ Partial | Write progress + tree refresh; no line-level cursors |
| **Workspace Awareness** | ⚠️ Partial | Counts files/folders in header; no project-wide stats |
| **Git Indicators** | ❌ Missing | No git status, branch, modified/untracked badges |
| **Collaboration** | ❌ Missing | No multi-user cursors, presence indicators |
| **Diff View Integration** | ⚠️ Partial | FileHistoryPanel exists but not wired into explorer |
| **Agent Task Display** | ⚠️ Partial | Agent state (running/done/error) shown; no task description in tree |

### AI Strengths
- Writing progress with byte-size is excellent — better than Replit's basic spinner.
- 6-agent status panel is unique and gives clear system visibility.
- Debounced tree refresh prevents flood of API calls during AI write bursts.
- 15-second safety fallback prevents stuck writing indicators.

### AI Gaps
- `AIActivityBadge` (Creating/Editing/Reading/Analyzing/Refactoring) is fully built but **never used** in any tree row.
- `useRecentFiles` hook is built and wired into `FileExplorer.handleSelect` but **no panel UI** shows recent files.
- No per-file "which agent is working on this" — just a binary AI pill.
- No typing/streaming cursors in file rows (unlike Cursor's live indicators).

---

## 8. REPLIT COMPARISON

| Feature | Nura-X | Replit | Status |
|---|---|---|---|
| File tree | ✅ | ✅ | Equal |
| Right-click menu | ✅ | ✅ | Equal |
| Inline rename | ✅ | ✅ | Equal |
| Search | ✅ | ✅ | Equal |
| File type icons | ✅ (lucide only) | ✅ (custom SVGs) | **Worse** — lucide icons are generic |
| Hover actions | ✅ | ✅ | Equal |
| Sidebar resize | ✅ | ✅ | Equal |
| Open editors | ✅ | ✅ | Equal |
| Recent files panel | ❌ (hook only) | ✅ | **Missing** |
| AI writing indicator | ✅ **better** | ❌ | Better |
| Agent status | ✅ **unique** | ❌ | Better |
| Git status badges | ❌ | ✅ | **Missing** |
| File permission icons | ❌ | ❌ | N/A |
| Drag-and-drop | ❌ | ✅ | **Missing** |
| Multi-select | ❌ | ✅ | **Missing** |
| Breadcrumbs | ❌ | ❌ | N/A |
| File diff from history | ⚠️ Exists, unwired | ✅ | **Incomplete** |
| Shell integration (context menu) | ⚠️ event only | ✅ | **Partial** |
| Keyboard navigation | ❌ | ✅ | **Missing** |
| File count in header | ✅ | ❌ | Better |

---

## 9. VS CODE COMPARISON

| Feature | Nura-X | VS Code | Status |
|---|---|---|---|
| File tree | ✅ | ✅ | Equal |
| Indent guides | ✅ FileExplorer | ✅ | Partial (missing in FileTreePanel) |
| Inline rename | ✅ | ✅ | Equal |
| Multi-select | ❌ | ✅ | **Missing** |
| Drag-and-drop | ❌ | ✅ | **Missing** |
| Keyboard navigation (arrows) | ❌ | ✅ | **Missing** |
| aria roles | ❌ | ✅ | **Missing** |
| Git decorations | ❌ | ✅ | **Missing** |
| File badges (problems count) | ❌ | ✅ | **Missing** |
| File watching / auto-refresh | ✅ SSE-based | ✅ native FS | Equal (different mechanism) |
| Explorer sections (collapsible) | ✅ partial | ✅ full | Partial |
| Reveal in tree (from editor) | ❌ | ✅ | **Missing** |
| Copy/Cut/Paste files | ❌ | ✅ | **Missing** |
| Duplicate file | ❌ stub | ✅ | **Missing** |
| Collapse all (global) | ✅ | ✅ | Equal |
| Show/hide hidden files | ✅ | ✅ via config | Equal |
| Dirty indicator (●) | ✅ (M badge) | ✅ (● dot) | VS Code more standard |
| Context menu richness | ⚠️ 7 items | ✅ 12+ items | **Weaker** |

---

## 10. CURSOR COMPARISON

| Feature | Nura-X | Cursor | Status |
|---|---|---|---|
| File tree | ✅ | ✅ | Equal |
| AI activity on file rows | ✅ (static pill) | ✅ (live streaming) | **Weaker** — static vs live |
| Agent state panel | ✅ **unique** | ❌ | Better |
| Writing progress | ✅ (bytes) | ❌ | Better |
| Real-time cursors | ❌ | ✅ | **Missing** |
| AI-suggested file names | ❌ | ❌ | N/A |
| Indexed context awareness | ❌ | ✅ | **Missing** |
| Hover 3-dot menu | ✅ | ✅ | Equal |
| Compact density | ✅ | ✅ | Equal |
| Tab open editors | ✅ | ✅ (tabs, not list) | Different style |
| Breadcrumb path | ❌ | ✅ | **Missing** |
| Pinned files | ❌ | ✅ | **Missing** |

---

## 11. MISSING FEATURES — GAP ANALYSIS

### P1 — Critical (blocks core IDE feel)

| Feature | Why it matters | Complexity | Risk |
|---|---|---|---|
| **Keyboard navigation** (arrows, Enter) | Standard in every IDE; makes explorer usable without mouse | Medium | Low — local state change |
| **aria roles** (tree/treeitem/expanded) | Screen reader users completely blocked; accessibility requirement | Low | None |
| **Recent Files Panel UI** | Hook built; no panel. Users can't access recently opened files. | Low | None |
| **Reveal active file in tree** | Cursor/VS Code core feature — scroll tree to show currently open file | Medium | Low |
| **ContextMenu: Escape to close** | Basic UX — escape should close the right-click menu | Low | None |

### P2 — Important (professional quality gap)

| Feature | Why it matters | Complexity | Risk |
|---|---|---|---|
| **Wire AIActivityBadge into tree rows** | Component exists but unused; AI activity not shown per-file in demo explorer | Low | None |
| **Git status indicators** (M/U/A/D badges) | Every modern IDE shows git status inline | High | Needs git integration |
| **Drag-and-drop file/folder move** | Expected in any file manager | High | Medium — tree mutation + API |
| **Multi-file select** | Required for bulk operations | High | Medium |
| **Duplicate file** | Currently a stub in ContextMenu | Low | None |
| **File icons — language-specific SVGs** | Lucide icons are generic; language icons (TS blue, React atom, etc.) are standard | Medium | None |
| **Indent guides in TreeNode/FileTreePanel** | FileExplorer has them; FileTreePanel does not | Low | None |
| **Dirty indicator (● dot)** | Currently shows "M" badge; VS Code-style dot before filename is more standard | Low | None |

### P3 — Nice to Have (polish / power features)

| Feature | Why it matters | Complexity | Risk |
|---|---|---|---|
| **File size in tooltip** | Helpful for large files | Low | None |
| **Last modified timestamp** | Context for debugging | Low | None |
| **Pinned files section** | Power user feature | Medium | None |
| **Copy/Cut/Paste files** | Standard file manager | Medium | Medium |
| **Folder upload to real sandbox** | FileTreePanel has it in-memory; FileExplorer has no upload | Medium | Medium |
| **Search: expand matching folders** | Currently folders that contain matches aren't auto-expanded in FileExplorer search | Medium | Low |
| **Scroll-to-active on mount** | When editor opens file, tree should scroll to it | Low | None |
| **File count badge per folder** | Shows scale at a glance | Low | None |
| **Minimap / scrollbar markers** | Dirty/AI files marked on scrollbar thumb | High | Low |

---

## 12. TECHNICAL DEBT

### 1. Dual Explorer Divergence
Two completely separate implementations (`FileExplorer` + `FileTreePanel`) share almost no UI code. `FileTreePanel/TreeNode` has hover-menu, inline-create, collapse propagation. `FileExplorer/RenderNode` has realtime indicators, indent guides, resize. Neither is a superset of the other.

**Risk**: Features added to one are not reflected in the other. Over time they diverge further.

**Recommended**: Unify into a single `TreeRow` component that accepts both `FileNode` and `RawTreeNode` via adapter, with feature flags for AI indicators, realtime, etc.

### 2. ContextMenu — No Portal, No Escape
`ContextMenu.tsx` renders inside the explorer div (not portaled), has no Escape handler, and has a broken "Duplicate" action. Inconsistent with `TreeNodeMenu` which is properly portaled.

### 3. FileHistoryPanel — Dead Integration
`FileHistoryPanel` calls `getFileHistory()` and supports diff but is not wired into either explorer. There is no way to open it from a file row.

### 4. AIActivityBadge — Built but Unwired
The `AIActivityBadge` component (5 activity kinds with animated dot) is exported but never used in any tree row. The `use-agent-status` hook tracks which agents are working but not *which file* they are working on.

### 5. useRecentFiles — No Panel
`useRecentFiles` is wired to `handleSelect` in `FileExplorer` so it records opens correctly, but no panel shows the list.

### 6. window.prompt / window.confirm in Production Code
`handleRenamePath` uses `window.prompt` and `handleDeletePath` uses `window.confirm` — these are browser-native modal dialogs, not styled to match the IDE. **Poor UX** and can't be tested.

### 7. FileHistoryPanel uses `any[]`
```ts
const [history, setHistory] = useState<any[]>([]);
```
Violates project's "no `any`" principle.

### 8. FileTreePanel — Tree State Ephemeral
The in-memory `FileTreePanel` tree is lost on unmount/remount. No persistence, no `makeInitialTree()` called by default. Users start with an empty tree every time.

### 9. collapseRevision Propagation is O(n) Re-renders
Every `collapseRevision` increment triggers a `useEffect` in every mounted `TreeNode` descendant, causing N re-renders (one per visible node). Fine at small scale, but problematic with deep trees.

---

## 13. RECOMMENDED ROADMAP

### Sprint 1 — Quick Wins (1–2 days)
1. **[P1]** Add `aria-expanded`, `role="tree"`, `role="treeitem"` to both explorers.
2. **[P1]** Wire `Escape` to close `ContextMenu`.
3. **[P1]** Add Recent Files panel UI in `FileExplorer` sidebar (hook already built).
4. **[P2]** Fix Duplicate stub in `ContextMenu` — copy file content + add to tree.
5. **[P2]** Wire `AIActivityBadge` into `TreeNode` rows when agent is active on that file.
6. **[P2]** Add indent guides to `TreeNode/FileTreePanel` (match FileExplorer style).
7. **[P3]** Call `makeInitialTree()` in `FileTreePanel` initial state so it starts populated.

### Sprint 2 — Core UX (3–5 days)
1. **[P1]** Keyboard navigation: arrow keys move focus, Enter opens file, F2 renames.
2. **[P1]** Reveal-in-tree: emit event from editor → explorer scrolls to file.
3. **[P2]** Replace `window.prompt` / `window.confirm` with styled inline UI.
4. **[P2]** Language-specific SVG file icons (replace lucide generics).
5. **[P2]** Git status badges (M/U/A/D) — requires `/api/git-status` endpoint.

### Sprint 3 — Power Features (1–2 weeks)
1. **[P2]** Drag-and-drop file/folder move with optimistic updates.
2. **[P2]** Multi-file select (Ctrl+click, Shift+click) + bulk delete/move.
3. **[P3]** Pinned files section at top of explorer.
4. **[P3]** Folder upload in `FileExplorer` (real sandbox — not just demo).
5. **[P3]** Search: auto-expand folders containing matches in FileExplorer.
6. **[P3]** Per-agent file ownership tracking → show which agent owns which file row.

### Sprint 4 — Unification
1. Merge `FileExplorer` and `FileTreePanel` into one unified explorer with mode prop.
2. Unify `RenderNode` and `TreeNode` into a single `TreeRow` component.
3. Fix `FileHistoryPanel` integration — add "History" option to context menus.
4. Fix `FileHistoryPanel` `any[]` type.

---

*End of FILE_EXPLORER_MASTER_REPORT.md*
