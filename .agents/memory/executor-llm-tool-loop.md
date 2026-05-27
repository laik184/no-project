---
name: Executor LLM Tool Loop
description: Architecture decisions for the dynamic LLM tool-calling executor refactor.
---

## The Rule
`task-executor.ts` now has two paths: LLM tool loop (if `OPENROUTER_API_KEY` or `AI_INTEGRATIONS_OPENROUTER_API_KEY` is set) and static step runner (fallback). LLM-eligible categories: setup, schema, api, auth, ui, test, deploy.

**Why:** The old executor was a static template engine — it could only produce fixed boilerplate. The LLM loop allows the agent to read existing files, make surgical edits, run commands, and iterate until the task is actually done.

**How to apply:** When adding new task categories, add them to `LLM_ELIGIBLE_CATEGORIES` in `task-executor.ts`. The tool loop auto-discovers project context via `buildToolContext`.

## Key Integration Points
- `llm/tool-loop.ts` — main loop (max 30 iterations, repeated-tool-call detection)
- `llm/tool-dispatcher.ts` — routes OpenAI tool calls to filesystem/runtime implementations
- `llm/prompt-builder.ts` — constructs system + task prompts
- `tools/tool-schema.ts` — OpenAI function-calling schemas (10 tools)
- `filesystem/patch-file.ts` — surgical old_string → new_string replacement (replaces broken append-only edit_file)
- `memory/failure-memory.ts` — tracks errors per run so LLM avoids repeating mistakes
- `recovery/checkpoint-manager.ts` — now persists to disk at `.sandbox/.checkpoints/`

## Important Constraints
- `??` and `||` must not be mixed without parentheses in the same expression (esbuild strict mode rejects it)
- `fileSearch.listDir(projectId, '.')` is safe — `hasTraversal('.')` returns false
- `workspaceManager.exists(projectId, path)` exists and works
- Static step runner now handles: read_file, patch_file, delete_file, list_directory, search_files, run_tests (in addition to old types)
- Command allowlist in `command-safety.ts` expanded to include: vite, rollup, esbuild, drizzle-kit, prisma, vitest, jest, eslint, prettier, yarn
