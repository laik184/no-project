---
name: Executor 5-way agent split
description: How the monolithic executor was split into 5 agents and the path rules between them.
---

## The Split (Option A — new server/agents/ subdirs)

| Old location (executor/) | New agent dir |
|---|---|
| llm/, tools/, context/, memory/, browser/, coding/, templates/, planning/, utils/code-utils.ts | `server/agents/coder/` |
| filesystem/, sandbox/, utils/filesystem-utils.ts | `server/agents/filesystem/` |
| runtime/ | `server/agents/runtime/` |
| validation/, recovery/ | `server/agents/validator/` |
| core/, execution/, events/, telemetry/, types/, utils/ | `server/agents/executor/` (orchestrator only) |

## Critical import depth rules

From `coder/llm/X` → executor types: `../../executor/types/X`  
From `coder/llm/X` → filesystem: `../../filesystem/X`  
From `coder/context/X` → filesystem: `../../filesystem/X`  
From `coder/planning/X` → executor: `../../executor/types/X`, `../../executor/utils/X`  
From `validator/X` → filesystem: `../filesystem/X`, executor: `../executor/telemetry/X`  
From `validator/recovery/X` → filesystem: `../../filesystem/X`, executor: `../../executor/X`  
From `filesystem/validation/X` → filesystem root: `../X` (e.g., `../filesystem-utils`)  
From `filesystem/X` → executor telemetry: `../executor/telemetry/X`  
From `filesystem/workspace-manager` → infrastructure: `../../infrastructure/sandbox/sandbox.util.ts`  
From `runtime/command-validator` → filesystem validation: `../filesystem/validation/command-safety.ts`  
From `executor/execution/X` → coder: `../../coder/X`, runtime: `../../runtime/X`, validator: `../../validator/X`  
From `executor/core/X` → filesystem: `../../filesystem/X`, runtime: `../../runtime/X`  

**Why:** Files moved from deep `executor/sandbox/X` (4 levels) to `filesystem/X` (3 levels) — every path going up to `server/agents/` needs one fewer `../`.

**How to apply:** When adding a new import across agent boundaries, count the depth to `server/agents/` and use the table above.
