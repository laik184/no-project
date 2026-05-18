import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GeneratedFile } from '../types.js';
import { emitFileChange } from '../../../../infrastructure/events/file-change-emitter.ts';

export const writeGeneratedFiles = async (
  rootDir: string,
  files: readonly GeneratedFile[],
  overwrite = false,
  projectId?: number,
): Promise<Readonly<{ created: readonly string[]; skipped: readonly string[] }>> => {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const absolutePath = path.resolve(rootDir, file.path);
    const folder = path.dirname(absolutePath);
    await fs.mkdir(folder, { recursive: true });

    const exists = await fs
      .access(absolutePath)
      .then(() => true)
      .catch(() => false);

    if (exists && !overwrite) {
      skipped.push(file.path);
      continue;
    }

    await fs.writeFile(absolutePath, `${file.content.trim()}\n`, 'utf8');
    created.push(file.path);
    if (projectId !== undefined) {
      emitFileChange(projectId, exists ? 'change' : 'add', file.path);
    }
  }

  return Object.freeze({
    created: Object.freeze(created),
    skipped: Object.freeze(skipped),
  });
};
