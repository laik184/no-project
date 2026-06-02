/**
 * server/repositories/filesystem/index.ts
 *
 * Single public entry point for all filesystem repositories.
 * All services in server/services/filesystem/** must import ONLY from here.
 *
 * Do NOT import repository implementation files directly.
 */

export * from '../file-system/index.ts';
