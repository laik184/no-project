---
name: Terminal tool name contract
description: Correct registered tool names for all terminal tools and coordinator mapping rules.
---

## Rule
Tool name constants in coordinators MUST exactly match names registered in `terminal-tool-registry.ts`. Mismatches cause silent `ToolNotFoundError` on every task of that kind.

## Correct name mapping

| Old (wrong) name     | Registered name                  |
|----------------------|----------------------------------|
| `run_command`        | `terminal_execute_command`       |
| `npm_install`        | `terminal_install_package`       |
| `npm_run_script`     | `terminal_npm_run_script`        |
| `npm_build`          | `terminal_npm_build`             |
| `npm_test`           | `terminal_npm_test`              |
| `npm_ci`             | `terminal_npm_ci`                |
| `process_start`      | `terminal_start_runtime`         |
| `process_stop`       | `terminal_stop_runtime`          |
| `process_register`   | `terminal_runtime_status`        |
| `cleanup_run`        | `terminal_cleanup_run`           |
| `resolve_port`       | `terminal_find_free_port`        |
| `find_free_port`     | `terminal_find_free_port`        |
| `port_in_use`        | `terminal_port_in_use`           |

## Permission issue
The `process` permission type is NOT in `DEFAULT_GRANTED` (which only covers `read`, `write`, `execute`).  
Runtime tools originally declared `permissions: ['execute', 'process']` — this caused permission failures.  
**Fix:** All runtime/process tools use `permissions: ['execute']` or `permissions: ['read']` only.

**Why:** `tool-resolver.ts` builds the granted set from `DEFAULT_GRANTED + ctx.meta.grantedPermissions`. Since `process` was never added to either list, any tool that required it would fail the permission check.

## How to apply
- When adding new terminal tools, use only `'read'`, `'write'`, `'execute'` in `permissions`.
- When routing terminal tasks, always look up names from the registered list before adding to any `toolMap`.
