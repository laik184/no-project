---
name: Tool registry count baseline
description: Current tool count per category and what was added to reach it.
---

## Current count (after this session's fixes)
- **Coding**: 47 tools
- **Terminal**: 27 tools  (was 20 — added 7 new)
- **Verifier**: 12 tools  (was 9 — added 3 new)
- **Git**: 5 tools
- **Total: 131 tools**

## New terminal tools added (7)
`terminal_npm_run_script`, `terminal_npm_build`, `terminal_npm_test`, `terminal_npm_ci`  
`terminal_find_free_port`, `terminal_port_in_use`, `terminal_cleanup_run`

Files: `server/tools/terminal/npm/`, `server/tools/terminal/port/`, `server/tools/terminal/cleanup/`

## New verifier stubs added (3)
`detect_root_causes`, `parse_runtime_logs`, `detect_runtime_crash`

Files: `server/tools/verifier/detect-root-causes-tool.ts`, etc.  
These were called by `coordinateVerify()` in executor but not registered — caused ToolNotFoundError on every verify task.

**Why:** The executor's `coordinateVerify()` maps verify subkinds like `root_causes`, `parse_logs`, `crash` to these tool names. Without registration, every verify phase fail-closed.
