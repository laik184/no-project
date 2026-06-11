/**
 * server/infrastructure/db/index.ts
 *
 * Singleton Drizzle ORM database connection.
 *
 * Startup rule: importing infrastructure must never crash the process.  Some
 * modules import the infrastructure barrel only for bus/SSE/runtime utilities,
 * so database configuration is reported through diagnostics and verified when
 * the database is actually used instead of throwing during module evaluation.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool }    from 'pg';
import * as schema from '../../../shared/schema.ts';

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export const databaseConfig = Object.freeze({
  hasDatabaseUrl: isDatabaseConfigured(),
});

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max:              10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected idle PostgreSQL client error:', err);
});

export const db = drizzle(pool, { schema });
