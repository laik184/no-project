/**
 * server/file-explorer/services/insights/insights.service.ts
 * Aggregates project-level statistics from the sandbox tree.
 */

import fs   from 'fs';
import path from 'path';
import { FE_CONFIG }    from '../../config/index.ts';
import { isExcluded }   from '../../guards/index.ts';
import { getExtension } from '../../utils/index.ts';
import type { InsightsResponse } from '../../contracts/index.ts';
import type { ProjectInsights }  from '../../types/index.ts';

interface FileRecord { filePath: string; size: number; mtime: number; }

function* walk(dir: string): Generator<FileRecord> {
  const cfg = FE_CONFIG;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const e of entries) {
    if (isExcluded(e.name, cfg.excludePatterns)) continue;
    if (!cfg.showHidden && e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { yield* walk(abs); }
    else {
      const s = fs.statSync(abs);
      yield { filePath: path.relative(cfg.sandboxRoot, abs).split(path.sep).join('/'), size: s.size, mtime: s.mtimeMs };
    }
  }
}

class InsightsService {

  /** Builds a ProjectInsights object by walking the entire sandbox. */
  getInsights(): InsightsResponse {
    try {
      const byExt: Record<string, number> = {};
      const allFiles: FileRecord[] = [];

      for (const f of walk(FE_CONFIG.sandboxRoot)) {
        allFiles.push(f);
        const ext = getExtension(f.filePath.split('/').pop() ?? '') || 'other';
        byExt[ext] = (byExt[ext] ?? 0) + 1;
      }

      const totalSizeBytes = allFiles.reduce((s, f) => s + f.size, 0);
      const largestFiles   = [...allFiles].sort((a, b) => b.size - a.size).slice(0, 10)
                              .map(f => ({ path: f.filePath, size: f.size }));
      const recentlyChanged = [...allFiles].sort((a, b) => b.mtime - a.mtime).slice(0, 10)
                              .map(f => ({ path: f.filePath, mtime: f.mtime }));

      const insights: ProjectInsights = {
        totalFiles:    allFiles.length,
        totalFolders:  0,
        totalSizeBytes,
        byExtension:   byExt,
        largestFiles,
        recentlyChanged,
      };

      return { ok: true, insights };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const insightsService = new InsightsService();
