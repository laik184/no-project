/**
 * server/file-explorer/services/open-editors/open-editors.service.ts
 * Tracks which files are currently open in the editor.
 */

import { editorsRepository } from '../../repositories/index.ts';

interface EditorsResult { ok: boolean; files: string[]; error?: string; }

class OpenEditorsService {
  getAll(): EditorsResult {
    try { return { ok: true, files: editorsRepository.getAll() }; }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  open(filePath: string): EditorsResult {
    try { editorsRepository.open(filePath); return this.getAll(); }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  close(filePath: string): EditorsResult {
    try { editorsRepository.close(filePath); return this.getAll(); }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }

  closeAll(): EditorsResult {
    try { editorsRepository.closeAll(); return { ok: true, files: [] }; }
    catch (err) { return { ok: false, files: [], error: String(err) }; }
  }
}

export const openEditorsService = new OpenEditorsService();
