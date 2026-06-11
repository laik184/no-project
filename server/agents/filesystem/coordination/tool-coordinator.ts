/**
 * server/agents/filesystem/coordination/tool-coordinator.ts
 *
 * Maps operation requests to registered tool names and prepares tool inputs.
 * The coordinator knows WHICH tool to call and HOW to shape its input.
 * It does NOT execute — all execution goes through dispatcher-client.ts.
 */

import type {
  ReadOperationRequest,
  WriteOperationRequest,
  PatchOperationRequest,
  DeleteOperationRequest,
  SearchOperationRequest,
  SearchKind,
  RoutedOperation,
} from '../types/filesystem.types.ts';

// ── Read coordination ─────────────────────────────────────────────────────────

export function coordinateRead(
  req:         ReadOperationRequest,
  _sandboxRoot: string,
): RoutedOperation {
  if (req.startLine !== undefined || req.endLine !== undefined) {
    return {
      toolName:  'fs_read_lines',
      toolInput: {
        path:      req.path,
        from:      req.startLine ?? 1,
        to:        req.endLine ?? req.startLine ?? 1,
      },
    };
  }
  return {
    toolName:  'fs_read_file',
    toolInput: { path: req.path },
  };
}

// ── Write coordination ────────────────────────────────────────────────────────

export function coordinateWrite(
  req:         WriteOperationRequest,
  _sandboxRoot: string,
): RoutedOperation {
  if (req.onlyIfAbsent) {
    return { toolName: 'fs_write_if_absent', toolInput: { path: req.path, content: req.content } };
  }
  if (req.append) {
    return { toolName: 'fs_append_file', toolInput: { path: req.path, content: req.content } };
  }
  return { toolName: 'fs_write_file', toolInput: { path: req.path, content: req.content } };
}

// ── Patch coordination ────────────────────────────────────────────────────────

export function coordinatePatch(
  req:         PatchOperationRequest,
  _sandboxRoot: string,
): RoutedOperation {
  if (req.patchAll) {
    return {
      toolName:  'fs_patch_all',
      toolInput: { path: req.path, hunks: req.hunks },
    };
  }
  return {
    toolName:  'fs_patch_file',
    toolInput: { path: req.path, hunks: req.hunks },
  };
}

// ── Delete coordination ───────────────────────────────────────────────────────

export function coordinateDelete(
  req:         DeleteOperationRequest,
  _sandboxRoot: string,
): RoutedOperation {
  if (req.multiple && req.multiple.length > 0) {
    return {
      toolName:  'fs_delete_multiple',
      toolInput: { paths: req.multiple },
    };
  }
  if (req.recursive) {
    return { toolName: 'fs_delete_folder', toolInput: { path: req.path } };
  }
  return { toolName: 'fs_delete_file', toolInput: { path: req.path } };
}

// ── Search coordination ───────────────────────────────────────────────────────

const SEARCH_TOOL_MAP: Record<SearchKind, string> = {
  by_name:    'fs_find_by_name',
  by_extension: 'fs_find_by_extension',
  by_pattern: 'fs_find_by_pattern',
  text:       'fs_search_text',
  regex:      'fs_search_regex',
  imports:    'fs_find_imports',
  exports:    'fs_find_exports',
  symbol:     'fs_find_symbol_usages',
};

export function coordinateSearch(
  req:         SearchOperationRequest,
  _sandboxRoot: string,
): RoutedOperation {
  const toolName = SEARCH_TOOL_MAP[req.searchKind];
  if (!toolName) {
    throw new Error(`[tool-coordinator] Unknown searchKind: ${req.searchKind}`);
  }
  const path = req.rootPath ?? '.';

  switch (req.searchKind) {
    case 'by_name':
      return { toolName, toolInput: { path, name: req.query, maxDepth: req.maxResults } };
    case 'by_extension':
      return { toolName, toolInput: { path, extension: req.query, maxDepth: req.maxResults } };
    case 'by_pattern':
      return { toolName, toolInput: { path, pattern: req.query, maxDepth: req.maxResults } };
    case 'regex':
      return { toolName, toolInput: { path, pattern: req.query, flags: req.caseSensitive ? 'g' : 'gi' } };
    case 'text':
      return { toolName, toolInput: { path, query: req.query, caseSensitive: req.caseSensitive ?? false } };
    case 'imports':
    case 'exports':
    case 'symbol':
      return { toolName, toolInput: { path } };
  }
}
