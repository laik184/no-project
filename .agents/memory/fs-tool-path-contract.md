---
name: Filesystem tool path contract
description: fs_* tools expect RELATIVE paths; passing absolute paths causes double-prefixing via resolveSafe().
---

## Rule
All `fs_*` tools (fs_write_file, fs_read_file, fs_patch_file, etc.) call `resolveSafe(path, FE_CONFIG.sandboxRoot)` internally.

`resolveSafe` strips leading `/` then joins with sandboxRoot:
```
cleaned = rel.replace(/^\/+/, '')
abs     = path.resolve(sandboxRoot, cleaned)
```

**Always pass relative paths** (e.g. `src/App.tsx`, never `/tmp/nurax-sandbox/src/App.tsx`).

## Why
Passing an absolute path like `/tmp/nurax-sandbox/src/App.tsx`:
- `resolveSafe` strips `/` → `tmp/nurax-sandbox/src/App.tsx`
- resolves against sandboxRoot → `sandboxRoot/tmp/nurax-sandbox/src/App.tsx` ← double-prefixed, wrong location, file silently created in wrong place.

## How to apply
- `coordinateFilesystem` (tool-coordinator.ts): strip leading `/` from `input.path`, pass relative path — do NOT prepend sandboxRoot.
- `persistGeneratedFiles` (task-executor.ts): coding tools return `{ files: { 'src/Foo.tsx': code } }` with relative keys. Pass `relPath.replace(/^\/+/, '')` directly to `fs_write_file`.
- Never manually construct `${sandboxRoot}/${relPath}` and pass that to any fs_ tool.
