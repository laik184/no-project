---
name: File write system
description: How NURAX's agent file writes work end-to-end, and a critical sandbox path fix applied during migration.
---

## Rule
Agent file writes land in `AGENT_PROJECT_ROOT` (env var), which is now set to `/home/runner/workspace/.sandbox` (persistent). Previously was `/tmp/nurax-sandbox` (wiped on restart).

**Why:** Files written to /tmp are lost on every server restart, making it appear writes never happened.

**How to apply:** If files seem to "disappear", check AGENT_PROJECT_ROOT env var points inside /home/runner/workspace, not /tmp.

## Write stack (no mocks anywhere)
User → ChatOrchestrator.startRun() → resolveProjectSandbox(projectId) [DB lookup]
  → dispatch('fs_write_file') → writeService.saveFile() → filesystemRepository.writeText()
  → fs.writeFileSync(absPath, content, 'utf-8')  ← real disk write

## API routes (file explorer HTTP layer)
- POST /api/file-explorer/write    { filePath, content, projectId }
- POST /api/file-explorer/delete   { targetPath, projectId }
- POST /api/file-explorer/create   { name, type, projectId }
- POST /api/file-explorer/rename   { oldPath, newPath, projectId }

## Known dead code
- server/tools/filesystem/write/tool.service.ts exports `writeToolService` wrapping async lib — not used by any registered tool. Registered tools use the sync `writeService` from server/services/filesystem/write/.
