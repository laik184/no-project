/**
 * server/file-explorer/services/search/search.service.ts
 * Grep-style full-text search across all text files in the sandbox.
 */

import fs   from 'fs';
import path from 'path';
import { FE_CONFIG }            from '../../config/index.ts';
import { resolveSafe }          from '../../guards/index.ts';
import { isExcluded }           from '../../guards/index.ts';
import { hasBinaryContent, decodeBuffer, toRelative } from '../../utils/index.ts';
import type { SearchResponse, SearchMatch } from '../../contracts/index.ts';

const MAX_FILE_SEARCH = 512 * 1024; // 512 KB per file

function* walkFiles(dir: string, cfg: typeof FE_CONFIG): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (isExcluded(e.name, cfg.excludePatterns)) continue;
    if (!cfg.showHidden && e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { yield* walkFiles(abs, cfg); }
    else                  { yield abs; }
  }
}

class SearchService {

  /** Searches all text files for query. Returns up to maxResults matches. */
  search(query: string, projectPath?: string, caseSensitive = false): SearchResponse {
    if (!query.trim()) return { ok: false, matches: [], total: 0, error: 'Query is empty' };

    try {
      const root    = projectPath ? resolveSafe(projectPath) : FE_CONFIG.sandboxRoot;
      const needle  = caseSensitive ? query : query.toLowerCase();
      const matches: SearchMatch[] = [];
      const max     = FE_CONFIG.maxSearchResults;

      for (const absFile of walkFiles(root, FE_CONFIG)) {
        if (matches.length >= max) break;

        const stat = fs.statSync(absFile);
        if (stat.size > MAX_FILE_SEARCH) continue;

        const buf = fs.readFileSync(absFile);
        if (hasBinaryContent(buf)) continue;

        const { content } = decodeBuffer(buf);
        const lines        = content.split('\n');
        const relPath      = toRelative(absFile, FE_CONFIG.sandboxRoot);

        for (let li = 0; li < lines.length && matches.length < max; li++) {
          const line   = lines[li];
          const haystack = caseSensitive ? line : line.toLowerCase();
          const col    = haystack.indexOf(needle);
          if (col === -1) continue;
          matches.push({
            path:    relPath,
            line:    li + 1,
            column:  col + 1,
            text:    line,
            preview: line.trim().slice(0, 120),
          });
        }
      }

      return { ok: true, matches, total: matches.length };
    } catch (err) {
      return { ok: false, matches: [], total: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const searchService = new SearchService();
