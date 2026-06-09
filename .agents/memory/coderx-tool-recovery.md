---
name: CoderX tool name recovery
description: CoderX coordinator had 5 dead coding names, 6 wrong fs names, and a double-path-prefix bug; all fixed in tool-coordinator.ts.
---

## Rule
`server/agents/coderx/coordination/tool-coordinator.ts` CODING_TOOL_MAP must use exact registered names.

## Correct mappings (as of fix)
- `generate_component` → `coding_generate_tailwind_ui` (NOT `coding_generate_react_component`)
- `generate_schema` → `coding_generate_schema` (NOT `coding_generate_drizzle_schema`)
- `refactor` → `coding_generate_generic_file` (no refactor tool exists)
- `analyze` → `coding_generate_generic_file` (no analyze tool exists)
- `validate` → `run_build` (no validate-code tool exists)

## Filesystem op mapping
All 6 ops must use `fs_` prefix: `fs_read_file`, `fs_write_file`, `fs_patch_file`, `fs_delete_file`, `fs_search_text`, `fs_read_folder`.

## Path contract
**Why:** `fs_*` tools call `resolveSafe()` which prepends `AGENT_PROJECT_ROOT`. Passing an absolute or pre-joined path causes double-prefixing (`/sandbox//sandbox/src/foo.ts`).  
**How:** Always strip leading slashes and pass a relative path. The `_sandboxRoot` parameter in `coordinateFilesystemTask` is kept for API compat but must NEVER be used to prefix paths.

## Validation
Run `tsx scripts/tool-audit.ts` — it verifies all 12 CodingTaskKind mappings, 6 fs ops, and 27 browser tools (35 checks total).
