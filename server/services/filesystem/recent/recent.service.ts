/**
 * server/file-explorer/services/recent/recent.service.ts
 * Tracks recently opened files.
 */

import { recentRepository } from '../../repositories/file-system/index.ts';

interface RecentResult { ok: boolean; files: string[]; error?: string; }

class RecentService {
  getAll(): RecentResult {
    try { return { ok: true, files: recentRepository.getAll() }; }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  add(filePath: string): RecentResult {
    try { recentRepository.add(filePath); return this.getAll(); }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  clear(): RecentResult {
    try { recentRepository.clear(); return { ok: true, files: [] }; }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }
}

export const recentService = new RecentService();
