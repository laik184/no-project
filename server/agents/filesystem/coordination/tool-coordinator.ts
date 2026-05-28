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
import { joinPaths } from '../utils/filesystem-utils.ts';

// ── Read coordination ─────────────────────────────────────────────────────────

export function coordinateRead(
  req:         ReadOperationRequest,
  sandboxRoot: string,
): RoutedOperation {
  if (req.startLine !== undefined || req.endLine !== undefined) {
    return {
      toolName:  'read_lines',
      toolInput: {
        path:      joinPaths(sandboxRoot, req.path),
        startLine: req.startLine ?? 1,
        endLine:   req.endLine,
      },
    };
  }
  return {
    toolName:  'read_file',
    toolInput: { path: joinPaths(sandboxRoot, req.path) },
  };
}

// ── Write coordination ────────────────────────────────────────────────────────

export function coordinateWrite(
  req:         WriteOperationRequest,
  sandboxRoot: string,
): RoutedOperation {
  const fullPath = joinPaths(sandboxRoot, req.path);
  if (req.onlyIfAbsent) {
    return { toolName: 'write_if_absent', toolInput: { path: fullPath, content: req.content } };
  }
  if (req.append) {
    return { toolName: 'append_file', toolInput: { path: fullPath, content: req.content } };
  }
  return { toolName: 'write_file', toolInput: { path: fullPath, content: req.content } };
}

// ── Patch coordination ────────────────────────────────────────────────────────

export function coordinatePatch(
  req:         PatchOperationRequest,
  sandboxRoot: string,
): RoutedOperation {
  const fullPath = joinPaths(sandboxRoot, req.path);
  if (req.patchAll) {
    return {
      toolName:  'patch_all',
      toolInput: { path: fullPath, hunks: req.hunks },
    };
  }
  return {
    toolName:  'patch_file',
    toolInput: { path: fullPath, hunks: req.hunks },
  };
}

// ── Delete coordination ───────────────────────────────────────────────────────

export function coordinateDelete(
  req:         DeleteOperationRequest,
  sandboxRoot: string,
): RoutedOperation {
  if (req.multiple && req.multiple.length > 0) {
    return {
      toolName:  'delete_multiple',
      toolInput: { paths: req.multiple.map((p) => joinPaths(sandboxRoot, p)) },
    };
  }
  const fullPath = joinPaths(sandboxRoot, req.path);
  if (req.recursive) {
    return { toolName: 'delete_folder', toolInput: { path: fullPath } };
  }
  return { toolName: 'delete_file', toolInput: { path: fullPath } };
}

// ── Search coordination ───────────────────────────────────────────────────────

const SEARCH_TOOL_MAP: Record<SearchKind, string> = {
  by_name:    'find_by_name',
  by_extension: 'find_by_extension',
  by_pattern: 'find_by_pattern',
  text:       'search_text',
  regex:      'search_regex',
  imports:    'find_imports',
  exports:    'find_exports',
  symbol:     'find_symbol_usages',
};

export function coordinateSearch(
  req:         SearchOperationRequest,
  sandboxRoot: string,
): RoutedOperation {
  const toolName = SEARCH_TOOL_MAP[req.searchKind];
  if (!toolName) {
    throw new Error(`[tool-coordinator] Unknown searchKind: ${req.searchKind}`);
  }
  const rootPath = req.rootPath
    ? joinPaths(sandboxRoot, req.rootPath)
    : sandboxRoot;

  return {
    toolName,
    toolInput: {
      query:         req.query,
      rootPath,
      caseSensitive: req.caseSensitive ?? false,
      maxResults:    req.maxResults,
    },
  };
}
