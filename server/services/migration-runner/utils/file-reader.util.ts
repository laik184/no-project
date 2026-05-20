import { promises as fs } from 'node:fs';
import path from 'node:path';

export const readSqlFiles = async (directory: string): Promise<Array<{ name: string; path: string; sql: string }>> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => entry.name);

  const files = await Promise.all(
    sqlFiles.map(async (name) => {
      const fullPath = path.join(directory, name);
      const sql = await fs.readFile(fullPath, 'utf8');
      return {
        name,
        path: fullPath,
        sql,
      };
    }),
  );

  return files;
};
