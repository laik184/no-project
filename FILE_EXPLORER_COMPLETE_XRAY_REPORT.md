# FILE EXPLORER — COMPLETE ARCHITECTURAL X-RAY REPORT

**Target:** `client/src/components/file-explorer/`
**Scan Date:** 2026-06-01
**Total Files:** 30
**Total Folders:** 0 (flat module — no sub-directories)
**Analyst:** Automated deep scan, line-by-line evidence

---

## SECTION 1 — FOLDER STRUCTURE

```
client/
└── src/
    └── components/
        └── file-explorer/                  ← 30 files, depth 1 (flat)
            ├── AIActivityBadge.tsx          [Component]
            ├── AgentStatusPanel.tsx         [Component]
            ├── ContextMenu.tsx              [Component]
            ├── FileExplorer.tsx             [Component — main entry]
            ├── FileHistoryPanel.tsx         [Component]
            ├── FileTreePanel.tsx            [Component]
            ├── InlineInput.tsx              [Component]
            ├── OpenEditorsPanel.tsx         [Component]
            ├── PinnedFilesPanel.tsx         [Component]
            ├── ProjectInsightsPanel.tsx     [Component]
            ├── RecentFilesPanel.tsx         [Component]
            ├── RenderNode.tsx               [Re-export barrel — NO logic]
            ├── TreeNode.tsx                 [Component — recursive renderer]
            ├── TreeNodeMenu.tsx             [Component — alt context menu]
            ├── file-icon.tsx                [Utility — icon mapping]
            ├── file-tree-panel-helpers.tsx  [Helpers + UI fragments]
            ├── index.ts                     [Public barrel — re-exports]
            ├── tree-helpers.ts              [Utility — tree mutations]
            ├── tree-node-styles.tsx         [Utility — DEAD (unused)]
            ├── types.ts                     [Type definitions]
            ├── use-agent-status.ts          [Hook]
            ├── use-file-explorer-core.ts    [Hook — DEAD (unused)]
            ├── use-file-explorer-utils.ts   [Hook/Utility]
            ├── use-file-explorer.ts         [Hook — primary data hook]
            ├── use-file-tree-handlers.ts    [Hook — DEAD (id-based, orphaned)]
            ├── use-file-tree-keyboard.ts    [Hook — DEAD (id-based, orphaned)]
            ├── use-git-status.tsx           [Hook]
            ├── use-open-editors.ts          [Hook]
            ├── use-pinned-files.ts          [Hook]
            └── use-recent-files.ts          [Hook]

Total: 30 files / 0 subfolders / max nesting depth: 1
```

**Summary counts:**
- React components: 13
- Custom hooks: 9
- Utilities / helpers: 4
- Type files: 1
- Barrel/re-export files: 2
- DEAD files: 4 (confirmed unused in running call chain)

---

## SECTION 2 — FILE INVENTORY

---

### File: `types.ts`

**Purpose:** Shared TypeScript type definitions for the entire module.

**Responsibilities:**
- Defines `FileNode` — id-based in-memory tree node (used by the OLD id-based system)
- Defines `RawTreeNode` — path-based server tree node (used by the LIVE system)
- Defines `ContextMenuState` — nullable x/y/path/isDir menu position
- Defines `ClipboardState` — nullable cut/copy operation state
- Defines `FileMeta` — file size + mtime for hover tooltips

**Exports:** `FileNode`, `RawTreeNode`, `ContextMenuState`, `ClipboardState`, `FileMeta`

**Imports:** None

**Used By:** Almost every file in the module

**Complexity:** Low

**Status:** Active — but carries dual-system types (`FileNode` for dead system, `RawTreeNode` for live system). This is a symptom of architectural split.

**Issues:**
- `FileNode` (has `.id`) and `RawTreeNode` (no `.id`) both exist. This signals two parallel architectures coexisting. Only `RawTreeNode` flows through the live rendering path. `FileNode` is only referenced by dead files and `tree-helpers.ts`.

---

### File: `index.ts`

**Purpose:** Public barrel file — exports everything consumers need to import from outside the module.

**Responsibilities:**
- Re-exports types, components, hooks, utilities
- Serves as the single import surface for other parts of the app

**Exports:** 26 named exports including `FileExplorer` (default), `TreeNode`, `RenderNode`, `ExplorerTree`, `FileTreePanel`, `ContextMenu`, `TreeNodeMenu`, `InlineInput`, `ActionIcon`, `useFileExplorer`, `useOpenEditors`, `useRecentFiles`, `usePinnedFiles`, `useAgentStatus`, panels, utilities, types

**Imports:** All 29 other files

**Used By:** `client/src/components/layout/CenterPanel.tsx` (imports `FileTreePanel`, `ExplorerTree`), `client/src/pages/core/workspace.tsx` (indirectly)

**Complexity:** Low

**Status:** Active

**Issues:**
- Exports dead symbols: `TreeNodeMenu` (second context menu, no live consumer inside the module), `useFileExplorerCore` is NOT exported (correct), but `useFileTreeHandlers` and `useFileTreeKeyboard` are not exported either — yet they exist. This creates confusion about what the public API is.
- Exports `RenderNode as TreeNode` AND `RenderNode` separately (line 5) — aliased duplicate export.
- `emojiIcon` is exported but has no consumer in the application.

---

### File: `FileExplorer.tsx`

**Purpose:** The root component of the file explorer sidebar. Orchestrates all panels, the tree, context menu, history modal, and resize handle.

**Responsibilities:**
- Composes: `PinnedFilesPanel`, `OpenEditorsPanel`, `RecentFilesPanel`, `ExplorerTree`, `AgentStatusPanel`, `ProjectInsightsPanel`, `ContextMenu`, `FileHistoryPanel`
- Manages: context menu state, creating state (file/folder), sidebar width with drag-to-resize, file history modal visibility
- Delegates: tree data to `useFileExplorer`, editor tracking to `useOpenEditors`, recent tracking to `useRecentFiles`, pinning to `usePinnedFiles`, git status to `useGitStatus`

**Props:** `projectPath?`, `onSelect?`, `onFileSelect?`, `activeFile?`

**State:** `contextMenu`, `creating`, `width`, `historyFile`

**Effects:**
- `useEffect` on width change — mounts/unmounts `mousemove` + `mouseup` for resize drag (line 84–100)

**Imports:** 18 imports from within module + lucide-react

**Exports:** `default FileExplorer`, `countTree` (re-export), `formatBytes` (re-export)

**Used By:** `client/src/pages/core/workspace.tsx` (indirectly through CenterPanel or directly)

**Complexity:** Medium

**Status:** Active

**Issues:**
1. **Width stale closure** (line 92): `localStorage.setItem(WIDTH_KEY, String(width))` inside `onUp` closes over `width` from the render when the drag started. As width is updated by `setWidth`, the `width` value captured in the closure from the first render is stale. The correct approach is a ref for the current width value.
2. **Prop duplication**: `onSelect` and `onFileSelect` serve the same purpose — resolved via `selectHandler = onFileSelect ?? onSelect`. This dual-prop API is confusing.
3. **God-component smell**: 196 lines composing 8+ child components, handling resize logic, upload logic, create logic inline. Should delegate more to hooks.
4. **`createFile` and `createFolder`** defined inline (lines 58–69) duplicate logic that is also in `use-file-explorer-core.ts` (lines 251–265).
5. **`handleFolderUpload`** (lines 71–82) is also duplicated verbatim in `use-file-explorer-core.ts` (lines 135–146).

---

### File: `FileTreePanel.tsx`

**Purpose:** Contains two exports: `ExplorerTree` (the active, production file tree panel with search, keyboard nav, drag-drop) and `FileTreePanel` (a stub/placeholder component).

**Responsibilities (`ExplorerTree`):**
- Renders search bar, inline create row, scrollable tree via recursive `RenderNode`
- Manages internal state: searchQuery, selectedPaths, drag source/target, clipboard, metaTooltip
- Implements keyboard navigation (ArrowUp/Down/Left/Right/Enter/Home/End)
- Implements drag-and-drop (via `apiMovePath`)
- Implements clipboard (copy/cut/paste via `apiDuplicatePath`/`apiMovePath`)
- Implements file metadata tooltip on hover
- Auto-expands tree to active file on `activeFile` prop change

**Props:** 23 props (see `ExplorerTreeProps` interface, lines 9–23)

**State:** 6 `useState` calls: `searchQuery`, `selectedPaths`, `dragSourcePath`, `dropTargetPath`, `clipboard`, `metaTooltip`

**Effects:** 1 `useEffect` — auto-expand + scroll to activeFile (lines 103–116)

**Imports:** `RenderNode` (from `TreeNode.tsx` via `RenderNode.tsx`), `InlineCreateRow`, `countDescendantFiles`, `collectSearchExpanded`, `timeAgo`, `formatBytes`, types, GitStatus, ActivityKind

**Used By:** `FileExplorer.tsx`

**Complexity:** High

**Status:** Active

**`FileTreePanel` (lines 202–222):** Stub component. Renders a static message "Use the main file explorer in the sidebar." Props `onFileOpen` is declared but never called. This component is dead.

