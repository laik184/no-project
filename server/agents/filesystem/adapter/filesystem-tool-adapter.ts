/**
 * server/agents/filesystem/adapter/filesystem-tool-adapter.ts
 *
 * Compatibility adapter layer.
 *
 * Agents that previously called filesystem functions directly can
 * optionally route through the tool dispatcher via this adapter.
 * This adapter preserves the old function signatures exactly.
 *
 * Old agents continue to work unchanged — this is an ADDITIVE layer.
 * Nothing in server/agents/filesystem/ is removed or broken.
 */

import { dispatch }      from '../../../tools/registry/tool-dispatcher.ts';
import { buildContext }  from '../../../tools/shared/context-builder.ts';
import type { ToolExecutionResult } from '../../../tools/registry/tool-types.ts';

// ── Context factory ───────────────────────────────────────────────────────────

export function buildFsContext(runId: string, projectId: string, sandboxRoot?: string) {
  return buildContext(runId, projectId, sandboxRoot ? { sandboxRoot } : {});
}

// ── Typed dispatch helper ─────────────────────────────────────────────────────

async function fsDispatch<T>(
  toolName: string,
  input:    Record<string, unknown>,
  runId:    string,
  projectId: string,
  sandboxRoot?: string,
): Promise<T> {
  const ctx    = buildFsContext(runId, projectId, sandboxRoot);
  const result = await dispatch<Record<string, unknown>, T>(toolName, input, ctx);
  if (!result.ok) {
    throw new Error(`[fs-adapter] ${toolName} failed: ${(result as Extract<ToolExecutionResult<T>, { ok: false }>).error}`);
  }
  return (result as Extract<ToolExecutionResult<T>, { ok: true }>).data;
}

// ── Adapter API — preserves old function shapes ───────────────────────────────

export const filesystemToolAdapter = {
  readFile:     (path: string, runId: string, projectId: string, root?: string) =>
    fsDispatch<string>('fs_read_file', { path }, runId, projectId, root),

  writeFile:    (path: string, content: string, overwrite: boolean, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_write_file', { path, content, overwrite }, runId, projectId, root),

  appendFile:   (path: string, content: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_append_file', { path, content }, runId, projectId, root),

  patchFile:    (path: string, oldString: string, newString: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_patch_file', { path, oldString, newString }, runId, projectId, root),

  patchAll:     (path: string, oldString: string, newString: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_patch_all', { path, oldString, newString }, runId, projectId, root),

  deleteFile:   (path: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_delete_file', { path }, runId, projectId, root),

  deleteFolder: (path: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_delete_folder', { path }, runId, projectId, root),

  moveFile:     (sourcePath: string, destinationDir: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_move_file', { sourcePath, destinationDir }, runId, projectId, root),

  moveFolder:   (sourcePath: string, destinationDir: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_move_folder', { sourcePath, destinationDir }, runId, projectId, root),

  renameFile:   (path: string, newName: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_rename_file', { path, newName }, runId, projectId, root),

  renameFolder: (path: string, newName: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_rename_folder', { path, newName }, runId, projectId, root),

  cloneFile:    (sourcePath: string, destinationPath: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_clone_file', { sourcePath, destinationPath }, runId, projectId, root),

  cloneFolder:  (sourcePath: string, destinationPath: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_clone_folder', { sourcePath, destinationPath }, runId, projectId, root),

  scanFolder:   (path: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_scan_folder', { path }, runId, projectId, root),

  getAsciiTree: (path: string, runId: string, projectId: string, root?: string) =>
    fsDispatch<{ path: string; tree: string }>('fs_ascii_tree', { path }, runId, projectId, root),

  searchText:   (path: string, query: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_search_text', { path, query }, runId, projectId, root),

  searchRegex:  (path: string, pattern: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_search_regex', { path, pattern }, runId, projectId, root),

  createFolder: (path: string, runId: string, projectId: string, root?: string) =>
    fsDispatch('fs_create_folder', { path }, runId, projectId, root),
};

export type FilesystemToolAdapter = typeof filesystemToolAdapter;
