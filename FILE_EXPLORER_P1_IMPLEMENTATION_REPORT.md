# File Explorer — P1 Critical Features Implementation Report

**Date:** 2026-05-31  
**Scope:** `client/src/components/file-explorer/`  
**Status:** ✅ All 5 P1 Critical Features Implemented

---

## P1 #1 — Recent Files Panel

**New file:** `RecentFilesPanel.tsx`

- Reads from `useRecentFiles()` (persisted in `localStorage` under `nura-x:recent-files`, max 8 entries)
- Appears between the Open Editors panel and the Files header in `FileExplorer.tsx`
- Shows file icon + filename + parent directory name per row
- Collapsible section header (ChevronDown / ChevronRight toggle)
- Click → calls `handleSelect(path)` which records the open _and_ fires `onFileSelect`
- `data-testid="section-recent-files"` on header, `data-testid="recent-file-{name}"` on each row
- Returns `null` when list is empty (no visual noise)
- ARIA: `role="button"`, `aria-expanded` on header; `role="button"`, `aria-label` on each row

---

## P1 #2 — Keyboard Navigation

**Modified:** `FileExplorer.tsx` (RenderNode + container), `FileTreePanel.tsx`, `TreeNode.tsx`

### FileExplorer tree (`role="tree"`)

Handler attached to `treeScrollRef` container via `onKeyDown`:

| Key | Behavior |
|---|---|
| `↓` | Focus next visible row |
| `↑` | Focus previous visible row |
| `→` | Expand focused folder (if collapsed) |
| `←` | Collapse focused folder (if expanded) |
| `Enter` | Toggle folder / open file |
| `Home` | Jump to first row |
| `End` | Jump to last row |

Implementation uses `querySelectorAll('[data-tree-row]')` on the scroll container for DOM-order traversal. Expand/collapse dispatches `window.CustomEvent('rfe:set-expanded', {path, expanded})` — RenderNode instances listen and update their local `open` state accordingly.

Focused row gets a subtle `outline: 1px solid rgba(59,130,246,.3)` ring and `#1e2a3a` background to distinguish from active (blue border) and hover states.

### FileTreePanel tree (`role="tree"`)

`flattenVisibleIds()` computes ordered flat list of visible node IDs (respecting collapsed folders). `expandedIdsRef` mirrors expand/collapse state without lifting all local state. Same key map as above. Dispatches `rfe:treepanel-set-expanded` — TreeNode listens per `node.id`.

---

## P1 #3 — Accessibility

### FileExplorer / RenderNode
- Tree container: `role="tree"`, `aria-label="File explorer"`, `tabIndex={0}`
- Folder row: `role="treeitem"`, `aria-expanded={open}`, `aria-selected={active}`
- File row: `role="treeitem"`, `aria-selected={active}`
- Children container: `role="group"`
- Focused item: `tabIndex={0}`, all others `tabIndex={-1}`

### FileTreePanel / TreeNode
- Tree container: `role="tree"`, `aria-label="File tree"`, `tabIndex={0}`
- 3-dot button: `aria-haspopup="menu"`, `aria-expanded={showMenu}`
- Dropdown: `role="menu"`, `aria-label="Explorer actions"`
- Menu items: `role="menuitem"`
- Folder row: `role="treeitem"`, `aria-expanded={open}`, `aria-selected={isActive}`
- File row: `role="treeitem"`, `aria-selected={isActive}`
- Children container: `role="group"`

### ContextMenu
- Menu wrapper: `role="menu"`, `aria-label="File context menu"`
- Each action: `role="menuitem"`, `tabIndex={-1}`

---

## P1 #4 — Reveal Active File

**Modified:** `FileExplorer.tsx`

`useEffect` on `activeFile` changes:
1. Strips `projectPath` prefix to get the relative path
2. Walks intermediate folders left-to-right, dispatching `rfe:set-expanded` with `expanded: true` for each ancestor
3. After a 60 ms settle (microtask + paint), queries the DOM for `[data-tree-path="${activeFile}"]` and calls `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`
4. Sets `focusedPath` to `activeFile` so keyboard nav starts from the right position

---

## P1 #5 — ESC Closes Context Menu

**Modified:** `ContextMenu.tsx`

- Added `onClose?: () => void` prop
- `useEffect` runs when `menu` becomes non-null; attaches a **capture-phase** `keydown` listener (`addEventListener(..., true)`) so it fires before any inner handlers
- On `Escape`: calls `e.preventDefault()`, `e.stopPropagation()`, `onClose?.()`
- Listener cleaned up on unmount or when `menu` closes
- `FileExplorer.tsx` now passes `onClose={closeCtx}` to `<ContextMenu />`

---

## Files Changed

| File | Status | Change |
|---|---|---|
| `RecentFilesPanel.tsx` | **Created** | New panel component |
| `ContextMenu.tsx` | **Modified** | `onClose` prop + ESC listener |
| `FileExplorer.tsx` | **Modified** | RecentFilesPanel, keyboard nav, reveal, accessibility |
| `TreeNode.tsx` | **Modified** | ARIA attributes, keyboard expand, `focusedId`/`onFocus` props |
| `FileTreePanel.tsx` | **Modified** | Keyboard nav, ARIA, `flattenVisibleIds`, `expandedIdsRef` |
| `index.ts` | **Modified** | Added `RecentFilesPanel` export |

---

## Architecture Decisions

- **Custom events for expand/collapse** (`rfe:set-expanded`, `rfe:treepanel-set-expanded`): avoids prop-drilling through deeply recursive trees while keeping each RenderNode/TreeNode's local `open` state intact. No breaking changes to existing click behavior.
- **DOM-based traversal for up/down nav**: `querySelectorAll('[data-tree-row]')` on the scroll container gives DOM-order, meaning only currently rendered (visible) rows are navigable — correct behavior.
- **Write-through focusedPath**: `focusedPath` (already in `useFileExplorer`) reused for keyboard selection state — no new state slices needed.
- **Capture-phase ESC**: ensures the context menu ESC handler fires before any inner `keydown` handlers that might interfere.
