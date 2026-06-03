/**
 * server/file-explorer/repositories/recent.repository.ts
 * Persists recently opened file paths to a JSON file inside .nura/.
 */

import fs   from 'fs';
import path from 'path';
import { FE_CONFIG } from '../../../shared/file-explorer-core/config/index.ts';

const MAX_RECENT = 20;
const STORE_PATH = path.join(FE_CONFIG.sandboxRoot, '.nura', 'recent.json');

class RecentRepository {

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
    const list = [filePath, ...this.load().filter(p => p !== filePath)].slice(0, MAX_RECENT);
    this.persist(list);
  }

  clear(): void {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
  }
}

export const recentRepository = new RecentRepository();
