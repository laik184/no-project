/**
 * server/file-explorer/services/insights/insights.service.ts
 * Aggregates project-level statistics from the sandbox tree.
 * Uses filesystemRepository.walkFiles() — no direct fs access.
 */

import { FE_CONFIG }             from '../../config/index.ts';
import { filesystemRepository }  from '../../repositories/index.ts';
import { getExtension }          from '../../utils/index.ts';
import type { InsightsResponse } from '../../contracts/index.ts';
import type { ProjectInsights }  from '../../types/index.ts';

interface FileRecord { relPath: string; size: number; mtime: number; }

class InsightsService {

  /**
   * Builds a ProjectInsights object by walking the entire sandbox.
   * No direct fs access — delegates to filesystemRepository.walkFiles().
   */
  getInsights(): InsightsResponse {
    try {
      const byExt: Record<string, number> = {};
      const allFiles: FileRecord[] = [];

      for (const record of filesystemRepository.walkFiles(FE_CONFIG.sandboxRoot, FE_CONFIG.sandboxRoot)) {
        allFiles.push({ relPath: record.relPath, size: record.size, mtime: record.mtime });
        const ext = getExtension(record.relPath.split('/').pop() ?? '') || 'other';
        byExt[ext] = (byExt[ext] ?? 0) + 1;
      }

      const totalSizeBytes  = allFiles.reduce((s, f) => s + f.size, 0);
      const largestFiles    = [...allFiles]
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(f => ({ path: f.relPath, size: f.size }));
      const recentlyChanged = [...allFiles]
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 10)
        .map(f => ({ path: f.relPath, mtime: f.mtime }));

      const insights: ProjectInsights = {
        totalFiles:      allFiles.length,
        totalFolders:    0,
        totalSizeBytes,
        byExtension:     byExt,
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
