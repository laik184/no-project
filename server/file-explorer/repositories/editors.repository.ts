/**
 * server/file-explorer/repositories/editors.repository.ts
 * Persists open editor file paths to a JSON file inside .nura/.
 */

import fs   from 'fs';
import path from 'path';
import { FE_CONFIG } from '../config/index.ts';

const MAX_EDITORS = 24;
const STORE_PATH  = path.join(FE_CONFIG.sandboxRoot, '.nura', 'editors.json');

class EditorsRepository {

  private load(): string[] {
    if (!fs.existsSync(STORE_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as string[]; }
    catch { return []; }
  }

  private persist(list: string[]): void {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(list), 'utf-8');
  }

  getAll(): string[] { return this.load(); }

  open(filePath: string): void {
    const list = [filePath, ...this.load().filter(p => p !== filePath)].slice(0, MAX_EDITORS);
    this.persist(list);
  }

  close(filePath: string): void {
    this.persist(this.load().filter(p => p !== filePath));
  }

  closeAll(): void {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
  }
}

export const editorsRepository = new EditorsRepository();
