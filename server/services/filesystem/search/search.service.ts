/**
 * server/file-explorer/services/search/search.service.ts
 * Grep-style full-text search across all text files in the sandbox.
 * Uses filesystemRepository.walkFiles() — no direct fs access.
 */

import { FE_CONFIG }            from '../../shared/file-explorer-core/config/index.ts';
import { resolveSafe }          from '../../shared/file-explorer-core/guards/index.ts';
import { filesystemRepository } from '../../repositories/file-system/index.ts';
import { hasBinaryContent, decodeBuffer } from '../../shared/file-explorer-core/utils/index.ts';
import type { SearchResponse, SearchMatch } from '../../shared/file-explorer-core/contracts/index.ts';

const MAX_FILE_SEARCH_BYTES = 512 * 1024; // 512 KB per file

class SearchService {

  /**
   * Searches all text files under projectPath (default: sandbox root) for query.
   * Returns up to FE_CONFIG.maxSearchResults matches.
   * No direct fs access — delegates entirely to filesystemRepository.
   */
  search(query: string, projectPath?: string, caseSensitive = false): SearchResponse {
    if (!query.trim()) {
      return { ok: false, matches: [], total: 0, error: 'Query is empty' };
    }

    try {
      const root   = projectPath ? resolveSafe(projectPath) : FE_CONFIG.sandboxRoot;
      const needle = caseSensitive ? query : query.toLowerCase();
      const matches: SearchMatch[] = [];
      const max    = FE_CONFIG.maxSearchResults;

      for (const record of filesystemRepository.walkFiles(root, FE_CONFIG.sandboxRoot)) {
        if (matches.length >= max) break;
        if (record.size > MAX_FILE_SEARCH_BYTES) continue;

        const buf = filesystemRepository.readBuffer(record.absPath);
        if (hasBinaryContent(buf)) continue;

        const { content } = decodeBuffer(buf);
        const lines        = content.split('\n');

        for (let li = 0; li < lines.length && matches.length < max; li++) {
          const line     = lines[li];
          const haystack = caseSensitive ? line : line.toLowerCase();
          const col      = haystack.indexOf(needle);
          if (col === -1) continue;

          matches.push({
            path:    record.relPath,
            line:    li + 1,
            column:  col + 1,
            text:    line,
            preview: line.trim().slice(0, 120),
          });
        }
      }

      return { ok: true, matches, total: matches.length };
    } catch (err) {
      return {
        ok: false, matches: [], total: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const searchService = new SearchService();
