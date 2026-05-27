/**
 * server/tools/coding/database/generate-db-config.ts
 * Tool: coding_generate_db_config
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { DbConfigInput }                        from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';

type Dialect = 'postgres' | 'mysql' | 'sqlite';

function postgresConfig(): string {
  return `import { drizzle }      from 'drizzle-orm/node-postgres';
import { Pool }           from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const db = drizzle(pool);

export default db;
`;
}

function sqliteConfig(): string {
  return `import { drizzle }      from 'drizzle-orm/better-sqlite3';
import Database           from 'better-sqlite3';

const sqlite = new Database(process.env.DB_PATH ?? 'local.db');
const db     = drizzle(sqlite);

export default db;
`;
}

function mysqlConfig(): string {
  return `import { drizzle }      from 'drizzle-orm/mysql2';
import mysql              from 'mysql2/promise';

const pool = mysql.createPool({ uri: process.env.DATABASE_URL ?? '' });
const db   = drizzle(pool);

export default db;
`;
}

const CONFIGS: Record<Dialect, () => string> = {
  postgres: postgresConfig,
  sqlite:   sqliteConfig,
  mysql:    mysqlConfig,
};

export const generateDbConfigTool = {
  name:        'coding_generate_db_config',
  category:    'coding',
  description: 'Generate a Drizzle ORM database configuration file. Returns file map — does not write to disk.',
  inputSchema: {
    dialect:  { type: 'string', description: '"postgres" (default) | "mysql" | "sqlite"', required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',              required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: DbConfigInput, ctx: ToolExecutionContext) => {
    const dialect: Dialect = (input.dialect as Dialect) in CONFIGS
      ? (input.dialect as Dialect)
      : 'postgres';

    const code    = CONFIGS[dialect]();
    const files   = { 'lib/db.ts': code };
    const report  = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated Drizzle ${dialect} config: lib/db.ts`, report.warnings));
  },
} as unknown as ToolDefinition;
