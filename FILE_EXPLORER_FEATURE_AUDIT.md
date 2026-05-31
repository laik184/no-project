# File Explorer Feature Audit

**Date:** 2026-05-31  
**Target:** `client/src/components/file-explorer/`  
**Scope:** All 11 files before Phase 3 implementation

---

## Files Audited

| File | LOC | Purpose |
|---|---|---|
| `FileExplorer.tsx` | ~220 | Real sandbox explorer (RawTreeNode, API-backed) |
| `FileTreePanel.tsx` | ~404 | In-memory explorer (FileNode, upload/download) |
| `TreeNode.tsx` | ~131 | Recursive tree node with inline rename/delete |
| `ContextMenu.tsx` | ~69 | Right-click context menu |
| `InlineInput.tsx` | ~79 | Inline rename input + ActionIcon button |
| `file-icon.tsx` | ~50 | File type icon map + lang guesser |
| `tree-helpers.ts` | ~119 | Tree CRUD helpers + optimistic insert |
| `use-file-explorer.ts` | ~216 | Realtime state: dirty, AI, writing, tree |
| `types.ts` | ~23 | FileNode, RawTreeNode, ContextMenuState |
| `FileHistoryPanel.tsx` | ~55 | File version history diff viewer |
| `index.ts` | ~11 | Barrel exports |

---

## Existing Features

### Core Tree
- ✅ Recursive folder/file rendering (`RenderNode` in `FileExplorer`, `TreeNode` in `FileTreePanel`)
- ✅ Expand/collapse folders with chevron
- ✅ Inline rename (F2 key + hover action icon)
- ✅ Inline delete (Delete key + hover action icon)
- ✅ File type icons (TSX, TS, JS, JSON, CSS, HTML, MD, env, image)
- ✅ Hidden files toggle (dot-files)
- ✅ Collapse all folders

### Realtime AI Indicators
- ✅ `writingFiles` — tracks in-flight AI writes with byte size
- ✅ `aiFiles` — highlights files touched by AI (diff events)
- ✅ `dirtyFiles` — tracks unsaved local edits
- ✅ 15-second safety fallback timer per writing file
- ✅ Debounced tree refresh (200ms coalesce)

### Search
- ✅ Live search filtering (substring match)
- ✅ Search results show file + parent path
- ✅ Clear search button

### Context Menu
- ✅ New File, New Folder, Rename, Delete
- ✅ Backdrop click to dismiss

### File Management
- ✅ Create file via API (`/api/save-file`)
- ✅ Delete file/folder via API (`/api/delete-file`)
- ✅ Rename via API (`/api/rename-file`)
- ✅ Optimistic insert on create
- ✅ Upload folder (FileTreePanel only)
- ✅ Download as ZIP (FileTreePanel only)

### Keyboard
- ✅ Delete key → delete focused file
- ✅ F2 key → rename focused file
- ✅ Ctrl+S / Cmd+S → dispatch `global-save` event

### UX
- ✅ Hover states on rows and action icons
- ✅ Active file highlight with left border
- ✅ Writing file highlight (blue left border + spinner badge)
- ✅ Dirty file indicator (dot)

---

## Missing Features (Pre-Phase 3)

| Category | Feature | Priority |
|---|---|---|
| Panels | Open Editors section | P1 |
| Panels | Agent Status panel | P1 |
| Panels | Recent Files section | P2 |
| UX | Resizable sidebar (drag handle) | P1 |
| UX | Width persistence (localStorage) | P1 |
| Info | File count / folder count in header | P2 |
| Info | Workspace name display | P2 |
| Indicators | Git-style M/A/D markers | P2 |
| Context menu | Copy Path | P2 |
| Context menu | Copy Relative Path | P2 |
| Context menu | Duplicate | P3 |
| Search | Fuzzy highlight (match chars highlighted) | P2 |
| Search | Highlight matching text in results | P2 |
| UX | Tree indent guide lines | P3 |
| UX | Multi-select | P3 |
| UX | Drag and drop | P3 |
| AI | AIActivityBadge component | P1 |
| AI | Per-agent status (idle/running/error) | P1 |

---

## Reusable Components

| Component | Used By |
|---|---|
| `InlineInput` | TreeNode, FileTreePanel |
| `ActionIcon` | TreeNode, FileTreePanel |
| `fileIcon` | FileExplorer, FileTreePanel, search results |
| `guessLang` | TreeNode, FileTreePanel, tree-helpers |
| `useFileExplorer` | FileExplorer only |
| `useRealtimeEvent` | use-file-explorer, unified-grid |

---

## Extension Points

1. `useFileExplorer` returns `writingFiles`, `aiFiles`, `dirtyFiles` — all consumable by new badge components
2. `RenderNode` in FileExplorer accepts `onContextMenu` — extensible without touching tree logic
3. `ContextMenu` is pure props-driven — add items by extending the items array
4. `fileIcon` is a standalone function — reuse anywhere icons are needed

---

## Potential Conflicts

- `FileExplorer` prop: `onSelect` vs `onFileSelect` — unified-grid passes `onFileSelect`, component defined `onSelect` (mismatch). Fixed in Phase 3.
- `CenterPanel` hardcodes `width: 240` for FileTreePanel container — does not affect FileExplorer.
- `unified-grid` hardcodes `width: 220` wrapper — prevents resizable sidebar from working. Fixed in Phase 3.