**Issues:**
1. **Massive prop drilling**: 23 props passed down from `FileExplorer` → `ExplorerTree` → `RenderNode` → child `RenderNode` (recursive). This creates a prop-passing avalanche.
2. **Duplicate state**: `selectedPaths`, `dragSourcePath`, `dropTargetPath`, `clipboard`, `metaTooltip` are ALL ALSO present in `use-file-explorer-core.ts`. Neither is the source of truth — they are parallel implementations.
3. **`handleShowMeta`/`handleHideMeta`** (lines 66–81) are duplicated verbatim in `use-file-explorer-core.ts` (lines 109–133).
4. **`handleMultiSelect`** (lines 37–47) is duplicated in `use-file-explorer-core.ts` (lines 61–81).
5. **`folderCounts` useMemo** (lines 83–93) is duplicated in `use-file-explorer-core.ts` (lines 148–161).
6. **`searchExpandedPaths` useMemo** (lines 95–101) is duplicated in `use-file-explorer-core.ts` (lines 163–169).
7. **`handleKeyDown`** inline (lines 118–133) is a THIRD keyboard implementation (alongside `use-file-tree-keyboard.ts` and `use-file-explorer-core.ts`'s `handleTreeKeyDown`).
8. **`FileTreePanel` export** (lines 202–222) is dead — renders a placeholder and its `onFileOpen` prop is never called.

---

### File: `TreeNode.tsx`

**Purpose:** The recursive tree row renderer. Renders a single file or folder node and recursively renders children when a folder is expanded.

**Responsibilities:**
- Renders file or folder row with: indent guides, chevron, icon, name (with search highlight), badge (writing/AI/dirty/git status), drag handles
- Manages per-node open/closed state
- Listens to `window` for `rfe:set-expanded` custom events to allow external programmatic expansion
- Exports utility functions: `timeAgo`, `countDescendantFiles`, `collectSearchExpanded`, `InlineCreateRow`

**Props:** 27 props via `RenderNodeProps` interface (lines 52–67)

**State:** 1 `useState`: `open` (line 70)

**Effects:**
- Line 88–92: `useEffect` attaches `rfe:set-expanded` listener to `window` per node. **THIS IS A MEMORY LEAK** — every rendered node registers a global listener. A 500-file tree = 500 window listeners simultaneously.

**Exports:** `RenderNode`, `InlineCreateRow`, `timeAgo`, `countDescendantFiles`, `collectSearchExpanded`, `INDENT`, `RenderNodeProps`

**Imports:** `types.ts`, `file-icon.tsx`, `use-file-explorer-utils.ts`, `AIActivityBadge.tsx`, `use-git-status.tsx`, `InlineInput.tsx`

**Used By:** `FileTreePanel.tsx` (via `RenderNode.tsx`), itself (recursive)

**Complexity:** High

**Status:** Active

**Issues:**
1. **Per-node global event listener** (line 88): Each `RenderNode` mounts a `window.addEventListener("rfe:set-expanded", handler)`. With 500 tree nodes, there are 500 listeners on `window`. This is a **confirmed memory/event leak pattern**.
2. **Inline styles everywhere** (lines 105–113): `rowStyle` is a deeply nested object created fresh on every render. No `useMemo`, no CSS classes. Every single render allocates a new object.
3. **27 props** passed into recursive call (lines 162–174). This means the entire prop surface is repeated at every depth level.
4. **`tree-node-styles.tsx` is ignored**: `TreeNode.tsx` reimplements its own `rowStyle` inline (lines 105–113) instead of using `getRowStyle` from `tree-node-styles.tsx`.
5. **`guides` array** (line 115): Creates a new array of `<span>` elements on every render via `Array.from({ length: depth })`. No memoization.
6. **`collectSearchExpanded` / `countDescendantFiles`** are exported from here but are tree-traversal utilities — they should live in `tree-helpers.ts` or `use-file-explorer-utils.ts`.

---

### File: `RenderNode.tsx`

**Purpose:** Pure re-export barrel. Contains zero logic.

**Responsibilities:**
- Re-exports `RenderNode`, `InlineCreateRow`, `countDescendantFiles`, `collectSearchExpanded`, `timeAgo`, `INDENT`, `RenderNodeProps` from `TreeNode.tsx`

**Complexity:** None

**Status:** Active (imported by `FileTreePanel.tsx` and `use-file-explorer-core.ts`)

**Issues:**
1. **Indirection with no value**: This file is a 5-line re-export of `TreeNode.tsx`. It adds an import hop but zero functionality. `FileTreePanel.tsx` could directly import from `TreeNode.tsx`.
2. **Naming confusion**: `RenderNode.tsx` and `TreeNode.tsx` exist as separate files — a reader would expect `RenderNode.tsx` to contain the `RenderNode` component.

---

### File: `TreeNodeMenu.tsx`

**Purpose:** A second, richer context menu component rendered via `createPortal`. Appears to be designed for the id-based `FileNode` system.

**Responsibilities:**
- Renders a portal-based right-click menu with: Rename, Duplicate, Search dir, Add file, Add folder, Collapse children, Open shell, Copy path, Copy link, Download, Delete
- Closes on Escape or outside click
- Calculates viewport-aware position (left/top)
- Dispatches `shell:open` and `explorer:search-dir` window events

**Props:** `node` (FileNode), `path`, `x`, `y`, `onClose`, `onRename`, `onDelete`, `onAddFile?`, `onAddFolder?`, `onCollapse?`, `onDownload?`, `onDuplicate?`

**State:** None

**Effects:**
- Line 45–58: `setTimeout` + `addEventListener` for close-on-outside-click + Escape. The `setTimeout(50ms)` is a hack to prevent immediate close on the same click that opened it.

**Imports:** `lucide-react`, `types.ts`

**Used By:** Exported from `index.ts`. **No usage found within the file-explorer module itself.** The live system uses `ContextMenu.tsx`. May be used externally.

**Complexity:** Medium

**Status:** Partial — exported but not wired into the live `FileExplorer.tsx` render path. Effectively a parallel/dead context menu.

**Issues:**
1. **Duplicate context menu**: `ContextMenu.tsx` IS used by `FileExplorer.tsx`. `TreeNodeMenu.tsx` is a separate context menu that is not called in the live render path — creating two competing implementations.
2. **`FileNode` dependency**: Takes `node: FileNode` but the live system uses `RawTreeNode`. This confirms it belongs to the dead id-based architecture.
3. **`setTimeout` anti-pattern** (line 50): Delaying event listener attachment by 50ms to avoid immediate close is a fragile pattern.

---

### File: `ContextMenu.tsx`

**Purpose:** The live right-click context menu used by `FileExplorer.tsx`.

**Responsibilities:**
- Renders a fixed-position dropdown menu with: New File, New Folder, Rename, Duplicate, Copy Path, Copy Relative Path, Copy File, Cut File, Paste Here, Pin/Unpin, View History, Delete
- Conditionally shows items based on `isDir`, `clipboard`, `isPinned`
- Calculates divider positions dynamically
- Closes on Escape key

**Props:** `menu` (ContextMenuState), `targetPath?`, 11 handler callbacks, `isPinned?`, `clipboard?`

**State:** None

**Effects:**
- Line 37–44: Escape key listener on `document`. Properly cleaned up.

**Imports:** `lucide-react`, `types.ts`

**Used By:** `FileExplorer.tsx` (line 158)

**Complexity:** Medium

**Status:** Active

**Issues:**
1. **No viewport position clamping**: The menu renders at `menu.x` / `menu.y` directly (line 95–96) without checking if the menu would overflow the viewport. `TreeNodeMenu.tsx` does clamping correctly (lines 118–119). `ContextMenu.tsx` can render partially off-screen.
2. **Divider logic** (lines 78–86): Divider positions are hardcoded index-based (`dividerBefore.add(2)`) which breaks if items are added/reordered.
3. **Background dimmer** (line 90): Renders a full-screen fixed `<div>` with `zIndex: 9998` as a click-away layer, but this has no `onClick` handler to close the menu — `FileExplorer.tsx` handles close via `onClick` on the sidebar wrapper (line 122). The dimmer div without an onClick is incomplete.
4. **`copyToClipboard`** function (lines 27–29) is a file-level helper that could be in `use-file-explorer-utils.ts`.

---

### File: `InlineInput.tsx`

**Purpose:** Reusable inline text input for file/folder rename operations, plus an `ActionIcon` button component.

**Responsibilities (`InlineInput`):**
- Renders a styled text input with auto-focus and auto-select
- Confirms on Enter/blur if value is non-empty, cancels on Escape

**Responsibilities (`ActionIcon`):**
- Renders an icon button with hover styles, optional danger mode

**Exports:** `InlineInput`, `ActionIcon`

**State:** `val` (local controlled value)

**Effects:** `useEffect` → `ref.current?.select()` on mount (auto-selects text)

**Imports:** `useState`, `useRef`, `useEffect`

**Used By:** `TreeNode.tsx` (InlineInput via `InlineCreateRow`), `index.ts` (ActionIcon exported externally)

**Complexity:** Low

**Status:** Active

**Issues:**
1. `ActionIcon` is a generic button component that has no business in the file-explorer module. It should live in `client/src/components/ui/`.
2. **Double confirm on blur+Enter**: If user presses Enter, `onConfirm` fires (line 21). Then `onBlur` also fires (line 24) and calls `onConfirm` a second time. The blur fires after the keydown. This can cause double-creation of files.

---

### File: `AIActivityBadge.tsx`

**Purpose:** Small animated badge showing what an AI agent is currently doing to a file.

**Responsibilities:**
- Maps `ActivityKind` to a label and color
- Renders an animated pulsing badge with dot indicator

**Exports:** `ActivityKind` (type), `AIActivityBadge`

**Imports:** None

**Used By:** `TreeNode.tsx` (line 135), `index.ts`

**Complexity:** Low

**Status:** Active — clean, single-responsibility

**Issues:** None significant. The `rfe-pulse` CSS animation (line 24) relies on a global keyframe defined elsewhere in the app — if that CSS is missing, the animation silently fails.

---

### File: `AgentStatusPanel.tsx`

**Purpose:** Collapsible sidebar panel showing real-time status of all agents (Planner, Executor, Verifier, Supervisor, Browser, Filesystem).

**Responsibilities:**
- Renders a toggle header with active count and error indicator
- Renders one `AgentRow` per agent when expanded
- Delegates state to `useAgentStatus`

**Props:** None

**State:** `collapsed` (local)

**Imports:** `useAgentStatus`, lucide-react

**Used By:** `FileExplorer.tsx` (line 155)

**Complexity:** Low

**Status:** Active

**Issues:** None significant. The panel is always rendered even when no agents are running, adding height to the sidebar. Could be conditionally rendered.

---

### File: `use-agent-status.ts`

**Purpose:** Hook that tracks real-time agent state via the SSE realtime stream.

**Responsibilities:**
- Maintains `agents[]` array of `AgentStatus` (idle/running/error/completed)
- Subscribes to `"agent"` and `"lifecycle"` realtime topics
- Patches agent state on start/done/error events
- Auto-resets agents to idle after timeouts

**Exports:** `useAgentStatus`, `AgentId`, `AgentState`, `AgentStatus`

**Imports:** `useState`, `useRealtimeEvent` from `@/realtime/useRealtimeStream`

**Used By:** `AgentStatusPanel.tsx`

**Complexity:** Low-Medium

**Status:** Active

**Issues:**
1. **`setTimeout` without cleanup** (lines 40, 43): `setTimeout(() => setAgents(...), 3000/5000)` are fire-and-forget. If the component unmounts before the timeout fires, `setAgents` is called on an unmounted component. No cleanup via `useEffect` return.
2. **`useRealtimeEvent` called at top level without `useEffect` wrapping**: `useRealtimeEvent` is called directly inside the hook body (lines 32, 51) — this is valid because `useRealtimeEvent` itself wraps in `useEffect`, but the handler closures capture `setAgents` correctly because they are function references.

---

### File: `ProjectInsightsPanel.tsx`

**Purpose:** Collapsible sidebar panel showing project statistics (file count, folder count, AI modified files, active writes, unsaved files).

**Responsibilities:**
- Renders stats from the tree and agent state sets
- Animated indicator when files are writing

**Props:** `tree`, `aiFiles`, `writingFiles`, `dirtyFiles`

**State:** `collapsed` (local)

**Imports:** `useState`, `useMemo`, types, `countTree` from utils

**Used By:** `FileExplorer.tsx` (line 156)

**Complexity:** Low

**Status:** Active

**Issues:** Minor — `useMemo` on `countTree(tree)` (line 33) is correct. No significant issues.

---

### File: `PinnedFilesPanel.tsx`

**Purpose:** Collapsible panel listing user-pinned files at top of sidebar.

**Responsibilities:**
- Renders list of pinned file paths with file icon, name, unpin button
- Highlights active file
- Hides itself when `files.length === 0`

**Props:** `files`, `activeFile?`, `onSelect`, `onUnpin`, `onClearAll`

**State:** `collapsed`, `hoveredPath` (local)

**Imports:** `useState`, `fileIcon`, lucide-react

**Used By:** `FileExplorer.tsx`

**Complexity:** Low

**Status:** Active

**Issues:**
1. **Local `hoveredPath` state** (line 17) causes a re-render of the entire panel on every mouse enter/leave. With 10 pinned files, this fires frequently. Should use CSS `:hover` instead.
2. **Pattern duplication**: The file row structure (icon, name, hover action button) is identical in `OpenEditorsPanel.tsx` and `PinnedFilesPanel.tsx`. Screaming for a shared `FileListRow` component.

---

### File: `OpenEditorsPanel.tsx`

**Purpose:** Collapsible panel showing currently open editor files at top of sidebar.

**Responsibilities:**
- Lists open file paths, highlights active, supports close per-file and close-all
- Hides itself when `files.length === 0`

**Props:** `files`, `activeFile?`, `onSelect`, `onClose`, `onCloseAll`

**State:** `collapsed`, `hoveredPath` (local)

**Imports:** `useState`, `fileIcon`, lucide-react

**Used By:** `FileExplorer.tsx`

**Complexity:** Low

**Status:** Active

**Issues:** Same as `PinnedFilesPanel.tsx` — local `hoveredPath` causes unnecessary re-renders. File row structure is copy-pasted.

---

### File: `RecentFilesPanel.tsx`

**Purpose:** Collapsible panel showing recently opened files.

**Responsibilities:**
- Lists recent files with name + parent directory hint
- Highlights active file
- Hides when empty

**Props:** `files`, `activeFile?`, `onSelect`

**State:** `collapsed`, `hoveredPath` (local)

**Imports:** `useState`, `fileIcon`, lucide-react

**Used By:** `FileExplorer.tsx`

**Complexity:** Low

**Status:** Active

**Issues:** Same `hoveredPath` re-render issue. Row structure is a third copy of the same pattern.

---

### File: `FileHistoryPanel.tsx`

**Purpose:** Shows version history for a specific file, with click-to-diff between versions.

**Responsibilities:**
- Fetches history from `getFileHistory(projectId, filePath)`
- Renders loading state + list of history entries
- Calls `onSelectForDiff(older, newer)` when clicked

**Props:** `projectId`, `filePath`, `onSelectForDiff?`

**State:** `history: any[]`, `loading: boolean`

**Effects:** Fetches history on `projectId` or `filePath` change

**Imports:** `getFileHistory` from `../../services/agent-ultra.service`

**Used By:** `FileExplorer.tsx` (rendered inside history modal, line 188)

**Complexity:** Low

**Status:** Active — but problematic

**Issues:**
1. **`any[]` type** (line 11): `history` is typed as `any[]`. No interface for history entries.
2. **External dependency on `agent-ultra.service`**: This is an out-of-module import 2 levels up. The file explorer module has a hard coupling to a specific service it doesn't own.
3. **No error handling**: If `getFileHistory` throws, `loading` stays `true` forever (no try/catch).
4. **Inline `load()` function** (line 14) defined inside the component is re-created on every render — should be `useCallback` or moved into a `useEffect`.
5. **`onSelectForDiff` is declared in Props but `FileExplorer.tsx` never passes it** (line 188). It will always be `undefined`. The diff functionality is dead.

---

### File: `file-icon.tsx`

**Purpose:** Maps file names and types to React icon elements. Also provides language guessing and emoji fallbacks.

**Responsibilities:**
- `fileIcon(name, type, open?)` — returns JSX icon element based on file extension
- `guessLang(name)` — returns Monaco language ID string
- `emojiIcon(name, type)` — returns emoji string (text, not JSX)

**Exports:** `fileIcon`, `guessLang`, `emojiIcon`

**Imports:** `lucide-react`, `react-icons/si` (SiTypescript, SiJavascript, SiPython, SiReact)

**Used By:** `TreeNode.tsx`, `PinnedFilesPanel.tsx`, `OpenEditorsPanel.tsx`, `RecentFilesPanel.tsx`, `file-tree-panel-helpers.tsx`, `use-file-tree-handlers.ts`, `tree-helpers.ts`, `index.ts`

**Complexity:** Low

**Status:** Active

**Issues:**
1. **`emojiIcon`** is used nowhere in the running application. It is exported via `index.ts` but no component calls it.
2. **`guessLang`** covers only 8 extensions. Files like `.go`, `.rs`, `.rb` will fall through to `"plaintext"` — they render correctly in the icon but get wrong Monaco syntax highlighting.
3. **Performance**: `fileIcon` is called on every render of every file row. No memoization. Each call does 20+ string comparisons. For a large tree this is O(n × 20) string ops per render cycle.

---

### File: `use-file-explorer-utils.ts`

**Purpose:** Stateless tree utility functions.

**Responsibilities:**
- `countTree(tree)` — recursively counts files and folders in a `RawTreeNode[]`
- `formatBytes(bytes)` — formats byte count to human-readable string

**Exports:** `countTree`, `formatBytes`

**Imports:** `RawTreeNode` from types

**Used By:** `FileExplorer.tsx`, `FileTreePanel.tsx`, `TreeNode.tsx`, `ProjectInsightsPanel.tsx`

**Complexity:** Low

**Status:** Active

**Issues:**
1. `formatBytes` is used in both `TreeNode.tsx` and `FileTreePanel.tsx` — correctly centralised here.
2. `countTree` uses recursion without memoization — called in `FileExplorer.tsx`'s render and `ProjectInsightsPanel.tsx`'s `useMemo`. Could be expensive for very large trees.

---

### File: `tree-helpers.ts`

**Purpose:** Pure functions for mutating `FileNode[]` trees (the id-based legacy system) and `RawTreeNode[]` trees (the live system).

**Responsibilities:**
- `uid()` — generates random 7-char ID
- `flattenFiles()` — flattens FileNode tree to path list
- `deleteNodeById()`, `renameNodeById()`, `addNodeToRoot()`, `addNodeInsideFolder()` — id-based mutations (DEAD — only used by `use-file-tree-handlers.ts`)
- `duplicateName()` — generates unique copy name
- `getDescendantIds()`, `moveNode()` — id-based tree operations (DEAD)
- `optimisticInsertFile()`, `removeOptimisticFile()` — path-based optimistic updates (LIVE — used by `use-file-explorer.ts`)
- `makeInitialTree()` — creates a sample `FileNode[]` tree (DEAD — returns static data nobody calls)

**Exports:** All of the above

**Imports:** `types.ts`, `file-icon.tsx`

**Used By:** `use-file-explorer.ts` (optimistic functions only), `use-file-tree-handlers.ts` (id-based functions — dead path), `file-tree-panel-helpers.tsx`, `index.ts`

**Complexity:** Medium

**Status:** Partial — half dead

**Issues:**
1. **Mixed system pollution**: This file contains both live code (`optimisticInsertFile`, `removeOptimisticFile`) and dead legacy code (`deleteNodeById`, `renameNodeById`, `addNodeToRoot`, `addNodeInsideFolder`, `moveNode`, `getDescendantIds`, `flattenFiles`, `makeInitialTree`). The dead functions are only used by `use-file-tree-handlers.ts` which is itself dead.
2. **`makeInitialTree`** (lines 159–196): Returns a hardcoded sample file tree. Never called in the live application. 40 lines of dead code.

---

### File: `file-tree-panel-helpers.tsx`

**Purpose:** UI helper components for the file explorer toolbar/menu, plus utility functions for the id-based tree system.

**Responsibilities:**
- `MenuDivider` — renders a divider line (used in `ExplorerMenu`)
- `MenuItem` — renders a menu button with icon and hover styles (used in `ExplorerMenu`)
- `ExplorerMenu` — renders the file explorer action dropdown menu
- `buildTreeFromFiles()` — builds `FileNode[]` from flat file list (id-based, DEAD)
- `flattenVisibleIds()` — flattens visible id-based tree (used by `use-file-tree-keyboard.ts` — DEAD)

**Exports:** All of the above

**Imports:** lucide-react, `types.ts`, `file-icon.tsx`, `tree-helpers.ts`

**Used By:** `use-file-tree-keyboard.ts` (dead), `use-file-tree-handlers.ts` (dead), `index.ts`. `ExplorerMenu` component is NOT used in `FileExplorer.tsx` — the header buttons are rendered inline there.

**Complexity:** Low-Medium

**Status:** Partial — `ExplorerMenu`, `buildTreeFromFiles`, `flattenVisibleIds` are dead in the live path

**Issues:**
1. **`ExplorerMenu`** is a fully built dropdown menu component that is NEVER used in `FileExplorer.tsx`. The header action buttons are implemented inline in `FileExplorer.tsx` (lines 112–138) using `hdrBtn()`. Two separate implementations of toolbar actions.
2. **`buildTreeFromFiles`** / **`flattenVisibleIds`** only used by dead hooks.

---

### File: `tree-node-styles.tsx`

**Purpose:** Designed to extract shared row styling logic and drag handler construction from tree nodes.

**Responsibilities:**
- `getRowStyle(opts)` — returns `React.CSSProperties` for a tree row
- `IndentGuides` — renders vertical indent lines
- `DotButton` — renders a "more actions" `⋯` button
- `buildDragHandlers(opts)` — returns drag event handler object

**Exports:** `INDENT_W`, `RowStyleOpts`, `getRowStyle`, `IndentGuides`, `DotButton`, `DragHandlerOpts`, `buildDragHandlers`

**Imports:** lucide-react (MoreHorizontal)

**Used By:** **NOBODY.** None of these exports are imported by any file in the module. `TreeNode.tsx` reimplements its own styles inline.

**Complexity:** Low

**Status:** **DEAD — completely unused**

**Issues:**
1. **100% dead file**. Zero imports anywhere in the codebase. The intent was to share row styling between tree nodes but `TreeNode.tsx` was never updated to use it.
2. Note: `INDENT_W = 16` here vs `INDENT = 14` in `TreeNode.tsx` — the two constants are inconsistent, which would have caused visual discrepancies if this file had been used.

---

### File: `use-file-explorer.ts`

**Purpose:** The primary data hook for the file explorer. Fetches the file tree from the API, tracks AI and write activity, and provides all file operation functions.

**Responsibilities:**
- Fetches file tree via `GET /api/list-files?projectPath=...`
- Manages: `tree`, `dirtyFiles`, `aiFiles`, `aiActivity`, `writingFiles`, `writingSizes`, `focusedPath`, `hoveredPath`
- Subscribes to `"agent"` and `"file"` realtime events
- Provides: `refreshFiles()`, `apiSaveFile()`, `apiMovePath()`, `apiDuplicatePath()`, `handleRenamePath()`, `handleDeletePath()`
- Implements optimistic tree updates on file create/delete

**Exports:** `useFileExplorer`

**Imports:** `useState`, `useEffect`, `useRef`, `types.ts`, `tree-helpers.ts`, `useRealtimeEvent` from realtime

**Used By:** `FileExplorer.tsx` (line 43), `use-file-explorer-core.ts` (line 54 — dead consumer)

**Complexity:** High

**Status:** Active — the core data backbone

**Issues:**
1. **`loadTree` is not memoized** (lines 24–34): Defined inside the hook body without `useCallback`. Recreated every render, though this is only a minor concern since it's only called from effects.
2. **`refreshFiles` dispatches `window.dispatchEvent(new Event("file-refresh"))`** (line 38) — a global custom event. This creates invisible action-at-a-distance coupling to any component listening on `window`.
3. **Writing timers in ref** (lines 21, 112–117): `writingTimers` ref maps path → timeout. Proper cleanup exists in `useEffect` return (lines 151–156). This is correct.
4. **API calls use bare `fetch`** with no error handling beyond `console.error`. `apiSaveFile` (lines 174–179) does not check `res.ok`. `apiRenameFile` (lines 158–164) uses `alert()` for errors — native browser dialogs in a web app.
5. **`alert()` / `window.confirm()`** (lines 163, 231): Native browser dialogs are used for rename error and delete confirmation. These block the UI thread and cannot be styled.
6. **`treeRefreshTimerRef`** (lines 125–130): debounces refresh by 200ms. Correct, but the ref type annotation is verbose — minor.

---

### File: `use-file-explorer-core.ts`

**Purpose:** Intended as a comprehensive hook that combines all file explorer state into a single hook return value — a refactor layer above `use-file-explorer.ts`.

**Responsibilities:** (mirrors `FileExplorer.tsx` almost exactly)
- Manages: `contextMenu`, `searchQuery`, `creating`, `width`, `selectedPaths`, `dragSourcePath`, `dropTargetPath`, `clipboard`, `historyFile`, `metaTooltip`
- Delegates to: `useFileExplorer`, `useGitStatus`, `useOpenEditors`, `useRecentFiles`, `usePinnedFiles`
- Implements: multi-select, drag-drop, clipboard, meta-tooltip, folder upload, folder counts, search expansion, keyboard nav, create file/folder

**Exports:** `useFileExplorerCore`

**Imports:** All other hooks + `RenderNode.tsx`

**Used By:** **NOBODY.** Not imported by `FileExplorer.tsx` or any other component.

**Complexity:** High

**Status:** **DEAD — completely unused**

**Issues:**
1. **100% dead file.** The actual `FileExplorer.tsx` calls `useFileExplorer`, `useGitStatus`, `useOpenEditors`, `useRecentFiles`, `usePinnedFiles` directly (lines 43–52). `useFileExplorerCore` was built to replace all that, but the wiring was never completed.
2. **Duplicates massive amounts of logic** from `FileExplorer.tsx` and `FileTreePanel.tsx` (see Section 8 — Code Duplication).
3. **287 lines** of dead, duplicated code with no consumers.

---

### File: `use-file-tree-handlers.ts`

**Purpose:** Hook factory that returns event handlers for the id-based `FileNode[]` tree system.

**Responsibilities:**
- File select, delete, rename, create-inside-folder, new file, new folder, multi-select, drag-drop, duplicate, upload folder, download zip, toggle hidden, collapse all, close files

**Exports:** `useFileTreeHandlers`, `UseFileTreeHandlersOpts`

**Imports:** `JSZip`, `types.ts`, `file-icon.tsx`, `tree-helpers.ts`, `file-tree-panel-helpers.tsx`

**Used By:** **Not imported by any file in the active render path.** Was designed for the old `FileNode[]`-based tree system.

**Complexity:** Medium

**Status:** **DEAD — completely unused in live system**

**Issues:**
1. All operations work on `FileNode[]` with id-based mutations. The live system uses `RawTreeNode[]` with path-based API calls.
2. `JSZip` is imported for download-as-zip — this adds bundle weight for dead code.
3. Contains `handleDownloadZip` which generates a zip in the browser from the in-memory tree — in the live system, download is handled server-side via `/api/files/download`.

---

### File: `use-file-tree-keyboard.ts`

**Purpose:** Keyboard navigation handler factory for the id-based `FileNode[]` tree.

**Responsibilities:**
- Handles ArrowUp/Down/Left/Right/Enter/Space/Home/End keyboard events
- Navigates by id using `flattenVisibleIds`
- Dispatches `rfe:treepanel-set-expanded` window events

**Exports:** `useFileTreeKeyboard`, `UseFileTreeKeyboardOpts`

**Imports:** `types.ts`, `file-tree-panel-helpers.tsx`

**Used By:** **Nobody.** Not imported in the active render path.

**Complexity:** Low

**Status:** **DEAD — completely unused**

**Issues:**
1. Uses `rfe:treepanel-set-expanded` (line 56) while the live system uses `rfe:set-expanded` (TreeNode.tsx line 89, FileTreePanel.tsx line 109). Different event names — incompatible with the live system.
2. Operates on `FileNode` ids (`data-tree-node-id`) while the live system uses paths (`data-tree-path`). Incompatible data model.

---

### File: `use-git-status.tsx`

**Purpose:** Hook and component for Git file status tracking.

**Responsibilities:**
- `useGitStatus()` — listens for `rfe:git-status` window events and maintains a `Map<path, GitStatus>`
- `GitStatusBadge` — renders a colored letter badge (M/A/D/U) for git status

**Exports:** `useGitStatus`, `GitStatusBadge`, `GitStatus` (type)

**Imports:** `useState`, `useEffect`

**Used By:** `FileExplorer.tsx` (useGitStatus), `TreeNode.tsx` (GitStatusBadge), `FileTreePanel.tsx` (GitStatus type)

**Complexity:** Low

**Status:** Active

**Issues:**
1. **`.tsx` extension** for a file that returns `<span>` (JSX) — correct choice. However, it mixes a hook and a component in one file, violating single responsibility.
2. The `rfe:git-status` event is never dispatched from anywhere in the current codebase. So `useGitStatus` will always return an empty map — the git status feature is wired but not driven.

---

### File: `use-open-editors.ts`

**Purpose:** Hook managing the list of open editor tabs in the sidebar, persisted to `localStorage`.

**Responsibilities:**
- `openFile(path)` — adds file to front of list, deduplicates, trims to 12
- `closeFile(path)` — removes file from list
- `closeAll()` — clears list
- All mutations persist to `localStorage` key `"nura-x:open-editors"`

**Exports:** `useOpenEditors`

**Imports:** `useState`, `useCallback`

**Used By:** `FileExplorer.tsx`, `use-file-explorer-core.ts` (dead)

**Complexity:** Low

**Status:** Active

**Issues:**
1. **Sync localStorage on every state mutation**: `persist()` is called inside `setOpenFiles` which is inside a `useCallback`. This creates a synchronous `localStorage.setItem` on every file open/close. Could be debounced for large lists.
2. **isFile check** (line 6): `const isFile = (path: string) => /\.[^/]+$/.test(path)` — duplicated identically in `use-recent-files.ts` and `use-pinned-files.ts`. Three copies of the same regex.

---

### File: `use-recent-files.ts`

**Purpose:** Hook managing list of recently opened files, persisted to localStorage.

**Responsibilities:**
- `recordOpen(path)` — adds to front, deduplicates, trims to 8
- `clearRecent()` — empties list
- Persists to `"nura-x:recent-files"`

**Exports:** `useRecentFiles`

**Imports:** `useState`, `useCallback`

**Used By:** `FileExplorer.tsx`, `use-file-explorer-core.ts` (dead)

**Complexity:** Low

**Status:** Active

**Issues:**
1. **`isFile` regex** duplicated from `use-open-editors.ts` and `use-pinned-files.ts`.
2. `clearRecent` is exported but `RecentFilesPanel.tsx` has no clear-all button — the function is never called in the UI.

---

### File: `use-pinned-files.ts`

**Purpose:** Hook managing user-pinned files list, persisted to localStorage.

**Responsibilities:**
- `pinFile(path)`, `unpinFile(path)`, `isPinned(path)`, `clearPinned()` — full CRUD for pinned list
- Persists to `"nura-x:pinned-files"`

**Exports:** `usePinnedFiles`

**Imports:** `useState`, `useCallback`

**Used By:** `FileExplorer.tsx`, `use-file-explorer-core.ts` (dead)

**Complexity:** Low

**Status:** Active

**Issues:**
1. `isFile` regex triplicated.
2. `isPinned` implemented as `useCallback` that calls `pinnedFiles.includes(path)` — O(n) linear search. For 10 pinned files, negligible. Not a real problem.

---

## SECTION 3 — DEPENDENCY GRAPH

```
index.ts
├── → types.ts
├── → file-icon.tsx
├── → tree-helpers.ts
├── → InlineInput.tsx
├── → TreeNode.tsx
│   ├── → types.ts
│   ├── → file-icon.tsx
│   ├── → use-file-explorer-utils.ts → types.ts
│   ├── → AIActivityBadge.tsx
│   ├── → use-git-status.tsx
│   └── → InlineInput.tsx
├── → RenderNode.tsx → TreeNode.tsx (re-export only)
├── → TreeNodeMenu.tsx → types.ts
├── → FileTreePanel.tsx
│   ├── → TreeNode.tsx (via RenderNode.tsx)
│   ├── → types.ts
│   ├── → use-file-explorer-utils.ts
│   └── → use-git-status.tsx (type only)
├── → ContextMenu.tsx → types.ts
├── → use-file-explorer.ts
│   ├── → types.ts
│   ├── → tree-helpers.ts
│   └── → @/realtime/useRealtimeStream
├── → use-open-editors.ts
├── → use-recent-files.ts
├── → use-pinned-files.ts
├── → use-agent-status.ts → @/realtime/useRealtimeStream
├── → OpenEditorsPanel.tsx → file-icon.tsx
├── → RecentFilesPanel.tsx → file-icon.tsx
├── → PinnedFilesPanel.tsx → file-icon.tsx
├── → AgentStatusPanel.tsx → use-agent-status.ts
├── → ProjectInsightsPanel.tsx → use-file-explorer-utils.ts
├── → FileExplorer.tsx (default)
│   ├── → use-file-explorer.ts
│   ├── → use-git-status.tsx
│   ├── → use-open-editors.ts
│   ├── → use-recent-files.ts
│   ├── → use-pinned-files.ts
│   ├── → PinnedFilesPanel.tsx
│   ├── → OpenEditorsPanel.tsx
│   ├── → RecentFilesPanel.tsx
│   ├── → AgentStatusPanel.tsx
│   ├── → ProjectInsightsPanel.tsx
│   ├── → ContextMenu.tsx
│   ├── → use-file-explorer-utils.ts
│   └── → FileHistoryPanel.tsx → ../../services/agent-ultra.service [EXTERNAL]
└── → FileHistoryPanel.tsx

DEAD SUBGRAPH (not reachable from FileExplorer.tsx render path):
use-file-explorer-core.ts
├── → use-file-explorer.ts
├── → use-git-status.tsx
├── → use-open-editors.ts
├── → use-recent-files.ts
├── → use-pinned-files.ts
└── → RenderNode.tsx → TreeNode.tsx

use-file-tree-handlers.ts
├── → jszip [EXTERNAL DEAD DEPENDENCY]
├── → types.ts
├── → file-icon.tsx
├── → tree-helpers.ts (id-based functions)
└── → file-tree-panel-helpers.tsx

use-file-tree-keyboard.ts
├── → types.ts
└── → file-tree-panel-helpers.tsx

tree-node-styles.tsx
└── → lucide-react (only)
```

**Circular dependencies detected:** NONE

**Dependency hotspots (most imported):**
1. `types.ts` — imported by 12 files
2. `file-icon.tsx` — imported by 8 files
3. `tree-helpers.ts` — imported by 4 files
4. `use-file-explorer-utils.ts` — imported by 4 files
5. `@/realtime/useRealtimeStream` — imported by 2 files

**Tight coupling issue:** `FileHistoryPanel.tsx` directly imports `../../services/agent-ultra.service` — crosses module boundary with a relative path 2 levels up, creating a hidden external dependency.

---

## SECTION 4 — COMPONENT ANALYSIS

### `FileExplorer` (FileExplorer.tsx)

| Attribute | Value |
|-----------|-------|
| Props | 4 (projectPath, onSelect, onFileSelect, activeFile) |
| useState calls | 4 (contextMenu, creating, width, historyFile) |
| useEffect calls | 1 (resize mouse event listeners) |
| useCallback | 1 (handleFolderUpload) |
| Child components | 8 |
| Lines | 196 |

**Problems:**
- **Stale closure in resize** (line 92): `width` read inside `onUp` closure is stale after drag
- **Dual select prop** (`onSelect` / `onFileSelect`) — API ambiguity
- **Inline `hdrBtn` factory** (lines 112–118): A function that returns JSX defined at render scope — not memoized, creates new function on every render
- **`createFile` / `createFolder` / `handleFolderUpload`** could be extracted to a hook

---

### `ExplorerTree` (FileTreePanel.tsx)

| Attribute | Value |
|-----------|-------|
| Props | 23 |
| useState calls | 6 |
| useCallback calls | 7 |
| useMemo calls | 2 |
| useEffect calls | 1 |
| Lines | 198 |

**Problems:**
- **23 props** is excessive — a context or composition pattern should be used
- **6 state variables** that duplicate `use-file-explorer-core.ts` — contradicts the single-source-of-truth principle
- **`handleKeyDown` implemented inline** (lines 118–133) — a third keyboard handler

---

### `RenderNode` (TreeNode.tsx)

| Attribute | Value |
|-----------|-------|
| Props | 27 |
| useState calls | 1 (open) |
| useEffect calls | 1 (window listener) |
| Renders recursively | Yes |
| Lines | 195 |

**Problems:**
- **27 props** drilled recursively — every node re-receives all 27 props
- **Per-node window event listener** — O(n) listeners in the DOM
- **No React.memo** — any parent state change causes all visible nodes to re-render
- **Inline style object creation** on every render
- **No virtualization** — 500 nodes = 500 DOM elements simultaneously

---

### `TreeNodeMenu` (TreeNodeMenu.tsx)

| Attribute | Value |
|-----------|-------|
| Props | 11 |
| State | 0 |
| Effects | 1 (close handlers) |
| Uses Portal | Yes |
| Lines | 174 |

**Problems:**
- Takes `FileNode` (id-based) — incompatible with live `RawTreeNode` system
- `setTimeout(50ms)` hack for event timing
- Not wired into `FileExplorer.tsx`

---

### `ContextMenu` (ContextMenu.tsx)

| Attribute | Value |
|-----------|-------|
| Props | 15 |
| State | 0 |
| Effects | 1 (Escape handler) |
| Lines | 143 |

**Problems:**
- No viewport overflow clamping
- Background dimmer div has no onClick
- Hardcoded divider indices

---

## SECTION 5 — HOOK ANALYSIS

### `useFileExplorer`

- **Purpose**: Core data hook — tree fetch, AI events, file operations
- **Subscriptions**: `useRealtimeEvent("agent")`, `useRealtimeEvent("file")`, `window` events (`file-refresh`, `file-create-failed`, `explorer:refresh`)
- **Cleanup**: Window listeners cleaned (lines 54–58). Writing timers cleaned (lines 151–156). `treeRefreshTimerRef` cleaned.
- **Issues**:
  - `loadTree` defined without `useCallback` — minor
  - `alert()` / `confirm()` for error/confirm UX
  - No loading state exposed — consumers can't show a spinner

### `useAgentStatus`

- **Purpose**: Tracks agent states via SSE realtime
- **Subscriptions**: 2× `useRealtimeEvent` (agent + lifecycle topics)
- **Cleanup**: `useRealtimeEvent` handles its own cleanup via `useEffect` return
- **Leak**: `setTimeout` calls (lines 40, 43) not cancelled on unmount. If the component unmounts within 3–5 seconds of an agent completing, `setAgents` fires on unmounted component. React 18 suppresses the warning but it is still a bug pattern.

### `useGitStatus`

- **Purpose**: Listens for git status window events
- **Subscriptions**: `window` event `rfe:git-status`
- **Cleanup**: Correct (lines 44–46)
- **Issues**: Event never dispatched in codebase — always returns empty map

### `useOpenEditors` / `useRecentFiles` / `usePinnedFiles`

- **Purpose**: localStorage-backed state for sidebar lists
- **No subscriptions, no effects, no cleanup needed**
- **Issues**: `isFile` regex triplicated; `clearRecent` never called in UI

### `useFileExplorerCore` (DEAD)

- **287 lines** never executed
- Contains: `useEffect` for width drag (lines 171–188), `useEffect` for active-file auto-scroll (lines 197–214) — these effect cleanups exist but the hook is never mounted

### `useFileTreeHandlers` (DEAD)

- No subscriptions, no effects
- All returned handlers manipulate `FileNode[]` state — incompatible with live system

### `useFileTreeKeyboard` (DEAD)

- Returns a keyboard event handler function
- Dispatches `rfe:treepanel-set-expanded` — wrong event name for live system

---

## SECTION 6 — STATE FLOW

### Current (Live) State Architecture

```
User Action
│
├─ FILE SELECT (click on file in ExplorerTree)
│  └─ ExplorerTree.onSelect(path)
│     └─ FileExplorer.handleSelect(path)
│        ├─ useOpenEditors.openFile(path)  → localStorage + setOpenFiles
│        ├─ useRecentFiles.recordOpen(path) → localStorage + setRecentFiles
│        └─ props.onFileSelect(path)       → workspace.tsx → opens editor tab
│
├─ CONTEXT MENU (right-click)
│  └─ ExplorerTree.onContextMenu(e, path, isDir)
│     └─ FileExplorer.openCtx(e, path, isDir)
│        └─ setContextMenu({ x, y, path, isDir })
│           └─ ContextMenu renders at (x, y)
│
├─ CREATE FILE (toolbar button)
│  └─ setCreating("file")
│     └─ ExplorerTree receives creating prop
│        └─ InlineCreateRow renders
│           └─ onConfirm(name)
│              └─ FileExplorer.createFile(name)
│                 └─ apiSaveFile(path, "") → POST /api/save-file
│                    └─ refreshFiles(path) → optimisticInsertFile + file-refresh event
│                       └─ useFileExplorer.loadTree() → GET /api/list-files
│                          └─ setTree(newTree) → re-render
│
├─ RENAME (context menu)
│  └─ handleRenamePath(path)
│     └─ window.prompt() [BLOCKS UI]
│        └─ apiRenameFile(old, new) → POST /api/rename-file
│           └─ refreshFiles(newPath)
│
├─ DELETE (context menu)
│  └─ handleDeletePath(path)
│     └─ window.confirm() [BLOCKS UI]
│        └─ apiDeleteFile(path) → POST /api/delete-file
│           └─ refreshFiles()
│
└─ AI WRITE EVENT (SSE)
   └─ useRealtimeEvent("file") handler in useFileExplorer
      ├─ type="writing": setWritingFiles.add(path) + badge appears
      └─ type=other: debounced refreshFiles() after 200ms
```

### State Duplication Map

The following states exist in **TWO or THREE places** simultaneously:

| State | FileExplorer.tsx | ExplorerTree (FileTreePanel.tsx) | use-file-explorer-core.ts (dead) |
|-------|-----------------|----------------------------------|-----------------------------------|
| contextMenu | ✓ line 32 | — | ✓ line 27 |
| creating | ✓ line 33 | — | ✓ line 29 |
| width | ✓ line 34 | — | ✓ line 30 |
| selectedPaths | — | ✓ line 27 | ✓ line 31 |
| dragSourcePath | — | ✓ line 28 | ✓ line 32 |
| dropTargetPath | — | ✓ line 29 | ✓ line 33 |
| clipboard | — | ✓ line 30 | ✓ line 34 |
| metaTooltip | — | ✓ line 31 | ✓ line 36 |
| historyFile | ✓ line 35 | — | ✓ line 35 |
| folderCounts | — | useMemo line 83 | useMemo line 148 |
| searchExpandedPaths | — | useMemo line 95 | useMemo line 163 |

---

## SECTION 7 — FILE OPERATIONS FLOW

### Read File
```
UI: user clicks file in ExplorerTree
→ ExplorerTree.onSelect(fullPath)
→ FileExplorer.handleSelect(fullPath)
→ props.onFileSelect(fullPath)
→ workspace.tsx: openFileTab(name, content, lang)
   ↳ BUT: content is NOT fetched here. The tab opens with content from a separate fetch
   ↳ CenterPanel.tsx: GET /api/read-file?filePath=... [added in this session]
→ Monaco editor renders content
```
**Breakpoints:** The file content is fetched by `CenterPanel.tsx` outside this module — the file explorer only provides the path, not the content.

---

### Create File
```
UI: setCreating("file") via toolbar or context menu
→ InlineCreateRow renders (TreeNode.tsx)
→ User types name + Enter
→ FileExplorer.createFile(name)
→ Compute full path from contextMenu or projectPath
→ apiSaveFile(fullPath, "")  →  POST /api/save-file  →  fs.writeFileSync
→ refreshFiles(fullPath)
   ├─ optimisticInsertFile(tree, fullPath) → setTree [immediate UI update]
   └─ window.dispatchEvent("file-refresh") → loadTree() → GET /api/list-files → setTree
```

---

### Rename File
```
UI: Context menu → Rename → ContextMenu.onRename()
→ FileExplorer: handleRenamePath(contextMenu.path)
→ window.prompt("Rename to:", oldName) ← BLOCKS UI THREAD
→ apiRenameFile(oldPath, newPath) → POST /api/rename-file → fs.renameSync
→ refreshFiles(newPath)
→ loadTree() → GET /api/list-files → setTree
```
**Breakpoint:** `window.prompt()` is a blocking native dialog. Cannot be styled, cannot be cancelled with keyboard shortcuts, freezes animation.

---

### Delete File
```
UI: Context menu → Delete → ContextMenu.onDelete()
→ FileExplorer: handleDeletePath(contextMenu.path)
→ window.confirm("Delete this file/folder?") ← BLOCKS UI THREAD
→ apiDeleteFile(targetPath) → POST /api/delete-file → fs.unlinkSync/rmSync
→ refreshFiles()
→ loadTree() → GET /api/list-files → setTree
```
**Breakpoint:** Same `window.confirm()` problem.

---

### Move File (Drag & Drop)
```
UI: Drag file row → drop on folder row
→ ExplorerTree: handleDrop(src, dest)
→ apiMovePath(src, dest)
→ compute newPath = dest + "/" + filename
→ apiRenameFile(src, newPath) → POST /api/rename-file
→ refreshFiles(newPath)
→ loadTree()
```

---

### Save File
```
(Not initiated from file explorer — file saving is in CenterPanel/Monaco)
POST /api/save-file with { filePath, content, clientMtime }
→ server: conflict check → fs.writeFileSync
→ SSE "file" event emitted [if agent writes]
→ useFileExplorer.useRealtimeEvent("file") → refreshFiles() [debounced 200ms]
```

---

### Duplicate File
```
UI: Context menu → Duplicate
→ FileExplorer: apiDuplicatePath(path)
→ Find sibling names in tree
→ Compute newName (duplicateName util)
→ POST /api/duplicate-file { sourcePath, destPath }
→ server: cpRecursive(src, dest)
→ refreshFiles(newPath)
```

---

## SECTION 8 — SSE / WEBSOCKET FLOW

### SSE Subscription Architecture

```
@/realtime/realtime-provider.tsx
└── RealtimeProvider
    └── Single EventSource → /api/realtime
        ├── addEventListener("agent", dispatch)
        ├── addEventListener("file", dispatch)
        ├── addEventListener("lifecycle", dispatch)
        └── ... (all topics)

useRealtimeEvent(topic, handler) [useRealtimeStream.ts]
└── useEffect → subscribe(topic, handler)
    └── handlersRef.current.get(topic).add(handler)
```

**Subscribers in this module:**

| File | Topic | Handler Purpose |
|------|-------|----------------|
| `use-file-explorer.ts` | `"agent"` | Highlight AI-written files on diff events |
| `use-file-explorer.ts` | `"file"` | Track writing state, refresh tree on file changes |
| `use-agent-status.ts` | `"agent"` | Update agent state (start/done/error) |
| `use-agent-status.ts` | `"lifecycle"` | Update on run start/complete/error |

**Issues:**

1. **Duplicate `"agent"` subscriptions**: Both `use-file-explorer.ts` and `use-agent-status.ts` subscribe to the `"agent"` topic independently. Both are mounted simultaneously in `FileExplorer.tsx`. This is correct behavior (both handle different concerns) but is worth noting.

2. **Window events used alongside SSE**: The module uses BOTH the SSE realtime system AND raw `window.dispatchEvent` custom events:
   - `"file-refresh"` — triggers tree reload (dispatched by `use-file-explorer.ts:38`)
   - `"explorer:refresh"` — also triggers reload (line 53)
   - `"file-dirty"` / `"file-saved"` — track dirty state
   - `"rfe:set-expanded"` — expand/collapse tree nodes (per-node listener leak)
   - `"rfe:git-status"` — git status updates
   - `"rfe:treepanel-set-expanded"` — dead system event
   - `"shell:open"` — dispatched by TreeNodeMenu (dead path)
   - `"explorer:search-dir"` — dispatched by TreeNodeMenu (dead path)
   - `"global-save"` — dispatched by use-file-explorer.ts keyboard handler

This dual-event-system is a significant **architectural smell**. Six different window events + 4 SSE topics means events are scattered across two transport mechanisms with no unified event registry.

3. **`rfe:set-expanded` listener per node** (TreeNode.tsx line 88): Every mounted `RenderNode` adds its own listener to `window`. The event handler checks `if (path === full)` to filter. This is O(n) — dispatching one expand event causes n listener invocations. With 500 nodes, 499 listeners do nothing useful on each dispatch.

---

## SECTION 9 — PERFORMANCE ANALYSIS

Ranked by severity (Critical → Low):

---

### P0 — CRITICAL: Per-Node Global Window Event Listeners

**File:** `TreeNode.tsx` lines 88–92
**Code:**
```typescript
useEffect(() => {
  const handler = (e: Event) => { const { path, expanded } = (e as CustomEvent).detail ?? {}; if (path === full) setOpen(expanded); };
  window.addEventListener("rfe:set-expanded", handler);
  return () => window.removeEventListener("rfe:set-expanded", handler);
}, [full]);
```
**Impact:** A 500-node tree creates 500 simultaneous window listeners. Every `rfe:set-expanded` dispatch invokes all 500, each doing a string comparison. This is O(n) work per expand/collapse operation and scales linearly with tree size.
**Fix:** Use a single event bus or a Map-based event system. One central listener, O(1) dispatch.

---

### P0 — CRITICAL: No Tree Virtualization

**File:** `FileTreePanel.tsx` lines 173–187, `TreeNode.tsx`
**Impact:** All tree nodes are rendered to the DOM simultaneously. A project with 500 files renders 500 `<div>` elements, each with 27 props and multiple child spans. React must reconcile all of them on every state change. No `react-window` or similar virtualization.
**Fix:** Implement virtual scrolling via `react-window` or `react-virtual`.

---

### P1 — HIGH: Inline Style Objects Created Per Render

**File:** `TreeNode.tsx` lines 105–113
**Code:** `const rowStyle: React.CSSProperties = { display: "flex", ... }` — new object every render
**Impact:** Every re-render of a `RenderNode` (and there are potentially hundreds) allocates a new style object. No `useMemo`, no CSS classes.
**Fix:** Memoize with `useMemo(computeRowStyle, [deps])` or use CSS classes.

---

### P1 — HIGH: 27-Prop Recursive Drilling

**File:** `TreeNode.tsx` lines 162–174 (recursive `RenderNode` call)
**Impact:** All 27 props are passed down on every recursive call. React compares all 27 props on every render to determine if re-render is needed. Without `React.memo`, any parent state change (e.g. `hoveredPath`) causes ALL visible nodes to re-render.
**Fix:** Wrap `RenderNode` in `React.memo` + use a context or atom store for hot state like `hoveredPath` and `focusedPath`.

---

### P1 — HIGH: No React.memo on RenderNode

**File:** `TreeNode.tsx` line 69
**Impact:** `RenderNode` is not memoized. When `hoveredPath` changes (on every mouse move over ANY file), it propagates through `ExplorerTree` → every `RenderNode` re-renders even if nothing changed for that node.
**Fix:** `export const RenderNode = React.memo(function RenderNode(...) { ... })`.

---

### P2 — MEDIUM: Polling vs. Push for Tree Refresh

**File:** `use-file-explorer.ts` lines 36–39
**Impact:** `refreshFiles()` triggers a full `GET /api/list-files` request. This is called: on mount, on every file creation, on every AI write event (debounced 200ms), on explicit refresh button click. Under heavy AI activity, this can cause many API calls.
**Fix:** Track mutations optimistically and only full-refresh on structural changes.

---

### P2 — MEDIUM: `folderCounts` useMemo Computed Twice

**File:** `FileTreePanel.tsx` lines 83–93, `use-file-explorer-core.ts` lines 148–161
**Impact:** Both compute the same `Map<path, count>` over the same tree. In the live system only `FileTreePanel.tsx`'s version runs, but it recomputes on every tree change — which can be frequent.
**Fix:** Memoize at the top-level hook level.

---

### P3 — LOW: `fileIcon()` Called Without Memoization

**File:** `TreeNode.tsx` line 154 (folder), 190 (file); `PinnedFilesPanel.tsx`; `OpenEditorsPanel.tsx`; `RecentFilesPanel.tsx`
**Impact:** Each panel row renders an icon by calling `fileIcon()` which runs 20+ string comparison operations. Not memoized.
**Fix:** Wrap in `useMemo` per row or convert to a lookup table (O(1) hash lookup).

---

### P3 — LOW: `localStorage` Sync on Every File Open

**File:** `use-open-editors.ts`, `use-recent-files.ts`, `use-pinned-files.ts`
**Impact:** Every file click triggers `localStorage.setItem()` synchronously in the state update. For rapid file switching, this is unnecessary I/O.
**Fix:** Debounce persistence.

---

## SECTION 10 — CODE QUALITY ANALYSIS

### Dead Code

| File | Reason | Lines Wasted |
|------|--------|--------------|
| `tree-node-styles.tsx` | Zero imports anywhere | 100 lines |
| `use-file-explorer-core.ts` | Never imported by live components | 287 lines |
| `use-file-tree-handlers.ts` | Id-based system, not wired | 172 lines |
| `use-file-tree-keyboard.ts` | Id-based + wrong event names | 104 lines |
| `FileTreePanel` export (FileTreePanel.tsx:202–222) | Returns placeholder text | 21 lines |
| `makeInitialTree()` in tree-helpers.ts | Never called | 38 lines |
| `flattenFiles()` in tree-helpers.ts | Only used by dead handlers | 14 lines |
| `emojiIcon()` in file-icon.tsx | Never called in app | 10 lines |
| `clearRecent()` in use-recent-files.ts | Exported, UI has no button | — |

**Total dead lines: ~746 lines (~33% of module)**

---

### Unused Imports

| File | Unused Import |
|------|--------------|
| `use-file-explorer-core.ts` | `FileMeta` from types (line 2) — used, but whole file is dead |
| `ContextMenu.tsx` | `FileSymlink` imported but used (line 67) — OK |
| `file-tree-panel-helpers.tsx` | `uid` from tree-helpers used only in dead `buildTreeFromFiles` |

---

### Duplicate Logic (Top Offenders)

1. **`isFile` regex** — copied in `use-open-editors.ts:6`, `use-recent-files.ts:6`, `use-pinned-files.ts:6`
2. **`handleShowMeta`/`handleHideMeta`** — verbatim in `FileTreePanel.tsx:66–81` and `use-file-explorer-core.ts:109–133`
3. **`handleMultiSelect`** — verbatim in `FileTreePanel.tsx:37–47` and `use-file-explorer-core.ts:61–81`
4. **`folderCounts` useMemo** — verbatim in `FileTreePanel.tsx:83–93` and `use-file-explorer-core.ts:148–161`
5. **`searchExpandedPaths` useMemo** — verbatim in `FileTreePanel.tsx:95–101` and `use-file-explorer-core.ts:163–169`
6. **`handleFolderUpload`** — verbatim in `FileExplorer.tsx:71–82` and `use-file-explorer-core.ts:135–146`
7. **`createFile` / `createFolder`** — in `FileExplorer.tsx:58–69` and `use-file-explorer-core.ts:251–265`
8. **resize drag logic** — in `FileExplorer.tsx:84–107` and `use-file-explorer-core.ts:171–195`
9. **Keyboard navigation** — THREE implementations: `use-file-tree-keyboard.ts`, `use-file-explorer-core.ts:216–241`, `FileTreePanel.tsx:118–133`
10. **Context menu** — TWO implementations: `ContextMenu.tsx` (live) and `TreeNodeMenu.tsx` (dead/parallel)
11. **File list row pattern** — THREE copies in `PinnedFilesPanel.tsx`, `OpenEditorsPanel.tsx`, `RecentFilesPanel.tsx`

---

### Large Files / Functions

| File | Lines | Assessment |
|------|-------|-----------|
| `use-file-explorer-core.ts` | 287 | Dead — should be deleted |
| `tree-helpers.ts` | 197 | Half dead — split live vs. dead functions |
| `TreeNode.tsx` | 195 | Acceptable but needs memo + style extraction |
| `FileTreePanel.tsx` | 222 | Too large — ExplorerTree has duplicate state |
| `file-icon.tsx` | 111 | Acceptable — data-heavy switch logic |
| `use-file-tree-handlers.ts` | 172 | Dead — delete |
| `ContextMenu.tsx` | 143 | Acceptable |

---

## SECTION 11 — ARCHITECTURE PROBLEMS

### Problem 1: Two Parallel Systems — ID-Based vs Path-Based

**Severity: Critical**

The module contains TWO complete data architectures:

- **Legacy (dead):** `FileNode[]` with `.id` fields — mutations via `deleteNodeById`, `renameNodeById`, `addNodeInsideFolder`, `moveNode`. Keyboard navigation via `useFileTreeKeyboard`. Handlers via `useFileTreeHandlers`. Context menu via `TreeNodeMenu`.

- **Live:** `RawTreeNode[]` with no ids — mutations via API calls (`/api/save-file`, `/api/rename-file`, `/api/delete-file`). Keyboard navigation inline in `FileTreePanel.tsx`. Context menu via `ContextMenu.tsx`.

**Why it's a problem:** ~700 lines of dead code have not been cleaned up. The dead system uses `FileNode` which conflicts with `RawTreeNode` in types.ts. Any new developer will try to use the id-based functions and wonder why changes don't persist to disk.

---

### Problem 2: `use-file-explorer-core.ts` Was Never Wired

**Severity: Critical**

This 287-line hook was designed to be the "single hook" that `FileExplorer.tsx` would use, extracting all state management out of the component. The wiring was never completed — `FileExplorer.tsx` still calls all child hooks directly. The result is that all state logic in `use-file-explorer-core.ts` is duplicated from `FileExplorer.tsx` and `FileTreePanel.tsx`.

**Why it's a problem:** Developers may edit `use-file-explorer-core.ts` thinking it's live. It has zero effect.

---

### Problem 3: State Lives in Wrong Places

**Severity: High**

- `selectedPaths`, `dragSourcePath`, `dropTargetPath`, `clipboard`, `metaTooltip` live inside `ExplorerTree` (inside `FileTreePanel.tsx`).
- These should be higher up since other components (`ContextMenu`, `FileExplorer`) also need access to `clipboard`.
- The `clipboard` state in `ExplorerTree` is not accessible to `ContextMenu.tsx` — so the paste handler in `ContextMenu.tsx` fires, but `ExplorerTree.handlePaste()` uses its own internal clipboard. There is no single clipboard state.

---

### Problem 4: 23–27 Prop Drilling

**Severity: High**

Both `ExplorerTree` (23 props) and `RenderNode` (27 props) accept excessive prop counts. `RenderNode` passes all 27 props to child `RenderNode` calls recursively. This violates encapsulation, makes the component signatures unreadable, and makes any structural change require touching every call site.

**Why it's a problem:** Adding one new feature (e.g., a "favorite" flag) requires adding a prop at `FileExplorer.tsx`, threading it through `ExplorerTree`, and then into every `RenderNode` call in the recursive tree.

---

### Problem 5: Global Window Events as Internal State Bus

**Severity: High**

The module uses `window.dispatchEvent` + `window.addEventListener` as its internal communication channel for:
- Tree expand/collapse (`rfe:set-expanded`)
- Tree refresh (`file-refresh`, `explorer:refresh`)
- Git status updates (`rfe:git-status`)
- Keyboard-triggered saves (`global-save`)

**Why it's a problem:** Global events bypass React's data flow entirely. They are invisible to React DevTools, impossible to type-check, and create action-at-a-distance bugs. The per-node `rfe:set-expanded` listener pattern scales as O(n) with tree size.

---

### Problem 6: `FileHistoryPanel` has External Coupling

**Severity: Medium**

`FileHistoryPanel.tsx` imports `getFileHistory` from `../../services/agent-ultra.service` — a path that crosses the module boundary. This makes the file-explorer module not self-contained.

**Why it's a problem:** Moving the file-explorer folder breaks the import. Adding tests for `FileHistoryPanel` requires mocking an external service. The module cannot be safely extracted.

---

### Problem 7: Native Browser Dialogs in Production UI

**Severity: Medium**

`use-file-explorer.ts` uses `window.prompt()` (line 223) for rename and `window.confirm()` (line 231) for delete confirmation.

**Why it's a problem:** These block the JavaScript thread, cannot be styled, do not match the app's design system, and behave differently across browsers. On mobile they may not appear at all.

---

### Problem 8: No Error Boundary

**Severity: Medium**

`FileExplorer.tsx` and all child components have no React Error Boundary. If `TreeNode.tsx` throws during recursive rendering (e.g., from unexpected API data shape), the entire sidebar crashes without recovery.

---

## SECTION 12 — RECOMMENDED ARCHITECTURE

```
client/src/components/file-explorer/
│
├── types/
│   └── index.ts                    ← All shared types (single source of truth)
│                                     RawTreeNode, ContextMenuState, ClipboardState, FileMeta
│                                     (Remove FileNode — consolidate to RawTreeNode)
│
├── api/
│   └── file-explorer.api.ts        ← All fetch calls: listFiles, readFile, saveFile,
│                                     renameFile, deleteFile, duplicateFile
│                                     Returns typed promises, handles errors, no UI
│
├── store/
│   └── file-explorer.store.ts      ← Zustand or React Context store for shared UI state:
│                                     selectedPaths, clipboard, dragSource/Target,
│                                     contextMenu, creating, historyFile
│                                     Eliminates prop drilling
│
├── hooks/
│   ├── useFileTree.ts              ← Tree data: fetch, realtime updates, optimistic mutations
│   ├── useFileOperations.ts        ← File CRUD: create, rename, delete, duplicate, move
│   ├── useFileSelection.ts         ← Multi-select logic (Ctrl+click, Shift+click)
│   ├── useDragDrop.ts              ← Drag source/target state + drop handling
│   ├── useClipboard.ts             ← Copy/cut/paste operations
│   ├── useMetaTooltip.ts           ← Hover file-stat tooltip
│   ├── usePinnedFiles.ts           ← (keep as-is, already clean)
│   ├── useOpenEditors.ts           ← (keep as-is, already clean)
│   ├── useRecentFiles.ts           ← (keep as-is, already clean)
│   └── useAgentStatus.ts           ← (keep as-is, already clean)
│
├── components/
│   ├── FileExplorer.tsx            ← Root: composes sidebar sections, resize handle
│   ├── tree/
│   │   ├── FileTree.tsx            ← Virtualised scroll container + keyboard nav
│   │   ├── FileTreeNode.tsx        ← Single node row (React.memo, CSS classes)
│   │   └── InlineCreateRow.tsx     ← Inline input for new file/folder
│   ├── panels/
│   │   ├── PinnedPanel.tsx
│   │   ├── OpenEditorsPanel.tsx
│   │   ├── RecentPanel.tsx
│   │   ├── AgentStatusPanel.tsx
│   │   └── ProjectInsightsPanel.tsx
│   ├── menus/
│   │   └── ContextMenu.tsx         ← Single context menu (consolidate TreeNodeMenu)
│   ├── shared/
│   │   ├── FileListRow.tsx         ← Shared row for pinned/open/recent panels
│   │   ├── FileIcon.tsx            ← File icon component (extracted from file-icon.tsx)
│   │   └── InlineInput.tsx         ← (keep, move ActionIcon to ui/)
│   └── history/
│       └── FileHistoryPanel.tsx    ← Move history fetch into a local hook
│
├── utils/
│   ├── file-icon.ts                ← Icon mapping (pure functions, no JSX)
│   ├── tree-utils.ts               ← countTree, countDescendantFiles, collectSearchExpanded
│   │                                  formatBytes, guessLang, duplicateName
│   └── optimistic.ts               ← optimisticInsertFile, removeOptimisticFile
│
├── events/
│   └── tree-events.ts              ← Typed custom event registry
│                                     Replace window.dispatchEvent with a typed EventEmitter
│                                     expandNode(path), collapseNode(path), refreshTree()
│
└── index.ts                        ← Public barrel (minimal — only what consumers need)
```

**Total target files:** ~28 (same count, but zero dead files, clear separation of concerns)

---

## SECTION 13 — REFACTOR ROADMAP

### Priority P0 — Critical Fixes (Do First)

1. **Delete 4 dead files immediately:**
   - `tree-node-styles.tsx` (100 lines, zero consumers)
   - `use-file-explorer-core.ts` (287 lines, zero consumers)
   - `use-file-tree-handlers.ts` (172 lines, zero consumers)
   - `use-file-tree-keyboard.ts` (104 lines, wrong system)

2. **Fix `window.prompt()` / `window.confirm()`** in `use-file-explorer.ts`:
   Replace with modal dialogs using Shadcn `Dialog` or `AlertDialog` components.

3. **Fix double-confirm bug** in `InlineInput.tsx` (line 21–24):
   Add a `confirmed` ref to prevent double-firing of `onConfirm` from Enter + blur.

4. **Fix stale closure in resize** in `FileExplorer.tsx` (line 92):
   Use a `widthRef = useRef(width)` and update it on every width change. Read `widthRef.current` in the `onUp` closure.

5. **Fix `setTimeout` leaks** in `use-agent-status.ts` (lines 40, 43):
   Track timer IDs in a ref, clear on unmount via `useEffect` cleanup.

6. **Add error handling** to `FileHistoryPanel.tsx`:
   Wrap `getFileHistory` in try/catch, expose error state in UI.

---

### Priority P1 — Architecture Fixes

7. **Replace per-node `rfe:set-expanded` listeners** with a central expand registry:
   A single `Map<path, (expanded: boolean) => void>` in a context, eliminating O(n) listener scaling.

8. **Consolidate context menus**: Delete `TreeNodeMenu.tsx`, extend `ContextMenu.tsx` with the additional options (`Open shell`, `Search directory`, `Download`, `Copy link`).

9. **Extract file operations from `use-file-explorer.ts`** into a dedicated `useFileOperations` hook that accepts `projectPath` and returns typed async operations.

10. **Create a `FileExplorerContext`** for shared UI state (`clipboard`, `selectedPaths`, `dragSource`, `contextMenu`) — eliminates the 23-prop `ExplorerTree` interface.

11. **Decouple `FileHistoryPanel.tsx`** from `../../services/agent-ultra.service`:
    Create an internal `useFileHistory(projectId, filePath)` hook that owns the fetch logic.

12. **Remove `FileNode` type** and `makeInitialTree` from `tree-helpers.ts`. All dead id-based functions (`deleteNodeById`, `renameNodeById`, `addNodeToRoot`, `addNodeInsideFolder`, `moveNode`, `getDescendantIds`, `flattenFiles`) should be deleted.

---

### Priority P2 — Performance Fixes

13. **Add `React.memo` to `RenderNode`**:
    ```typescript
    export const RenderNode = React.memo(function RenderNode(props: RenderNodeProps) { ... });
    ```

14. **Memoize `rowStyle`** in `TreeNode.tsx`:
    Replace inline object with `useMemo(() => computeRowStyle(...), [active, focused, hovered, ...])`.

15. **Extract `guides` array** creation to `useMemo` or render only via `IndentGuides` from (fixed) `tree-node-styles.tsx`.

16. **Implement virtualized scrolling** in `FileTreePanel.tsx` using `react-virtual` or `react-window`. Flatten the tree to a visible-rows array and render only the viewport-visible slice.

17. **Debounce `localStorage` writes** in `useOpenEditors`, `useRecentFiles`, `usePinnedFiles` (100ms debounce).

---

### Priority P3 — Cleanup

18. **Consolidate `isFile` regex**: Move to `use-file-explorer-utils.ts`, import from all three storage hooks.

19. **Create a shared `FileListRow` component** used by `PinnedFilesPanel`, `OpenEditorsPanel`, and `RecentFilesPanel` — eliminates the triplicated row pattern.

20. **Replace `hoveredPath` state** in panel components with CSS `:hover` pseudo-classes or a single parent-level hover tracker.

21. **Move `ActionIcon`** from `InlineInput.tsx` to `client/src/components/ui/ActionIcon.tsx`.

22. **Delete `RenderNode.tsx`**: It is a 5-line re-export barrel. Update all importers to import directly from `TreeNode.tsx`.

23. **Delete `FileTreePanel` named export** (lines 202–222 of `FileTreePanel.tsx`). It is a dead placeholder.

24. **Move `emojiIcon`** out of the live bundle if unused, or delete it.

---

### Priority P4 — Future Improvements

25. **Add an Error Boundary** wrapping `ExplorerTree` to catch render errors without crashing the whole sidebar.

26. **Add loading skeleton** while `loadTree` is in-flight (currently no loading state exposed from `useFileExplorer`).

27. **Replace `rfe:git-status` window event** with a proper server-side git integration — the event is currently never dispatched.

28. **Implement file search** across file contents (not just names) — the current search only filters visible file names.

29. **Add keyboard shortcut registry** to replace the scattered `window.addEventListener("keydown", ...)` calls.

30. **Typed event bus** to replace the mix of SSE + window events with a single typed pubsub system.

---

## SECTION 14 — FINAL SCORECARD

| Dimension | Score | Reasoning |
|-----------|-------|-----------|
| **Architecture** | 4/10 | Two parallel systems (id + path), dead hook never wired, state in wrong layers, prop drilling of 23–27 props |
| **Scalability** | 3/10 | No virtualization, O(n) window listeners, full tree re-render on any hover change |
| **Maintainability** | 4/10 | 746 dead lines (~33%), 10+ cases of duplicate logic, 3 keyboard handlers, 2 context menus, no error boundaries |
| **Performance** | 4/10 | No React.memo, no virtualization, per-node window listeners, inline style objects, synchronous localStorage |
| **Code Quality** | 4/10 | Dead files not cleaned, `any[]` types, native browser dialogs, `alert()`/`confirm()`, triple-copied row components |
| **Developer Experience** | 5/10 | Good test IDs, good file naming, good dark UI polish — hurt by confusing dual-system, dead hooks that look live, invisible wiring failures |

---

### Overall Grade: **D+**

The module has a solid visual foundation — the UI renders correctly, the component aesthetics are good, test IDs are thorough, and the SSE realtime integration is architecturally sound. However, an incomplete refactor left 4 dead files (746 dead lines), 10+ duplicated logic blocks, a 287-line hook that was never wired, two competing context menus, three competing keyboard navigation implementations, a critical per-node event listener leak, and zero tree virtualization. The module is actively accumulating technical debt from an abandoned migration between two data architectures. Without the P0 and P1 fixes, adding any new feature risks editing the wrong layer.

---

*Report generated by full static analysis of all 30 files in `client/src/components/file-explorer/`. Every finding references exact file names and line numbers from direct code inspection.*
