/**
 * server/file-explorer/services/pinned/pinned.service.ts
 * Manages pinned (bookmarked) file paths.
 */

import { pinnedRepository } from '../../repositories/filesystem/index.ts';

interface PinnedResult { ok: boolean; files: string[]; error?: string; }

class PinnedService {
  getAll(): PinnedResult {
    try { return { ok: true, files: pinnedRepository.getAll() }; }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  pin(filePath: string): PinnedResult {
    try { pinnedRepository.add(filePath); return this.getAll(); }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  unpin(filePath: string): PinnedResult {
    try { pinnedRepository.remove(filePath); return this.getAll(); }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  clear(): PinnedResult {
    try { pinnedRepository.clear(); return { ok: true, files: [] }; }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }
}

export const pinnedService = new PinnedService();
