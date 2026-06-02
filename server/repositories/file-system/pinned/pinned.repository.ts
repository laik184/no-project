/**
 * server/file-explorer/repositories/pinned.repository.ts
 * Persists pinned file paths to a JSON file inside .nura/.
 */

import fs   from 'fs';
import path from 'path';
import { FE_CONFIG } from '../../shared/file-explorer-core/config/index.ts';

const MAX_PINNED = 20;
const STORE_PATH = path.join(FE_CONFIG.sandboxRoot, '.nura', 'pinned.json');

class PinnedRepository {

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

  add(filePath: string): void {
    const list = this.load();
    if (list.includes(filePath)) return;
    this.persist([filePath, ...list].slice(0, MAX_PINNED));
  }

  remove(filePath: string): void {
    this.persist(this.load().filter(p => p !== filePath));
  }

  clear(): void {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
  }
}

export const pinnedRepository = new PinnedRepository();
