import { DbAdapter, MigrationScript } from '../types.js';

export const executeSqlScript = async (dbAdapter: DbAdapter, migration: MigrationScript): Promise<void> => {
  await dbAdapter.execute(migration.sql, migration.name);
};
