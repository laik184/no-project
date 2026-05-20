import { MigrationScript } from '../types.js';
import { readSqlFiles } from '../utils/file-reader.util.js';

export const scriptLoaderAgent = async (migrationsDir: string): Promise<MigrationScript[]> => {
  const files = await readSqlFiles(migrationsDir);
  return files.map((file) => ({
    name: file.name,
    path: file.path,
    sql: file.sql,
  }));
};
