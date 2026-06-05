---
name: Executor filesystem tool name registry
description: coordinateFilesystem in tool-coordinator.ts must use fs_* prefixed names or every filesystem task silently fails with NOT_FOUND.
---

## Rule
All filesystem tools are registered with the `fs_` prefix. `coordinateFilesystem` MUST use these exact names.

## Correct mapping (as of fix)
| operation | tool name |
|---|---|
| read | fs_read_file |
| write / create | fs_write_file |
| patch | fs_patch_file |
| delete / remove | fs_delete_file |
| search | fs_search_text |
| list / ls | fs_read_folder |
| append | fs_append_file |
| ensure | fs_ensure_file |
| mkdir / folder | fs_create_folder |

## Why
The tool registry seals at boot. `dispatch('write_file', ...)` returns `{ ok: false, code: 'NOT_FOUND' }` silently — the task is reported as failed but the server doesn't crash and the error is buried in logs.

## How to apply
Any time filesystem tools are added, cross-check the registered name in `register-filesystem-tools.ts` against the coordinateFilesystem toolMap.
