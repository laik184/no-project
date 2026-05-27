import { searchText as fsSearchText }   from '../../../tools/filesystem/lib/search/text-search.ts';
import { searchRegex as fsSearchRegex } from '../../../tools/filesystem/lib/search/regex-search.ts';
import type { OperationRequest, OperationResult } from '../types/operation.types.ts';

export const searchOperation = {
  async searchText(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    if (!req.query) {
      return { id: req.id, type: req.type, success: false, error: 'query is required', durationMs: 0 };
    }
    const results = await fsSearchText({ sandboxRoot, path: req.path, query: req.query });
    const lines = results.flatMap((r) =>
      r.matches.map((m) => `${r.relativePath}:${m.lineNumber}: ${m.lineContent}`),
    );
    return {
      id: req.id, type: req.type, success: true,
      output: lines.length ? lines.slice(0, 50).join('\n') : 'No matches found.',
      durationMs: 0,
    };
  },

  async searchRegex(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    if (!req.query) {
      return { id: req.id, type: req.type, success: false, error: 'query (regex pattern) is required', durationMs: 0 };
    }
    const results = await fsSearchRegex({ sandboxRoot, path: req.path, pattern: req.query });
    const lines = results.flatMap((r) =>
      r.matches.map((m) => `${r.relativePath}:${m.lineNumber}: ${m.lineContent}`),
    );
    return {
      id: req.id, type: req.type, success: true,
      output: lines.length ? lines.slice(0, 50).join('\n') : 'No matches found.',
      durationMs: 0,
    };
  },
};
