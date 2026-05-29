/**
 * server/infrastructure/db/index.ts
 *
 * Singleton Drizzle ORM database connection.
 * All server-side modules import { db } from this file.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool }    from 'pg';
import * as schema from '../../../shared/schema.ts';

if (!process.env.DATABASE_URL) {
  throw new Error('[db] DATABASE_URL environment variable is not set.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max:              10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });
